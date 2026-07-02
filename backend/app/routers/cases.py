from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.case import CaseDetail, CaseFilters, CaseListResponse
from app.services.case_service import CaseService

router = APIRouter(prefix="/cases", tags=["cases"])
case_service = CaseService()


@router.get("", response_model=CaseListResponse)
def list_cases(filters: CaseFilters = Depends()) -> CaseListResponse:
    return case_service.list_cases(filters)


@router.get("/{case_id}", response_model=CaseDetail)
def get_case(case_id: str) -> CaseDetail:
    case_item = case_service.get_case(case_id)

    if case_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    return case_item
