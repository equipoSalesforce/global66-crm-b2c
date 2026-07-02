from typing import Dict, Mapping, Optional

import httpx


class SupabaseRequestError(RuntimeError):
    pass


class SupabaseClient:
    """Minimal read-only client for the Supabase PostgREST API."""

    def __init__(self, url: str, service_role_key: str) -> None:
        self._base_url = f"{url.rstrip('/')}/rest/v1"
        self._headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        }

    def get(
        self,
        resource: str,
        params: Mapping[str, str],
        headers: Optional[Mapping[str, str]] = None,
    ) -> httpx.Response:
        request_headers: Dict[str, str] = dict(self._headers)
        request_headers.update(headers or {})

        try:
            response = httpx.get(
                f"{self._base_url}/{resource}",
                params=params,
                headers=request_headers,
                timeout=10.0,
            )
            response.raise_for_status()
            return response
        except httpx.HTTPError:
            raise SupabaseRequestError("Supabase request failed") from None
