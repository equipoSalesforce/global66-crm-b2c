from fastapi import APIRouter

from app.schemas.customer_360 import Customer360Summary
from app.services.customer_360_service import Customer360Service

router = APIRouter(prefix="/customers", tags=["customers"])
customer_360_service = Customer360Service()


@router.get("/{customer_id}/summary", response_model=Customer360Summary)
def get_customer_summary(customer_id: str) -> Customer360Summary:
    return customer_360_service.get_summary(customer_id)
