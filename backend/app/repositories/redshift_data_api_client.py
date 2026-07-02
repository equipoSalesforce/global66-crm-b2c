import time
from typing import Any, Dict, List, Mapping, Optional

import boto3
from botocore.exceptions import (
    BotoCoreError,
    ClientError,
    CredentialRetrievalError,
    NoCredentialsError,
)


class RedshiftDataApiError(RuntimeError):
    pass


class RedshiftDataApiCredentialsError(RedshiftDataApiError):
    pass


class RedshiftDataApiClient:
    TERMINAL_STATUSES = {"FINISHED", "FAILED", "ABORTED"}

    def __init__(
        self,
        region: str,
        cluster_identifier: str,
        database: str,
        secret_arn: Optional[str] = None,
        poll_interval_seconds: float = 0.5,
        timeout_seconds: float = 30.0,
        client: Any = None,
    ) -> None:
        self._region = region
        self._cluster_identifier = cluster_identifier
        self._database = database
        self._secret_arn = secret_arn
        self._poll_interval_seconds = poll_interval_seconds
        self._timeout_seconds = timeout_seconds
        self._client = client

    def execute(
        self,
        sql: str,
        parameters: Optional[List[Mapping[str, str]]] = None,
    ) -> List[Dict[str, Any]]:
        execute_args: Dict[str, Any] = {
            "ClusterIdentifier": self._cluster_identifier,
            "Database": self._database,
            "Sql": sql,
            "Parameters": list(parameters or []),
        }
        if self._secret_arn:
            execute_args["SecretArn"] = self._secret_arn

        try:
            if self._client is None:
                self._client = boto3.client(
                    "redshift-data",
                    region_name=self._region,
                )
            statement_id = self._client.execute_statement(**execute_args).get("Id")
            if not statement_id:
                raise RedshiftDataApiError("Redshift statement id was not returned")

            description = self._wait_for_statement(statement_id)
            if not description.get("HasResultSet", False):
                return []

            return self._get_results(statement_id)
        except (NoCredentialsError, CredentialRetrievalError):
            raise RedshiftDataApiCredentialsError(
                "AWS credentials are not available"
            ) from None
        except (ClientError, BotoCoreError):
            raise RedshiftDataApiError("Redshift Data API request failed") from None

    def _wait_for_statement(self, statement_id: str) -> Mapping[str, Any]:
        deadline = time.monotonic() + self._timeout_seconds

        while time.monotonic() < deadline:
            description = self._client.describe_statement(Id=statement_id)
            statement_status = description.get("Status")

            if statement_status in self.TERMINAL_STATUSES:
                if statement_status != "FINISHED":
                    raise RedshiftDataApiError("Redshift statement did not finish")
                return description

            time.sleep(self._poll_interval_seconds)

        try:
            self._client.cancel_statement(Id=statement_id)
        except (ClientError, BotoCoreError):
            pass
        raise RedshiftDataApiError("Redshift statement timed out")

    def _get_results(self, statement_id: str) -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        next_token: Optional[str] = None

        while True:
            request: Dict[str, str] = {"Id": statement_id}
            if next_token:
                request["NextToken"] = next_token

            response = self._client.get_statement_result(**request)
            columns = [
                column.get("name", f"column_{index}")
                for index, column in enumerate(response.get("ColumnMetadata", []))
            ]
            rows.extend(
                {
                    column: _decode_field(field)
                    for column, field in zip(columns, record)
                }
                for record in response.get("Records", [])
            )

            next_token = response.get("NextToken")
            if not next_token:
                return rows


def _decode_field(field: Mapping[str, Any]) -> Any:
    if field.get("isNull"):
        return None

    for key in (
        "stringValue",
        "longValue",
        "doubleValue",
        "booleanValue",
        "blobValue",
    ):
        if key in field:
            return field[key]

    return None
