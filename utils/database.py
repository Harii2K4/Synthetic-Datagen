"""
file: database.py
description: Supabase integration utilities for generation history and dashboard metrics.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from dotenv import load_dotenv

from utils.logger import Logger

log = Logger(__name__)

# Load environment variables from .env for local development/runtime.
load_dotenv()


REQUESTS_TABLE = "dataset_requests"
RESULTS_TABLE = "dataset_results"
LEGACY_JOBS_TABLE = "generation_jobs"
# Backward compatible alias used in some status payloads.
JOBS_TABLE = RESULTS_TABLE

_client: Any = None
_client_init_attempted = False
_client_error: Optional[str] = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _init_client() -> Tuple[Optional[Any], Optional[str]]:
    global _client, _client_init_attempted, _client_error

    if _client_init_attempted:
        return _client, _client_error

    _client_init_attempted = True

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        _client_error = "Missing Supabase env vars. Set SUPABASE_URL and SUPABASE_KEY."
        log.warning(_client_error)
        return None, _client_error

    try:
        # Lazy import to avoid hard-failing startup when dependency is not installed.
        from supabase import create_client  # type: ignore

        _client = create_client(supabase_url, supabase_key)
        _client_error = None
        return _client, None
    except Exception as e:  # pragma: no cover - defensive runtime guard
        _client_error = f"Failed to initialize Supabase client: {e}"
        log.error(_client_error)
        return None, _client_error


def is_database_configured() -> bool:
    client, err = _init_client()
    return client is not None and err is None


def get_database_status() -> Dict[str, Any]:
    _, err = _init_client()
    return {
        "configured": err is None,
        "table": JOBS_TABLE,
        "tables": {
            "requests": REQUESTS_TABLE,
            "results": RESULTS_TABLE,
            "legacy": LEGACY_JOBS_TABLE,
        },
        "error": err,
    }


def _safe_select_rows(
    *,
    client: Any,
    table: str,
    select_expr: str,
    limit: int,
    order_by_created_at: bool = True,
) -> List[Dict[str, Any]]:
    """Best-effort select helper that returns [] when table/query is unavailable."""
    try:
        query = client.table(table).select(select_expr)
        if order_by_created_at:
            query = query.order("created_at", desc=True)
        response = query.range(0, max(limit - 1, 0)).execute()
        return response.data or []
    except Exception as e:
        log.warning(f"Read skipped for table '{table}': {e}")
        return []


def _merge_history_rows(
    primary_rows: List[Dict[str, Any]],
    legacy_rows: List[Dict[str, Any]],
    *,
    offset: int,
    limit: int,
) -> List[Dict[str, Any]]:
    """Merge primary and legacy history rows, dedupe by job_id, sort by created_at desc."""
    dedup: Dict[str, Dict[str, Any]] = {}

    # Primary rows win when job_id exists in both tables.
    for row in legacy_rows:
        job_id = str(row.get("job_id", "")).strip()
        if job_id:
            dedup[job_id] = row
    for row in primary_rows:
        job_id = str(row.get("job_id", "")).strip()
        if job_id:
            dedup[job_id] = row

    merged = list(dedup.values())
    merged.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)
    return merged[offset:offset + limit]


def _is_retryable(stats: Dict[str, Any]) -> bool:
    errors = stats.get("errors", []) or []
    if any(bool(err.get("retryable", False)) for err in errors if isinstance(err, dict)):
        return True
    return stats.get("status") in {"partial", "failure"}


def save_generation_run(
    *,
    job_id: str,
    request_payload: Dict[str, Any],
    stats: Dict[str, Any],
    retried_from_job_id: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    client, err = _init_client()
    if client is None:
        return False, err

    config = request_payload.get("config", {})
    now_iso = _utc_now_iso()

    request_row = {
        "job_id": job_id,
        "retried_from_job_id": retried_from_job_id,
        "dataset_name": config.get("datasetName", ""),
        "persona_config": config.get("personaConfig", []),
        "dataset_size": config.get("datasetSize", 0),
        "generation_model": config.get("generationModel", {}),
        "teacher_model": config.get("teacherModel", {}),
        "request_payload": request_payload,
        "updated_at": now_iso,
        "created_at": now_iso,
    }

    result_row = {
        "job_id": job_id,
        "retried_from_job_id": retried_from_job_id,
        "dataset_name": config.get("datasetName", ""),
        "status": stats.get("status", "failure"),
        "total_splits": stats.get("totalSplits", 0),
        "successful_splits": stats.get("successfulSplits", 0),
        "failed_splits": stats.get("failedSplits", 0),
        "total_rows_requested": stats.get("totalRowsRequested", 0),
        "rows_generated": stats.get("rowsGenerated", 0),
        "rows_failed": stats.get("rowsFailed", 0),
        "dataset_save_location": stats.get("datasetSaveLocation", ""),
        "retryable": _is_retryable(stats),
        "metrics_payload": stats,
        "errors_payload": stats.get("errors", []),
        "updated_at": now_iso,
        "created_at": now_iso,
    }

    try:
        client.table(REQUESTS_TABLE).upsert(request_row, on_conflict="job_id").execute()
        client.table(RESULTS_TABLE).upsert(result_row, on_conflict="job_id").execute()
        return True, None
    except Exception as e:
        message = f"Failed to write generation run to Supabase: {e}"
        log.error(message)
        return False, message


def fetch_generation_history(limit: int = 50, offset: int = 0) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    client, err = _init_client()
    if client is None:
        return [], err

    safe_limit = max(1, min(limit, 2000))
    safe_offset = max(0, offset)
    fetch_count = safe_offset + safe_limit

    try:
        primary_rows = _safe_select_rows(
            client=client,
            table=RESULTS_TABLE,
            select_expr="job_id,dataset_name,status,total_rows_requested,rows_generated,rows_failed,retryable,dataset_save_location,created_at,retried_from_job_id",
            limit=fetch_count,
        )
        legacy_rows = _safe_select_rows(
            client=client,
            table=LEGACY_JOBS_TABLE,
            select_expr="job_id,dataset_name,status,total_rows_requested,rows_generated,rows_failed,retryable,dataset_save_location,created_at,retried_from_job_id",
            limit=fetch_count,
        )
        rows = _merge_history_rows(primary_rows, legacy_rows, offset=safe_offset, limit=safe_limit)
        return rows, None
    except Exception as e:
        message = f"Failed to fetch generation history from Supabase: {e}"
        log.error(message)
        return [], message


def fetch_generation_job(job_id: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    client, err = _init_client()
    if client is None:
        return None, err

    try:
        request_response = (
            client.table(REQUESTS_TABLE)
            .select("job_id,request_payload")
            .eq("job_id", job_id)
            .limit(1)
            .execute()
        )

        result_response = (
            client.table(RESULTS_TABLE)
            .select("job_id,metrics_payload,retryable,status")
            .eq("job_id", job_id)
            .limit(1)
            .execute()
        )

        request_rows = request_response.data or []
        result_rows = result_response.data or []
        if not request_rows:
            return None, None

        payload = request_rows[0]
        if result_rows:
            payload = {
                **payload,
                "metrics_payload": result_rows[0].get("metrics_payload", {}),
                "retryable": result_rows[0].get("retryable", False),
                "status": result_rows[0].get("status", "failure"),
            }
        return payload, None
    except Exception as e:
        log.warning(f"Primary table lookup failed for job {job_id}: {e}")

    # Legacy fallback: older combined-table schema.
    try:
        response = (
            client.table(LEGACY_JOBS_TABLE)
            .select("job_id,request_payload,metrics_payload,retryable,status")
            .eq("job_id", job_id)
            .limit(1)
            .execute()
        )
        rows = response.data or []
        if not rows:
            return None, None
        return rows[0], None
    except Exception as e:
        message = f"Failed to fetch generation job from Supabase: {e}"
        log.error(message)
        return None, message


def fetch_dashboard_summary(limit: int = 500) -> Tuple[Dict[str, Any], Optional[str]]:
    client, err = _init_client()
    if client is None:
        return {}, err

    safe_limit = max(1, min(limit, 2000))

    try:
        primary_rows = _safe_select_rows(
            client=client,
            table=RESULTS_TABLE,
            select_expr="job_id,status,total_rows_requested,rows_generated,rows_failed,retryable,created_at",
            limit=safe_limit,
        )
        legacy_rows = _safe_select_rows(
            client=client,
            table=LEGACY_JOBS_TABLE,
            select_expr="job_id,status,total_rows_requested,rows_generated,rows_failed,retryable,created_at",
            limit=safe_limit,
        )

        merged_rows = _merge_history_rows(primary_rows, legacy_rows, offset=0, limit=safe_limit)

        summary = {
            "totalJobs": len(merged_rows),
            "successJobs": 0,
            "partialJobs": 0,
            "failedJobs": 0,
            "retryableJobs": 0,
            "totalRowsRequested": 0,
            "totalRowsGenerated": 0,
            "totalRowsFailed": 0,
        }

        for row in merged_rows:
            status = row.get("status")
            if status == "success":
                summary["successJobs"] += 1
            elif status == "partial":
                summary["partialJobs"] += 1
            else:
                summary["failedJobs"] += 1

            if bool(row.get("retryable", False)):
                summary["retryableJobs"] += 1

            summary["totalRowsRequested"] += int(row.get("total_rows_requested", 0) or 0)
            summary["totalRowsGenerated"] += int(row.get("rows_generated", 0) or 0)
            summary["totalRowsFailed"] += int(row.get("rows_failed", 0) or 0)

        return summary, None
    except Exception as e:
        message = f"Failed to fetch dashboard summary from Supabase: {e}"
        log.error(message)
        return {}, message


def get_schema_sql() -> str:
    """Return the SQL schema required for Supabase integration."""
    return f"""
