from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class Customer(BaseModel):
    customer_id: str
    full_name: str
    email: str
    country: str
    segment: str
    status: str


class TransactionalSummary(BaseModel):
    total_transactions: int
    total_volume: float
    currency: str
    last_transaction_at: Optional[datetime]


class ProductUsage(BaseModel):
    active_products: List[str]
    primary_product: str
    activity_level: str


class RecentTransaction(BaseModel):
    transaction_id: str
    occurred_at: datetime
    transaction_type: str
    amount: float
    currency: str
    status: str


class Insights(BaseModel):
    risk_level: str
    engagement: str
    highlights: List[str]


class NextBestAction(BaseModel):
    action: str
    reason: str
    priority: str


class Customer360Summary(BaseModel):
    customer: Customer
    transactional_summary: TransactionalSummary
    product_usage: ProductUsage
    recent_transactions: List[RecentTransaction]
    insights: Insights
    next_best_action: NextBestAction
