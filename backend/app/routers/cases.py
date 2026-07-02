from fastapi import APIRouter, Depends, HTTPException, status

from app.repositories.case_repository import CaseRepositoryError
from app.schemas.case import CaseDetail, CaseFilters, CaseListResponse
from app.services.case_service import CaseService

router = APIRouter(prefix="/cases", tags=["cases"])
case_service = CaseService()


@router.get("", response_model=CaseListResponse)
def list_cases(filters: CaseFilters = Depends()) -> CaseListResponse:
    try:
        return case_service.list_cases(filters)
    except CaseRepositoryError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cases data source is temporarily unavailable",
        ) from None


@router.get("/{case_id}", response_model=CaseDetail)
def get_case(case_id: str) -> CaseDetail:
    try:
        case_item = case_service.get_case(case_id)
    except CaseRepositoryError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cases data source is temporarily unavailable",
        ) from None

    if case_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Case not found",
        )

    return case_item
