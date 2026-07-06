import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Protocol

from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.repositories.redshift_data_api_client import (
    RedshiftDataApiClient,
    RedshiftDataApiError,
)
from app.schemas.account_360 import (
    Account360Response,
    AccountActivityItem,
    AccountBadge,
    AccountBankingSummary,
    AccountBenefitsSummary,
    AccountComplianceSummary,
    AccountDeviceSummary,
    AccountKycHistoryItem,
    AccountProductDetailResponse,
    AccountProductSummary,
    AccountProductTransaction,
    AccountProfile,
    AccountSummaryMetrics,
    AccountTermsItem,
    AccountWallet,
)

CUSTOMER_TABLE = "customer.customer"
CUSTOMER_ID_COLUMN = "customer_id"
CUSTOMER_PROFILE_SQL = f"""
SELECT
    customer_id,
    email,
    country,
    id_number,
    id_type,
    last_name,
    name,
    calling_code,
    phone_number,
    username,
    is_company,
    kyc_stage_1,
    kyc_stage_2,
    kyc_stage_3,
    compliance_status,
    nationality
FROM {CUSTOMER_TABLE}
WHERE {CUSTOMER_ID_COLUMN} = :account_id
LIMIT 1
""".strip()

ACTIVE_PLAN_SQL = """
SELECT
    pl.name
FROM subscription.subscription s
JOIN subscription.plan_country pc
    ON s.plan_country_id = pc.id
JOIN subscription.plan_locale pl
    ON pc.plan_id = pl.plan_id
WHERE s.customer_id = :account_id
    AND s.status = 'ACTIVE'
LIMIT 1
""".strip()

CUSTOMER_SEGMENTATION_SQL = """
SELECT segmentation
FROM customer.segmentation
WHERE customer_id = :account_id
LIMIT 1
""".strip()

RECENT_TRANSACTIONS_SQL = """
SELECT
    transaction_id,
    origin_amount,
    origin_currency,
    tx_status,
    start_date,
    successfully_completed_date
FROM transaction.transaction
WHERE customer_id = :account_id
ORDER BY start_date DESC
LIMIT 5
""".strip()

TRANSACTION_COUNT_SQL = """
SELECT COUNT(transaction_id) AS transaction_count
FROM transaction.transaction
WHERE customer_id = :account_id
""".strip()

DEVICE_INFO_SQL = """
SELECT
    app_version,
    date_version,
    device,
    device_os
FROM customer.device_info
WHERE customer_id = :account_id
ORDER BY date_version DESC
LIMIT 1
""".strip()

ACCOUNT_PRODUCT_TRANSACTIONS_SQL = """
SELECT
    ft.transaction_id,
    ft.product_id,
    dp.product_family,
    dp.product,
    ft.transaction_datetime,
    ft.customer_id,
    ft.origin_amount,
    ft.origin_amount_usd,
    ft.destination_amount,
    ft.destination_amount_usd,
    ft.origin_currency_destiny_currency
FROM datawarehouse.b2x_products.fact_transaction ft
LEFT JOIN datawarehouse.dimension.dim_product dp
    ON ft.product_id = dp.product_id
WHERE ft.customer_id = :account_id
ORDER BY ft.transaction_datetime DESC
LIMIT 200
""".strip()

PRODUCT_FAMILY_VISUALS = {
    "transferencia": ("remesa", "Remesa", "transferencia"),
    "p2p": ("p2p", "P2P", "P2P"),
    "exchange": ("exchange", "Exchange", "exchange"),
    "pago": ("pagos", "Pagos", "Pago"),
    "card": ("compras_tarjeta", "Compras tarjeta", "Card"),
}

logger = logging.getLogger(__name__)


class Account360RepositoryError(RuntimeError):
    pass


class Account360Repository(Protocol):
    def get_account_360(self, account_id: str) -> Optional[Account360Response]:
        ...

    def get_product_detail(
        self,
        account_id: str,
        product_code: str,
    ) -> Optional[AccountProductDetailResponse]:
        ...


class MockAccount360Repository:
    def get_account_360(self, account_id: str) -> Account360Response:
        return _build_mock_account_360(account_id)

    def get_product_detail(
        self,
        account_id: str,
        product_code: str,
    ) -> Optional[AccountProductDetailResponse]:
        return _build_mock_product_detail(account_id, product_code)


