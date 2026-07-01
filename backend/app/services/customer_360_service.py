from datetime import datetime, timedelta, timezone
from typing import Optional

from app.repositories.redshift_repository import RedshiftRepository
from app.schemas.customer_360 import (
    Customer,
    Customer360Summary,
    Insights,
    NextBestAction,
    ProductUsage,
    RecentTransaction,
    TransactionalSummary,
)


class Customer360Service:
    def __init__(self, repository: Optional[RedshiftRepository] = None) -> None:
        self._repository = repository or RedshiftRepository()

    def get_summary(self, customer_id: str) -> Customer360Summary:
        now = datetime.now(timezone.utc)

        return Customer360Summary(
            customer=Customer(
                customer_id=customer_id,
                full_name="Cliente Demo",
                email="demo@example.com",
                country="CL",
                segment="individual",
                status="active",
            ),
            transactional_summary=TransactionalSummary(
                total_transactions=24,
                total_volume=4850.75,
                currency="USD",
                last_transaction_at=now - timedelta(days=2),
            ),
            product_usage=ProductUsage(
                active_products=["global-account", "international-transfers"],
                primary_product="international-transfers",
                activity_level="high",
            ),
            recent_transactions=[
                RecentTransaction(
                    transaction_id="mock-tx-001",
                    occurred_at=now - timedelta(days=2),
                    transaction_type="international-transfer",
                    amount=250.0,
                    currency="USD",
                    status="completed",
                ),
                RecentTransaction(
                    transaction_id="mock-tx-002",
                    occurred_at=now - timedelta(days=10),
                    transaction_type="wallet-top-up",
                    amount=500.0,
                    currency="USD",
                    status="completed",
                ),
            ],
            insights=Insights(
                risk_level="low",
                engagement="high",
                highlights=[
                    "Frequent international transfer usage",
                    "No failed transactions in the last 30 days",
                ],
            ),
            next_best_action=NextBestAction(
                action="Offer scheduled international transfers",
                reason="The customer sends international transfers frequently",
                priority="medium",
            ),
        )
