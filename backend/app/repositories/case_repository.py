from datetime import datetime, timezone
from typing import List, Optional, Protocol, Tuple

from app.schemas.case import CaseCustomer, CaseDetail, CaseFilters


class CaseRepository(Protocol):
    def list(self, filters: CaseFilters) -> Tuple[List[CaseDetail], int]:
        ...

    def get_by_id(self, case_id: str) -> Optional[CaseDetail]:
        ...


class MockCaseRepository:
    """Local read repository that requires no database credentials."""

    def __init__(self) -> None:
        self._cases = _build_mock_cases()

    def list(self, filters: CaseFilters) -> Tuple[List[CaseDetail], int]:
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

    def get_by_id(self, case_id: str) -> Optional[CaseDetail]:
        return next(
            (case_item for case_item in self._cases if case_item.id == case_id),
            None,
        )


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