class UnavailableAccount360Repository:
    """Prevents mock fallback when real mode is explicitly enabled."""

    def get_account_360(self, account_id: str) -> Optional[Account360Response]:
        raise Account360RepositoryError("Account data source is not configured")

    def get_product_detail(
        self,
        account_id: str,
        product_code: str,
    ) -> Optional[AccountProductDetailResponse]:
        raise Account360RepositoryError("Account data source is not configured")


class RedshiftAccount360Repository:
    """Reads the base profile from Redshift and keeps unconnected modules mocked."""

    def __init__(
        self,
        client: RedshiftDataApiClient,
        mock_repository: Optional[MockAccount360Repository] = None,
    ) -> None:
        self._client = client
        self._mock_repository = mock_repository or MockAccount360Repository()

    def get_account_360(self, account_id: str) -> Optional[Account360Response]:
        try:
            rows = self._client.execute(
                CUSTOMER_PROFILE_SQL,
                parameters=[{"name": "account_id", "value": account_id}],
            )
        except RedshiftDataApiError:
            raise Account360RepositoryError(
                "Account data source is unavailable"
            ) from None

        logger.info("Account 360 Redshift rows returned: %d", len(rows))
        if not rows:
            return None

        try:
            response = self._mock_repository.get_account_360(account_id)
            response.profile = _map_customer_profile(
                account_id,
                rows[0],
                response.profile,
            )
            response.account_id = response.profile.account_id
            self._enrich_optional_sections(response, account_id)
            response.badges = _profile_badges(response.profile)
            response.data_source = "redshift_partial"
            return response
        except (TypeError, ValueError, ValidationError):
            raise Account360RepositoryError("Customer mapping failed") from None

    def _enrich_optional_sections(
        self,
        response: Account360Response,
        account_id: str,
    ) -> None:
        # In real mode these fields must not retain demo values if their source is
        # unavailable. Other, not-yet-connected Account 360 modules remain mock.
        response.profile.plan = "—"
        response.profile.segment = "—"
        response.activity = []
        response.products = []
        response.metrics.transactions_count = None
        response.device = AccountDeviceSummary(security_status="—")

        response.profile.segment = self.get_customer_segmentation(account_id) or "—"

        plan_rows = self._execute_optional(ACTIVE_PLAN_SQL, account_id, "active plan")
        if plan_rows:
            response.profile.plan = _string_value(plan_rows[0].get("name")) or "—"

        transaction_rows = self._execute_optional(
            RECENT_TRANSACTIONS_SQL,
            account_id,
            "recent transactions",
        )
        if transaction_rows is not None:
            response.activity = _map_transactions(transaction_rows)

        product_rows = self.get_account_product_transactions(account_id)
        if product_rows is not None:
            response.products = build_account_products_from_transactions(product_rows)

        count_rows = self._execute_optional(
            TRANSACTION_COUNT_SQL,
            account_id,
            "transaction count",
        )
        if count_rows:
            response.metrics.transactions_count = _integer_value(
                count_rows[0].get("transaction_count")
            )

        device_rows = self._execute_optional(
            DEVICE_INFO_SQL,
            account_id,
            "device info",
        )
        if device_rows:
            try:
                response.device = _map_device(device_rows[0])
            except (TypeError, ValueError, ValidationError):
                logger.warning("Account 360 skipped invalid device info")

    def get_customer_segmentation(self, account_id: str) -> Optional[str]:
        rows = self._execute_optional(
            CUSTOMER_SEGMENTATION_SQL,
            account_id,
            "customer segmentation",
        )
        if not rows:
            return None
        return _string_value(rows[0].get("segmentation"))

    def get_account_product_transactions(
        self,
        account_id: str,
    ) -> Optional[list[Dict[str, Any]]]:
        return self._execute_optional(
            ACCOUNT_PRODUCT_TRANSACTIONS_SQL,
            account_id,
            "account product transactions",
        )

    def get_account_products_summary(
        self,
        account_id: str,
    ) -> list[AccountProductSummary]:
        rows = self.get_account_product_transactions(account_id)
        return build_account_products_from_transactions(rows or [])

    def _execute_optional(
        self,
        sql: str,
        account_id: str,
        query_name: str,
    ) -> Optional[list[Dict[str, Any]]]:
        try:
            rows = self._client.execute(
                sql,
                parameters=[{"name": "account_id", "value": account_id}],
            )
            logger.info("Account 360 %s rows returned: %d", query_name, len(rows))
            return rows
        except RedshiftDataApiError:
            logger.warning("Account 360 optional query failed: %s", query_name)
            return None

    def get_product_detail(
        self,
        account_id: str,
        product_code: str,
    ) -> Optional[AccountProductDetailResponse]:
        detail = self._mock_repository.get_product_detail(account_id, product_code)
        if detail is None:
            return None

        detail.account_id = account_id
        detail.data_source = "redshift_partial"
        if product_code != "remittance":
            return detail

        transaction_rows = self._execute_optional(
            RECENT_TRANSACTIONS_SQL,
            account_id,
            "remittance transactions",
        )
        detail.recent_activity = (
            _map_transactions(transaction_rows)
            if transaction_rows is not None
            else []
        )
        return detail


