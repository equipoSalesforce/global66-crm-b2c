from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CaseCustomer(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class CaseSummary(BaseModel):
    id: str
    case_number: Optional[str] = None
    customer_id: Optional[str] = None
    subject: Optional[str] = None
    status: Optional[str] = None
    lifecycle_status: Optional[str] = None
    routing_status: Optional[str] = None
    priority: Optional[str] = None
    channel: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


class CaseDetail(CaseSummary):
    contact_type: Optional[str] = None
    area: Optional[str] = None
    category: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_at: Optional[datetime] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    resolution_type: Optional[str] = None
    customer: Optional[CaseCustomer] = None


class CaseFilters(BaseModel):
    status: Optional[str] = None
    lifecycle_status: Optional[str] = None
    routing_status: Optional[str] = None
    assigned_agent_id: Optional[str] = None
    customer_id: Optional[str] = None
    channel: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class PaginationMeta(BaseModel):
    limit: int
    offset: int
    total: int
    returned: int
    has_more: bool


class CaseListResponse(BaseModel):
    items: List[CaseSummary]
    pagination: PaginationMeta
