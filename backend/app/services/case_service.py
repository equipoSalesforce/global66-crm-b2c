from typing import Optional

from app.repositories.case_repository import CaseRepository, create_case_repository
from app.schemas.case import (
    CaseDetail,
    CaseFilters,
    CaseListResponse,
    CaseSummary,
    PaginationMeta,
)


class CaseService:
    def __init__(self, repository: Optional[CaseRepository] = None) -> None:
        self._repository = repository or create_case_repository()

    def list_cases(self, filters: CaseFilters) -> CaseListResponse:
        cases, total = self._repository.list_cases(filters)
        items = [
            CaseSummary.model_validate(case_item.model_dump()) for case_item in cases
        ]

        return CaseListResponse(
            items=items,
            pagination=PaginationMeta(
                limit=filters.limit,
                offset=filters.offset,
                total=total,
                returned=len(items),
                has_more=filters.offset + len(items) < total,
            ),
        )

    def get_case(self, case_id: str) -> Optional[CaseDetail]:
        return self._repository.get_case_by_id(case_id)
