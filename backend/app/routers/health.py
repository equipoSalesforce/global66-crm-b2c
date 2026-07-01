from typing import Dict

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", response_model=Dict[str, str])
def health_check() -> Dict[str, str]:
    return {
        "status": "ok",
        "service": "global66-crm-b2c-api",
    }
