import logging
import re
import unicodedata
from typing import Any, Dict, Optional, Protocol

from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.mocks.account_360 import build_mock_account_360, build_mock_product_detail
from app.repositories.redshift_data_api_client import (
    RedshiftDataApiClient,
    RedshiftDataApiError,
)
from app.schemas.account_360 import (
    Account360Response,
    AccountActivityItem,
    AccountBadge,
    AccountDeviceSummary,
    AccountProductDetailResponse,
    AccountProductSummary,
    AccountProductTransaction,
    AccountProfile,
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
    ft.origin_currency,
    ft.destiny_currency
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
        return build_mock_account_360()

    def get_product_detail(
        self,
        account_id: str,
        product_code: str,
    ) -> Optional[AccountProductDetailResponse]:
        return build_mock_product_detail(product_code)


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
    grouped["tarjeta"] = {
        "code": "tarjeta",
        "label": "Tarjeta",
        "family": "Card",
        "transactions": [],
    }

    for row in rows:
        raw_family = _string_value(row.get("product_family"))
        if raw_family and raw_family.casefold() == "tarjeta":
            continue
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
                origin_currency=_string_value(row.get("origin_currency")),
                destiny_currency=_string_value(row.get("destiny_currency")),
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