create table if not exists public.{REQUESTS_TABLE} (
    id bigserial primary key,
    job_id text unique not null,
    retried_from_job_id text null,
    dataset_name text not null default '',
    persona_config jsonb not null default '[]'::jsonb,
    dataset_size integer not null default 0,
    generation_model jsonb not null default '{{}}'::jsonb,
    teacher_model jsonb not null default '{{}}'::jsonb,
    request_payload jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.{RESULTS_TABLE} (
  id bigserial primary key,
  job_id text unique not null,
  retried_from_job_id text null,
  dataset_name text not null default '',
  status text not null check (status in ('success','partial','failure')),
  total_splits integer not null default 0,
  successful_splits integer not null default 0,
  failed_splits integer not null default 0,
  total_rows_requested integer not null default 0,
  rows_generated integer not null default 0,
  rows_failed integer not null default 0,
  dataset_save_location text not null default '',
  retryable boolean not null default false,
  metrics_payload jsonb not null,
  errors_payload jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint fk_{RESULTS_TABLE}_job_id
        foreign key (job_id)
        references public.{REQUESTS_TABLE}(job_id)
        on delete cascade
);

create index if not exists idx_{REQUESTS_TABLE}_created_at
    on public.{REQUESTS_TABLE}(created_at desc);

create index if not exists idx_{REQUESTS_TABLE}_dataset_name
    on public.{REQUESTS_TABLE}(dataset_name);

create index if not exists idx_{RESULTS_TABLE}_created_at
    on public.{RESULTS_TABLE}(created_at desc);

create index if not exists idx_{RESULTS_TABLE}_status
    on public.{RESULTS_TABLE}(status);

create index if not exists idx_{RESULTS_TABLE}_retryable
    on public.{RESULTS_TABLE}(retryable);
""".strip()