def create_account_360_repository(
    settings: Optional[Settings] = None,
) -> Account360Repository:
    resolved_settings = settings or get_settings()
    if resolved_settings.account_360_use_mock_data:
        logger.info("Account 360 repository mode: mock")
        return MockAccount360Repository()

    if not resolved_settings.has_redshift_data_api_config:
        logger.error("Account 360 repository mode: redshift (configuration incomplete)")
        return UnavailableAccount360Repository()

    logger.info("Account 360 repository mode: redshift")
    secret = resolved_settings.redshift_secret_arn
    return RedshiftAccount360Repository(
        RedshiftDataApiClient(
            region=resolved_settings.aws_region or "",
            cluster_identifier=resolved_settings.redshift_cluster_identifier or "",
            database=resolved_settings.redshift_database or "",
            secret_arn=secret.get_secret_value() if secret else None,
            poll_interval_seconds=(
                resolved_settings.redshift_data_api_poll_interval_seconds
            ),
            timeout_seconds=resolved_settings.redshift_data_api_timeout_seconds,
        )
    )


def _map_customer_profile(
    account_id: str,
    row: Dict[str, Any],
    fallback: AccountProfile,
) -> AccountProfile:
    customer_id = _string_value(row.get("customer_id")) or account_id
    first_name = _string_value(row.get("name"))
    last_name = _string_value(row.get("last_name"))
    full_name = " ".join(
        value for value in (first_name, last_name) if value
    ) or f"Cuenta {customer_id}"
    id_type = _string_value(row.get("id_type"))
    id_number = _string_value(row.get("id_number"))
    document = " ".join(value for value in (id_type, id_number) if value) or None
    calling_code = _string_value(row.get("calling_code"))
    phone_number = _string_value(row.get("phone_number"))
    if calling_code and not calling_code.startswith("+"):
        calling_code = f"+{calling_code}"
    phone = " ".join(value for value in (calling_code, phone_number) if value) or None

    profile = fallback.model_dump()
    profile.update(
        {
            "account_id": customer_id,
            "internal_id": customer_id,
            "full_name": full_name,
            "email": _string_value(row.get("email")),
            "phone": phone,
            "country": _string_value(row.get("country")),
            "document": document,
            "document_type": id_type,
            "document_number": id_number,
            "username": _string_value(row.get("username")),
            "segment": "—",
            "nationality": _string_value(row.get("nationality")),
            "kyc_stage_1": _string_value(row.get("kyc_stage_1")),
            "kyc_stage_2": _string_value(row.get("kyc_stage_2")),
            "kyc_stage_3": _string_value(row.get("kyc_stage_3")),
            "compliance_status": _string_value(row.get("compliance_status")),
            "account_type": _account_type(row.get("is_company")),
            "customer_type": _customer_type(row.get("is_company")),
            "plan": "—",
            "status": "UNKNOWN",
            "kyc_status": _string_value(row.get("kyc_stage_1")) or "—",
            "created_at": None,
            "last_activity_at": None,
            "days_without_activity": None,
        }
    )
    return AccountProfile.model_validate(profile)


def _string_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _is_company(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "t", "yes", "y"}:
        return True
    if normalized in {"0", "false", "f", "no", "n"}:
        return False
    return None


