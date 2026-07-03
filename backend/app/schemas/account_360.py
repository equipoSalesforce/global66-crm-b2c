from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AccountProfile(BaseModel):
    account_id: str
    internal_id: Optional[str] = None
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    document: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    customer_type: str
    plan: str
    status: str
    kyc_status: str
    created_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    days_without_activity: Optional[int] = None


class AccountBadge(BaseModel):
    code: str
    label: str
    value: str
    tone: str


class AccountSummaryMetrics(BaseModel):
    total_balance_usd: float
    historical_volume_usd: float
    interactions_count: int
    attachments_count: int


class AccountWallet(BaseModel):
    currency: str
    balance: float
    available_balance: float
    balance_usd: float
    status: str
    updated_at: Optional[datetime] = None


class AccountProductSummary(BaseModel):
    product_code: str
    product_name: str
    summary: str
    volume_usd: float
    active_count: Optional[int] = None
    last_activity_at: Optional[datetime] = None
    status: str
    detail_available: bool = True


class AccountKycHistoryItem(BaseModel):
    event_id: str
    status: str
    description: str
    occurred_at: datetime
    source: str


class AccountActivityItem(BaseModel):
    activity_id: str
    activity_type: str
    title: str
    description: Optional[str] = None
    occurred_at: datetime
    channel: Optional[str] = None
    status: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    product_code: Optional[str] = None


class AccountComplianceSummary(BaseModel):
    risk_level: str
    pep_status: str
    sanctions_status: str
    review_status: str
    last_review_at: Optional[datetime] = None
    next_review_at: Optional[datetime] = None
    notes: List[str] = Field(default_factory=list)


class AccountBankingSummary(BaseModel):
    bank_name: Optional[str] = None
    account_type: Optional[str] = None
    account_number_masked: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    status: str


class AccountBenefitsSummary(BaseModel):
    cashback_balance_usd: float
    accrued_interest_usd: float
    benefits_tier: str
    updated_at: Optional[datetime] = None


class AccountDeviceSummary(BaseModel):
    platform: Optional[str] = None
    app_version: Optional[str] = None
    device_model: Optional[str] = None
    last_login_at: Optional[datetime] = None
    last_ip_country: Optional[str] = None
    security_status: str


class AccountTermsItem(BaseModel):
    terms_code: str
    terms_name: str
    version: str
    status: str
    accepted_at: Optional[datetime] = None


class Account360Response(BaseModel):
    account_id: str
    data_source: str
    profile: AccountProfile
    badges: List[AccountBadge]
    metrics: AccountSummaryMetrics
    wallets: List[AccountWallet]
    products: List[AccountProductSummary]
    kyc_history: List[AccountKycHistoryItem]
    activity: List[AccountActivityItem]
    compliance: AccountComplianceSummary
    banking: AccountBankingSummary
    benefits: AccountBenefitsSummary
    device: AccountDeviceSummary
    terms: List[AccountTermsItem]


class AccountProductDetailResponse(BaseModel):
    account_id: str
    product_code: str
    product_name: str
    status: str
    summary: str
    details: Dict[str, Any]
    recent_activity: List[AccountActivityItem]
    data_source: str
