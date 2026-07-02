from datetime import datetime, timezone
from typing import Any, Dict, Optional, Protocol, Sequence

from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.repositories.redshift_data_api_client import (
    RedshiftDataApiClient,
    RedshiftDataApiCredentialsError,
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
    AccountProfile,
    AccountSummaryMetrics,
    AccountTermsItem,
    AccountWallet,
)

CUSTOMER_TABLE = "customer.customer"
CUSTOMER_ID_COLUMN = "customer_id"

# Candidate names must be confirmed against customer.customer before production use.
CUSTOMER_COLUMN_MAP = {
    "full_name": ("full_name", "name", "customer_name"),
    "email": ("email", "email_address"),
    "phone": ("phone", "phone_number"),
    "country": ("country", "country_code"),
    "customer_type": ("customer_type", "person_type"),
    "plan": ("plan", "plan_name"),
    "status": ("status", "customer_status"),
    "kyc_status": ("kyc_status", "verification_status"),
    "created_at": ("created_at", "creation_date"),
    "last_activity_at": ("last_activity_at", "last_transaction_at"),
}

SUPPORTED_PRODUCT_CODES = {
    "remittance",
    "p2p",
    "exchange",
    "card",
    "payments",
    "card_purchases",
}


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
        sql = (
            f"SELECT * FROM {CUSTOMER_TABLE} "
            f"WHERE {CUSTOMER_ID_COLUMN} = :account_id LIMIT 1"
        )

        try:
            rows = self._client.execute(
                sql,
                parameters=[{"name": "account_id", "value": account_id}],
            )
        except RedshiftDataApiCredentialsError:
            return self._mock_repository.get_account_360(account_id)
        except RedshiftDataApiError:
            raise Account360RepositoryError(
                "Account data source is unavailable"
            ) from None

        if not rows:
            return None

        try:
            response = self._mock_repository.get_account_360(account_id)
            response.profile = _map_customer_profile(
                account_id,
                rows[0],
                response.profile,
            )
            response.badges = _profile_badges(response.profile)
            response.data_source = "redshift_partial"
            return response
        except (TypeError, ValueError, ValidationError):
            raise Account360RepositoryError("Customer mapping failed") from None

    def get_product_detail(
        self,
        account_id: str,
        product_code: str,
    ) -> Optional[AccountProductDetailResponse]:
        return self._mock_repository.get_product_detail(account_id, product_code)


def create_account_360_repository(
    settings: Optional[Settings] = None,
) -> Account360Repository:
    resolved_settings = settings or get_settings()
    if (
        resolved_settings.account_360_use_mock_data
        or not resolved_settings.has_redshift_data_api_config
    ):
        return MockAccount360Repository()

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
    profile = fallback.model_dump()
    profile.update(
        {
            "account_id": account_id,
            "full_name": f"Cuenta {account_id}",
            "email": None,
            "phone": None,
            "country": None,
            "customer_type": "UNKNOWN",
            "plan": "UNKNOWN",
            "status": "UNKNOWN",
            "kyc_status": "UNKNOWN",
            "created_at": None,
            "last_activity_at": None,
            "days_without_activity": None,
        }
    )

    for target, candidates in CUSTOMER_COLUMN_MAP.items():
        value = _first_present(row, candidates)
        if value is not None:
            profile[target] = value

    if not _first_present(row, CUSTOMER_COLUMN_MAP["full_name"]):
        first_name = _first_present(row, ("first_name", "given_name"))
        last_name = _first_present(row, ("last_name", "family_name"))
        combined_name = " ".join(
            str(value).strip() for value in (first_name, last_name) if value
        )
        if combined_name:
            profile["full_name"] = combined_name

    return AccountProfile.model_validate(profile)


def _first_present(row: Dict[str, Any], candidates: Sequence[str]) -> Any:
    return next(
        (row[name] for name in candidates if name in row and row[name] is not None),
        None,
    )


def _profile_badges(profile: AccountProfile) -> list[AccountBadge]:
    return [
        AccountBadge(code="kyc", label="KYC", value=profile.kyc_status, tone="success"),
        AccountBadge(
            code="compliance",
            label="Compliance",
            value="Aprobado",
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
        ("remittance", "Remesa", "Transferencias internacionales", 82450.30, 18, "ACTIVE"),
        ("p2p", "P2P", "Envíos entre usuarios", 12480.00, 9, "ACTIVE"),
        ("exchange", "Exchange", "Operaciones de cambio", 96300.75, 31, "ACTIVE"),
        ("card", "Tarjeta", "Tarjeta física y virtual", 43620.42, 2, "ACTIVE"),
        ("payments", "Pagos", "Pagos de servicios y comercios", 18940.11, 14, "ACTIVE"),
        ("card_purchases", "Compras tarjeta", "Compras nacionales e internacionales", 31138.60, 76, "ACTIVE"),
    ]
    return [
        AccountProductSummary(
            product_code=code,
            product_name=name,
            summary=summary,
            volume_usd=volume,
            active_count=count,
            last_activity_at=datetime(2026, 6, 29, 15, 40, tzinfo=timezone.utc),
            status=status,
        )
        for code, name, summary, volume, count, status in values
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
    if product_code not in SUPPORTED_PRODUCT_CODES:
        return None

    summary = next(
        product for product in _mock_products() if product.product_code == product_code
    )
    details_by_product: Dict[str, Dict[str, Any]] = {
        "remittance": {
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
        "card": {
            "physical_card_status": "ACTIVE",
            "virtual_card_status": "ACTIVE",
            "monthly_limit_usd": 5000,
        },
        "payments": {
            "saved_services": 6,
            "scheduled_payments": 2,
            "successful_payments": 14,
        },
        "card_purchases": {
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
        product_code=product_code,
        product_name=summary.product_name,
        status=summary.status,
        summary=summary.summary,
        details=details_by_product[product_code],
        recent_activity=activity,
        data_source="mock",
    )
