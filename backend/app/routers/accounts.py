from fastapi import APIRouter, HTTPException, status

from app.repositories.account_360_repository import Account360RepositoryError
from app.schemas.account_360 import Account360Response, AccountProductDetailResponse
from app.services.account_360_service import Account360Service

router = APIRouter(prefix="/accounts", tags=["accounts"])
account_360_service = Account360Service()


@router.get("/{account_id}/360", response_model=Account360Response)
def get_account_360(account_id: str) -> Account360Response:
    try:
        account = account_360_service.get_account_360(account_id)
    except Account360RepositoryError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Account data source is temporarily unavailable",
        ) from None

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    return account


@router.get(
    "/{account_id}/products/{product_code}",
    response_model=AccountProductDetailResponse,
)
def get_account_product_detail(
    account_id: str,
    product_code: str,
) -> AccountProductDetailResponse:
    product = account_360_service.get_product_detail(account_id, product_code)
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account product not found",
        )
    return product
