from datetime import datetime, timezone
from typing import Any, Dict, Optional

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

DEMO_ACCOUNT_ID = "DEMO-CUSTOMER-001"


def build_mock_account_360() -> Account360Response:
    last_activity = datetime(2026, 7, 5, 16, 20, tzinfo=timezone.utc)
    profile = AccountProfile(
        account_id=DEMO_ACCOUNT_ID,
        internal_id=DEMO_ACCOUNT_ID,
        full_name="Cliente Demo Global66",
        email="cliente.demo@global66.com",
        phone="+56912345678",
        country="Chile",
        document="RUT 11.111.111-1",
        document_type="RUT",
        document_number="11.111.111-1",
        username="cliente.demo",
        segment="Premium",
        account_type="Person Account",
        nationality="Chilena",
        kyc_stage_1="Aprobado",
        kyc_stage_2="Aprobado",
        kyc_stage_3="Aprobado",
        compliance_status="Aprobado",
        customer_type="Persona",
        plan="Premium",
        status="Activo",
        kyc_status="Aprobado",
        created_at=datetime(2022, 3, 14, 12, 0, tzinfo=timezone.utc),
        last_activity_at=last_activity,
        days_without_activity=2,
    )
    transactions = _mock_transactions()
    activity = _mock_activity(transactions)

    return Account360Response(
        account_id=DEMO_ACCOUNT_ID,
        data_source="mock",
        profile=profile,
        badges=_mock_badges(profile),
        metrics=AccountSummaryMetrics(
            total_balance_usd=12845.62,
            historical_volume_usd=284930.18,
            interactions_count=47,
            attachments_count=12,
            transactions_count=158,
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
        products=_mock_products(transactions),
        kyc_history=[
            AccountKycHistoryItem(
                event_id="kyc-demo-003",
                status="Aprobado",
                description="Revalidación documental aprobada",
                occurred_at=datetime(2026, 5, 18, 14, 20, tzinfo=timezone.utc),
                source="KYC_PROVIDER",
            ),
            AccountKycHistoryItem(
                event_id="kyc-demo-002",
                status="En revisión",
                description="Actualización de documento de identidad",
                occurred_at=datetime(2026, 5, 17, 11, 5, tzinfo=timezone.utc),
                source="MOBILE_APP",
            ),
            AccountKycHistoryItem(
                event_id="kyc-demo-001",
                status="Aprobado",
                description="Verificación inicial completada",
                occurred_at=datetime(2022, 3, 14, 12, 15, tzinfo=timezone.utc),
                source="KYC_PROVIDER",
            ),
        ],
        activity=activity,
        compliance=AccountComplianceSummary(
            risk_level="Bajo",
            pep_status="No PEP",
            sanctions_status="Sin coincidencias",
            review_status="Aprobado",
            last_review_at=datetime(2026, 5, 18, 14, 20, tzinfo=timezone.utc),
            next_review_at=datetime(2027, 5, 18, 14, 20, tzinfo=timezone.utc),
            notes=["Sin alertas activas", "Perfil transaccional consistente"],
        ),
        banking=AccountBankingSummary(status="VERIFIED"),
        benefits=AccountBenefitsSummary(
            cashback_balance_usd=38.42,
            accrued_interest_usd=12.18,
            benefits_tier="Premium",
            updated_at=last_activity,
        ),
        device=AccountDeviceSummary(
            platform="iOS",
            app_version="8.4.1",
            device_model="Dispositivo demo",
            last_login_at=last_activity,
            last_ip_country="Chile",
            security_status="Confiable",
        ),
        terms=[
            AccountTermsItem(
                terms_code="general_terms",
                terms_name="Términos y condiciones generales",
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
            AccountTermsItem(
                terms_code="card_contract",
                terms_name="Contrato tarjeta Global",
                version="2026.1",
                status="ACCEPTED",
                accepted_at=datetime(2026, 3, 2, 10, 35, tzinfo=timezone.utc),
            ),
            AccountTermsItem(
                terms_code="data_processing",
                terms_name="Consentimiento tratamiento de datos",
                version="2025.2",
                status="ACCEPTED",
                accepted_at=datetime(2025, 11, 18, 9, 20, tzinfo=timezone.utc),
            ),
        ],
    )


def build_mock_product_detail(
    product_code: str,
) -> Optional[AccountProductDetailResponse]:
    account = build_mock_account_360()
    aliases = {
        "remittance": "remesa",
        "payments": "pagos",
        "card": "compras_tarjeta",
        "card_purchases": "compras_tarjeta",
    }
    normalized_code = aliases.get(product_code, product_code)
    product = next(
        (item for item in account.products if item.code == normalized_code),
        None,
    )
    if product is None:
        return None

    recent_activity = [
        item for item in account.activity if item.product_code == normalized_code
    ]
    return AccountProductDetailResponse(
        account_id=DEMO_ACCOUNT_ID,
        product_code=product.code,
        product_name=product.label,
        status="ACTIVE",
        summary=f"{product.movement_count} movimientos",
        details={
            "movement_count": product.movement_count,
            "volume_usd": product.volume_usd,
            "last_transaction_at": product.last_transaction_at,
            "last_activity_at": product.last_activity_at,
            "active_cards_count": product.active_cards_count,
            "own_cards_count": product.own_cards_count,
            "third_party_cards_count": product.third_party_cards_count,
        },
        recent_activity=recent_activity,
        data_source="mock",
    )


def _mock_badges(profile: AccountProfile) -> list[AccountBadge]:
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


def _mock_transactions() -> list[AccountProductTransaction]:
    values = [
        ("TX-DEMO-005", "prod-remesa", "transferencia", "Remesa internacional", datetime(2026, 7, 5, 16, 20, tzinfo=timezone.utc), 1250.0, 1250.0, 1180.0, 1275.4, "USD", "EUR"),
        ("TX-DEMO-004", "prod-exchange", "exchange", "Cambio de divisas", datetime(2026, 7, 3, 11, 10, tzinfo=timezone.utc), 850000.0, 895.2, 895.2, 895.2, "CLP", "USD"),
        ("TX-DEMO-003", "prod-p2p", "P2P", "Transferencia P2P", datetime(2026, 7, 1, 9, 35, tzinfo=timezone.utc), 200.0, 200.0, 200.0, 200.0, "USD", "USD"),
        ("TX-DEMO-002", "prod-pago", "Pago", "Pago de servicio", datetime(2026, 6, 29, 18, 5, tzinfo=timezone.utc), 75.5, 75.5, 75.5, 75.5, "USD", "USD"),
        ("TX-DEMO-001", "prod-card", "Card", "Compra con tarjeta", datetime(2026, 6, 27, 14, 45, tzinfo=timezone.utc), 129.9, 129.9, 129.9, 129.9, "USD", "USD"),
    ]
    return [
        AccountProductTransaction(
            transaction_id=transaction_id,
            product_id=product_id,
            product=product,
            product_family=family,
            transaction_datetime=transaction_datetime,
            customer_id=DEMO_ACCOUNT_ID,
            origin_amount=origin_amount,
            origin_amount_usd=origin_amount_usd,
            destination_amount=destination_amount,
            destination_amount_usd=destination_amount_usd,
            origin_currency=origin_currency,
            destiny_currency=destiny_currency,
        )
        for transaction_id, product_id, family, product, transaction_datetime, origin_amount, origin_amount_usd, destination_amount, destination_amount_usd, origin_currency, destiny_currency in values
    ]


def _mock_products(
    transactions: list[AccountProductTransaction],
) -> list[AccountProductSummary]:
    definitions = [
        ("remesa", "Remesa", "transferencia"),
        ("p2p", "P2P", "P2P"),
        ("exchange", "Exchange", "exchange"),
        ("tarjeta", "Tarjeta", "Card"),
        ("pagos", "Pagos", "Pago"),
        ("compras_tarjeta", "Compras tarjeta", "Card"),
    ]
    products: list[AccountProductSummary] = []
    for code, label, family in definitions:
        product_transactions = (
            []
            if code == "tarjeta"
            else [item for item in transactions if item.product_family == family]
        )
        products.append(
            AccountProductSummary(
                code=code,
                label=label,
                family=family,
                movement_count=len(product_transactions),
                volume_usd=sum(item.origin_amount_usd or 0 for item in product_transactions),
                last_transaction_at=(
                    product_transactions[0].transaction_datetime
                    if product_transactions
                    else None
                ),
                last_activity_at=(
                    datetime(2026, 6, 26, tzinfo=timezone.utc)
                    if code == "tarjeta"
                    else None
                ),
                active_cards_count=5 if code == "tarjeta" else None,
                own_cards_count=3 if code == "tarjeta" else None,
                third_party_cards_count=2 if code == "tarjeta" else None,
                transactions=product_transactions,
            )
        )
    return products


def _mock_activity(
    transactions: list[AccountProductTransaction],
) -> list[AccountActivityItem]:
    code_by_family = {
        "transferencia": "remesa",
        "P2P": "p2p",
        "exchange": "exchange",
        "Pago": "pagos",
        "Card": "compras_tarjeta",
    }
    return [
        AccountActivityItem(
            activity_id=item.transaction_id,
            activity_type="TRANSACTION",
            title=item.product or "Transacción",
            description=_currency_pair(item.origin_currency, item.destiny_currency),
            occurred_at=item.transaction_datetime,
            channel="APP",
            status="COMPLETED",
            amount=item.origin_amount,
            currency=item.origin_currency,
            product_code=code_by_family.get(item.product_family or ""),
        )
        for item in transactions
    ]


def _currency_pair(origin: Optional[str], destiny: Optional[str]) -> Optional[str]:
    values = [value for value in (origin, destiny) if value]
    return "_".join(values) or None