def _account_type(value: Any) -> str:
    company = _is_company(value)
    if company is None:
        return "—"
    return "Company Account" if company else "Person Account"


def _customer_type(value: Any) -> str:
    company = _is_company(value)
    if company is None:
        return "—"
    return "Empresa" if company else "Persona"


def _integer_value(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _float_value(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _product_family_metadata(family: Optional[str]) -> tuple[str, str, str]:
    normalized_family = _string_value(family) or "sin categoría"
    known = PRODUCT_FAMILY_VISUALS.get(normalized_family.casefold())
    if known:
        return known

    ascii_family = unicodedata.normalize("NFKD", normalized_family).encode(
        "ascii", "ignore"
    ).decode("ascii")
    code = re.sub(r"[^a-z0-9]+", "_", ascii_family.casefold()).strip("_")
    return code or "sin_categoria", normalized_family.replace("_", " ").title(), normalized_family


def build_account_products_from_transactions(
    rows: list[Dict[str, Any]],
) -> list[AccountProductSummary]:
    grouped: Dict[str, Dict[str, Any]] = {
        code: {
            "code": code,
            "label": label,
            "family": family,
            "transactions": [],
        }
        for code, label, family in PRODUCT_FAMILY_VISUALS.values()
    }

    for row in rows:
        transaction_id = _string_value(row.get("transaction_id"))
        customer_id = _string_value(row.get("customer_id"))
        transaction_datetime = row.get("transaction_datetime")
        if not transaction_id or not customer_id or not transaction_datetime:
            logger.warning("Account 360 skipped an invalid product transaction row")
            continue

        code, label, family = _product_family_metadata(row.get("product_family"))
        try:
            transaction = AccountProductTransaction(
                transaction_id=transaction_id,
                product_id=_string_value(row.get("product_id")),
                product=_string_value(row.get("product")),
                product_family=family,
                transaction_datetime=transaction_datetime,
                customer_id=customer_id,
                origin_amount=_float_value(row.get("origin_amount")),
                origin_amount_usd=_float_value(row.get("origin_amount_usd")),
                destination_amount=_float_value(row.get("destination_amount")),
                destination_amount_usd=_float_value(row.get("destination_amount_usd")),
                origin_currency_destiny_currency=_string_value(
                    row.get("origin_currency_destiny_currency")
                ),
            )
        except (TypeError, ValueError, ValidationError):
            logger.warning("Account 360 skipped an invalid product transaction row")
            continue

        group = grouped.setdefault(
            code,
            {"code": code, "label": label, "family": family, "transactions": []},
        )
        group["transactions"].append(transaction)

    products: list[AccountProductSummary] = []
    for group in grouped.values():
        transactions = sorted(
            group["transactions"],
            key=lambda item: item.transaction_datetime,
            reverse=True,
        )
        products.append(
            AccountProductSummary(
                code=group["code"],
                label=group["label"],
                family=group["family"],
                movement_count=len(transactions),
                volume_usd=sum(item.origin_amount_usd or 0 for item in transactions),
                last_transaction_at=(
                    transactions[0].transaction_datetime if transactions else None
                ),
                transactions=transactions,
            )
        )
    return products


def _map_transactions(rows: list[Dict[str, Any]]) -> list[AccountActivityItem]:
    activities: list[AccountActivityItem] = []
    for row in rows:
        transaction_id = _string_value(row.get("transaction_id"))
        occurred_at = row.get("successfully_completed_date") or row.get("start_date")
        if not transaction_id or not occurred_at:
            continue
        try:
            activities.append(
                AccountActivityItem(
                    activity_id=transaction_id,
                    activity_type="transaction",
                    title="Transacción",
                    occurred_at=occurred_at,
                    status=_string_value(row.get("tx_status")),
                    amount=_float_value(row.get("origin_amount")),
                    currency=_string_value(row.get("origin_currency")),
                )
            )
        except (TypeError, ValueError, ValidationError):
            logger.warning("Account 360 skipped an invalid transaction row")
    return activities


def _map_device(row: Dict[str, Any]) -> AccountDeviceSummary:
    return AccountDeviceSummary(
        platform=_string_value(row.get("device_os")),
        app_version=_string_value(row.get("app_version")),
        device_model=_string_value(row.get("device")),
        last_login_at=row.get("date_version"),
        security_status="—",
    )


def _profile_badges(profile: AccountProfile) -> list[AccountBadge]:
    return [
        AccountBadge(code="kyc", label="KYC", value=profile.kyc_status, tone="success"),
        AccountBadge(
            code="compliance",
            label="Compliance",
            value=profile.compliance_status or "—",
            tone="success",
        ),
        AccountBadge(code="plan", label="Plan", value=profile.plan, tone="info"),
        AccountBadge(
            code="customer_type",
            label="Tipo",
            value=profile.customer_type,
            tone="neutral",
        ),
        AccountBadge(
            code="inactivity",
            label="Sin operar",
            value=f"{profile.days_without_activity or 0} días",
            tone="warning",
        ),
    ]


def _build_mock_account_360(account_id: str) -> Account360Response:
    last_activity = datetime(2026, 6, 29, 15, 40, tzinfo=timezone.utc)
    profile = AccountProfile(
        account_id=account_id,
        full_name="Cliente Demo Account 360",
        email="account360@example.com",
        phone="+56900000000",
        country="CL",
        customer_type="Persona",
        plan="Premium",
        status="ACTIVE",
        kyc_status="VERIFIED",
        created_at=datetime(2021, 4, 12, 12, 0, tzinfo=timezone.utc),
        last_activity_at=last_activity,
        days_without_activity=3,
    )
    activity = _mock_activity()

    return Account360Response(
        account_id=account_id,
        data_source="mock",
        profile=profile,
        badges=_profile_badges(profile),
        metrics=AccountSummaryMetrics(
            total_balance_usd=12845.62,
            historical_volume_usd=284930.18,
            interactions_count=47,
            attachments_count=12,
        ),
        wallets=[
            AccountWallet(
                currency="USD",
                balance=8450.20,
                available_balance=8240.20,
                balance_usd=8450.20,
                status="ACTIVE",
                updated_at=last_activity,
            ),
            AccountWallet(
                currency="CLP",
                balance=3260000,
                available_balance=3260000,
                balance_usd=3487.70,
                status="ACTIVE",
                updated_at=last_activity,
            ),
            AccountWallet(
                currency="EUR",
                balance=840.50,
                available_balance=840.50,
                balance_usd=907.72,
                status="ACTIVE",
                updated_at=last_activity,
            ),
        ],
        products=_mock_products(),
        kyc_history=[
            AccountKycHistoryItem(
                event_id="kyc-003",
                status="VERIFIED",
                description="Revalidación documental aprobada",
                occurred_at=datetime(2026, 2, 15, 14, 20, tzinfo=timezone.utc),
                source="KYC_PROVIDER",
            ),
            AccountKycHistoryItem(
                event_id="kyc-002",
                status="IN_REVIEW",
                description="Actualización de documento de identidad",
                occurred_at=datetime(2026, 2, 14, 11, 5, tzinfo=timezone.utc),
                source="MOBILE_APP",
            ),
            AccountKycHistoryItem(
                event_id="kyc-001",
                status="VERIFIED",
                description="Verificación inicial completada",
                occurred_at=datetime(2021, 4, 12, 12, 15, tzinfo=timezone.utc),
                source="KYC_PROVIDER",
            ),
        ],
        activity=activity,
        compliance=AccountComplianceSummary(
            risk_level="LOW",
            pep_status="NOT_PEP",
            sanctions_status="CLEAR",
            review_status="APPROVED",
            last_review_at=datetime(2026, 2, 15, 14, 20, tzinfo=timezone.utc),
            next_review_at=datetime(2027, 2, 15, 14, 20, tzinfo=timezone.utc),
            notes=["Sin alertas activas", "Perfil transaccional consistente"],
        ),
        banking=AccountBankingSummary(
            bank_name="Banco Demo",
            account_type="Cuenta corriente",
            account_number_masked="**** 4821",
            country="CL",
            currency="CLP",
            status="VERIFIED",
        ),
        benefits=AccountBenefitsSummary(
            cashback_balance_usd=38.42,
            accrued_interest_usd=12.18,
            benefits_tier="Premium Plus",
            updated_at=last_activity,
        ),
        device=AccountDeviceSummary(
            platform="iOS",
            app_version="8.4.1",
            device_model="Dispositivo móvil demo",
            last_login_at=last_activity,
            last_ip_country="CL",
            security_status="TRUSTED",
        ),
        terms=[
            AccountTermsItem(
                terms_code="general_terms",
                terms_name="Términos generales",
                version="2026.1",
                status="ACCEPTED",
                accepted_at=datetime(2026, 3, 2, 10, 30, tzinfo=timezone.utc),
            ),
            AccountTermsItem(
                terms_code="privacy_policy",
                terms_name="Política de privacidad",
                version="2025.3",
                status="ACCEPTED",
                accepted_at=datetime(2025, 11, 18, 9, 15, tzinfo=timezone.utc),
            ),
        ],
    )


def _mock_products() -> list[AccountProductSummary]:
    values = [
        ("remesa", "Remesa", "transferencia", 82450.30, 18),
        ("p2p", "P2P", "P2P", 12480.00, 9),
        ("exchange", "Exchange", "exchange", 96300.75, 31),
        ("pagos", "Pagos", "Pago", 18940.11, 14),
        ("compras_tarjeta", "Compras tarjeta", "Card", 31138.60, 76),
    ]
    return [
        AccountProductSummary(
            code=code,
            label=name,
            family=family,
            movement_count=count,
            volume_usd=volume,
            last_transaction_at=datetime(2026, 6, 29, 15, 40, tzinfo=timezone.utc),
        )
        for code, name, family, volume, count in values
    ]


def _mock_activity() -> list[AccountActivityItem]:
    return [
        AccountActivityItem(
            activity_id="activity-001",
            activity_type="TRANSACTION",
            title="Compra con tarjeta",
            description="Compra internacional aprobada",
            occurred_at=datetime(2026, 6, 29, 15, 40, tzinfo=timezone.utc),
            channel="CARD",
            status="COMPLETED",
            amount=128.40,
            currency="USD",
            product_code="card_purchases",
        ),
        AccountActivityItem(
            activity_id="activity-002",
            activity_type="EXCHANGE",
            title="Cambio de moneda",
            description="Conversión CLP a USD",
            occurred_at=datetime(2026, 6, 27, 12, 10, tzinfo=timezone.utc),
            channel="MOBILE_APP",
            status="COMPLETED",
            amount=1000,
            currency="USD",
            product_code="exchange",
        ),
        AccountActivityItem(
            activity_id="activity-003",
            activity_type="SUPPORT",
            title="Interacción de soporte",
            description="Consulta resuelta por agente",
            occurred_at=datetime(2026, 6, 25, 17, 5, tzinfo=timezone.utc),
            channel="CHAT",
            status="RESOLVED",
        ),
    ]


def _build_mock_product_detail(
    account_id: str,
    product_code: str,
) -> Optional[AccountProductDetailResponse]:
    legacy_codes = {
        "remittance": "remesa",
        "payments": "pagos",
        "card_purchases": "compras_tarjeta",
        "card": "compras_tarjeta",
    }
    normalized_code = legacy_codes.get(product_code, product_code)
    if normalized_code not in {product.code for product in _mock_products()}:
        return None

    summary = next(
        product for product in _mock_products() if product.code == normalized_code
    )
    details_by_product: Dict[str, Dict[str, Any]] = {
        "remesa": {
            "destinations": ["CL", "PE", "CO"],
            "completed_transfers": 18,
            "average_ticket_usd": 4580.57,
        },
        "p2p": {
            "frequent_recipients": 4,
            "completed_transfers": 9,
            "average_ticket_usd": 1386.67,
        },
        "exchange": {
            "preferred_pair": "CLP/USD",
            "completed_exchanges": 31,
            "average_spread_bps": 42,
        },
        "pagos": {
            "saved_services": 6,
            "scheduled_payments": 2,
            "successful_payments": 14,
        },
        "compras_tarjeta": {
            "approved_purchases": 76,
            "declined_purchases": 2,
            "international_share_percent": 34.5,
        },
    }
    activity = [
        item for item in _mock_activity() if item.product_code == product_code
    ]

    return AccountProductDetailResponse(
        account_id=account_id,
        product_code=normalized_code,
        product_name=summary.label,
        status="ACTIVE",
        summary=f"{summary.movement_count} movimientos",
        details=details_by_product[normalized_code],
        recent_activity=activity,
        data_source="mock",
    )
