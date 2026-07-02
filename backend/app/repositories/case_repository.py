from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol, Tuple

from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.repositories.supabase_client import SupabaseClient, SupabaseRequestError
from app.schemas.case import CaseCustomer, CaseDetail, CaseFilters

CASE_SELECT = (
    "id,case_number,customer_id,subject,status,lifecycle_status,routing_status,"
    "priority,channel,assigned_agent_id,created_at,updated_at,closed_at,"
    "contact_type,area,category,assigned_to,assigned_at,contact_name,"
    "contact_email,contact_phone,resolution_type,"
    "customer:customers(name,email,phone)"
)


class CaseRepositoryError(RuntimeError):
    pass


class CaseRepository(Protocol):
    def list_cases(self, filters: CaseFilters) -> Tuple[List[CaseDetail], int]:
        ...

    def get_case_by_id(self, case_id: str) -> Optional[CaseDetail]:
        ...


class MockCaseRepository:
    """Local read repository that requires no database credentials."""

    def __init__(self) -> None:
        self._cases = _build_mock_cases()

    def list_cases(self, filters: CaseFilters) -> Tuple[List[CaseDetail], int]:
        filtered = [
            case_item
            for case_item in self._cases
            if _matches_filters(case_item, filters)
        ]
        filtered.sort(
            key=lambda case_item: case_item.created_at
            or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

        total = len(filtered)
        page = filtered[filters.offset : filters.offset + filters.limit]
        return page, total

    def get_case_by_id(self, case_id: str) -> Optional[CaseDetail]:
        return next(
            (case_item for case_item in self._cases if case_item.id == case_id),
            None,
        )


class SupabaseCaseRepository:
    def __init__(self, client: SupabaseClient) -> None:
        self._client = client

    def list_cases(self, filters: CaseFilters) -> Tuple[List[CaseDetail], int]:
        params = _build_supabase_filters(filters)
        params.update(
            {
                "select": CASE_SELECT,
                "order": "created_at.desc.nullslast",
                "limit": str(filters.limit),
                "offset": str(filters.offset),
            }
        )

        try:
            response = self._client.get(
                "cases",
                params=params,
                headers={"Prefer": "count=exact"},
            )
            rows = response.json()
            if not isinstance(rows, list):
                raise CaseRepositoryError("Invalid Supabase response")

            cases = [_map_supabase_case(row) for row in rows]
            total = _parse_total(response.headers.get("content-range"), cases, filters)
            return cases, total
        except (SupabaseRequestError, ValueError, TypeError, ValidationError):
            raise CaseRepositoryError("Unable to read cases") from None

    def get_case_by_id(self, case_id: str) -> Optional[CaseDetail]:
        try:
            response = self._client.get(
                "cases",
                params={
                    "select": CASE_SELECT,
                    "id": f"eq.{case_id}",
                    "limit": "1",
                },
            )
            rows = response.json()
            if not isinstance(rows, list):
                raise CaseRepositoryError("Invalid Supabase response")
            if not rows:
                return None

            return _map_supabase_case(rows[0])
        except (SupabaseRequestError, ValueError, TypeError, ValidationError):
            raise CaseRepositoryError("Unable to read case") from None


def create_case_repository(settings: Optional[Settings] = None) -> CaseRepository:
    resolved_settings = settings or get_settings()

    if resolved_settings.cases_use_mock_data or not resolved_settings.has_supabase_credentials:
        return MockCaseRepository()

    service_role_key = resolved_settings.supabase_service_role_key
    if service_role_key is None or resolved_settings.supabase_url is None:
        return MockCaseRepository()

    return SupabaseCaseRepository(
        SupabaseClient(
            url=resolved_settings.supabase_url,
            service_role_key=service_role_key.get_secret_value(),
        )
    )


def _build_supabase_filters(filters: CaseFilters) -> Dict[str, str]:
    filter_values = {
        "status": filters.status,
        "lifecycle_status": filters.lifecycle_status,
        "routing_status": filters.routing_status,
        "assigned_agent_id": filters.assigned_agent_id,
        "customer_id": filters.customer_id,
        "channel": filters.channel,
    }
    return {
        field_name: f"eq.{value}"
        for field_name, value in filter_values.items()
        if value is not None
    }


def _map_supabase_case(row: Any) -> CaseDetail:
    if not isinstance(row, dict) or row.get("id") is None:
        raise CaseRepositoryError("Invalid case record")

    data = dict(row)
    data["id"] = str(data["id"])
    for field_name in ("case_number", "customer_id", "assigned_agent_id"):
        if data.get(field_name) is not None:
            data[field_name] = str(data[field_name])

    customer = data.get("customer")
    if isinstance(customer, list):
        data["customer"] = customer[0] if customer else None
    elif customer is not None and not isinstance(customer, dict):
        data["customer"] = None

    return CaseDetail.model_validate(data)


def _parse_total(
    content_range: Optional[str],
    cases: List[CaseDetail],
    filters: CaseFilters,
) -> int:
    if content_range and "/" in content_range:
        total_value = content_range.rsplit("/", 1)[-1]
        if total_value.isdigit():
            return int(total_value)

    return filters.offset + len(cases)


def _matches_filters(case_item: CaseDetail, filters: CaseFilters) -> bool:
    filter_values = {
        "status": filters.status,
        "lifecycle_status": filters.lifecycle_status,
        "routing_status": filters.routing_status,
        "assigned_agent_id": filters.assigned_agent_id,
        "customer_id": filters.customer_id,
        "channel": filters.channel,
    }

    return all(
        expected is None or getattr(case_item, field_name) == expected
        for field_name, expected in filter_values.items()
    )


def _build_mock_cases() -> List[CaseDetail]:
    return [
        CaseDetail(
            id="demo-case-001",
            case_number="100001",
            customer_id="demo-customer",
            subject="Transferencia internacional pendiente",
            status="ASSIGNED",
            lifecycle_status="OPEN",
            routing_status="ASSIGNED",
            priority="HIGH",
            channel="WHATSAPP",
            assigned_agent_id="demo-agent-001",
            created_at=datetime(2026, 6, 25, 13, 30, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 30, 16, 45, tzinfo=timezone.utc),
            contact_type="WHATSAPP",
            area="OPERACIONES",
            category="PAGOS",
            assigned_to="Agente Demo",
            assigned_at=datetime(2026, 6, 25, 13, 35, tzinfo=timezone.utc),
            contact_name="Cliente Demo",
            contact_email="demo@example.com",
            contact_phone="+56900000000",
            customer=CaseCustomer(
                name="Cliente Demo",
                email="demo@example.com",
                phone="+56900000000",
            ),
        ),
        CaseDetail(
            id="demo-case-002",
            case_number="100002",
            customer_id="demo-customer-002",
            subject="Consulta sobre cuenta global",
            status="HUMAN_REQUIRED",
            lifecycle_status="OPEN",
            routing_status="UNASSIGNED",
            priority="MEDIUM",
            channel="WEB",
            created_at=datetime(2026, 6, 28, 10, 15, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 28, 10, 15, tzinfo=timezone.utc),
            contact_type="WEB",
            area="SOPORTE",
            category="CONSULTA",
            contact_name="Cliente Web Demo",
            contact_email="web-demo@example.com",
            customer=CaseCustomer(
                name="Cliente Web Demo",
                email="web-demo@example.com",
            ),
        ),
        CaseDetail(
            id="demo-case-003",
            case_number="100003",
            customer_id="demo-customer-003",
            subject="Caso resuelto de acceso",
            status="CLOSED",
            lifecycle_status="CLOSED",
            routing_status="ASSIGNED",
            priority="LOW",
            channel="GMAIL",
            assigned_agent_id="demo-agent-002",
            created_at=datetime(2026, 6, 20, 9, 0, tzinfo=timezone.utc),
            updated_at=datetime(2026, 6, 22, 12, 0, tzinfo=timezone.utc),
            closed_at=datetime(2026, 6, 22, 12, 0, tzinfo=timezone.utc),
            contact_type="GMAIL",
            area="SOPORTE",
            category="ACCESO",
            assigned_to="Agente Demo 2",
            assigned_at=datetime(2026, 6, 20, 9, 5, tzinfo=timezone.utc),
            contact_name="Cliente Email Demo",
            contact_email="email-demo@example.com",
            resolution_type="HUMAN_RESOLVED",
            customer=CaseCustomer(
                name="Cliente Email Demo",
                email="email-demo@example.com",
            ),
        ),
    ]
