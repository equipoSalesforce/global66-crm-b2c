from typing import Optional

from app.repositories.account_360_repository import (
    Account360Repository,
    create_account_360_repository,
)
from app.schemas.account_360 import Account360Response, AccountProductDetailResponse


class Account360Service:
    def __init__(self, repository: Optional[Account360Repository] = None) -> None:
        self._repository = repository or create_account_360_repository()

    def get_account_360(self, account_id: str) -> Optional[Account360Response]:
        return self._repository.get_account_360(account_id)

    def get_product_detail(
        self,
        account_id: str,
        product_code: str,
    ) -> Optional[AccountProductDetailResponse]:
        return self._repository.get_product_detail(
            account_id,
            product_code.strip().lower(),
        )
