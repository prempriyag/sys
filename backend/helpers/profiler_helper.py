"""
Profiler helper - FastAPI version of CI3 MY_Profiler
Tracks request timing, database queries, and provides debugging info for authorized users.
Uses contextvars for thread-safe per-request tracking.

Controlled by ENABLE_PROFILING env var (matches CI3 $config['enable_profiler']).
When ENABLE_PROFILING=False, **no profiling logic runs** - zero overhead in production.
"""
import time
import logging
import functools
from typing import Optional, Dict, Any, List, Callable
from contextlib import contextmanager
from contextvars import ContextVar
from collections import defaultdict
from sqlalchemy import event
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Read config once at import time
# ---------------------------------------------------------------------------
try:
    from config.settings import settings as _settings
    PROFILING_ENABLED: bool = getattr(_settings, "ENABLE_PROFILING", True)
except Exception:
    PROFILING_ENABLED = False

# ---------------------------------------------------------------------------
# Context variable for per-request profiler data (thread-safe)
# ---------------------------------------------------------------------------
_current_profiler: ContextVar[Optional['ProfilerData']] = ContextVar('current_profiler', default=None)

# Session-based profiler storage (matches CI3 session behaviour - stores last request's data)
_session_profiler_data: Dict[str, Dict[str, Any]] = {}

# Per-user list of all recent request profiles (for "Request Profiles" tab)
_user_request_profiles: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

# Max requests to keep per user
MAX_REQUESTS_PER_USER = 50


# ============================================================================
# ProfilerData - per-request data container
# ============================================================================
class ProfilerData:
    """Per-request profiler data storage."""

    def __init__(self):
        self.enabled = True
        self.start_time: float = time.time()
        self.end_time: Optional[float] = None
        self.queries: List[Dict[str, Any]] = []
        self.benchmarks: Dict[str, float] = {}
        self.function_profiles: List[Dict[str, Any]] = []
        self.uri: str = ""
        self.method: str = ""
        self.user_id: Optional[int] = None
        self.is_ajax: bool = False
        self.status_code: int = 200

    # -- mutators --
    def add_query(self, statement: str, parameters: Any, duration: float):
        self.queries.append({
            "statement": str(statement)[:2000],
            "parameters": str(parameters)[:500] if parameters else None,
            "duration_ms": round(duration * 1000, 2),
        })

    def add_benchmark(self, name: str, duration: float):
        self.benchmarks[name] = round(duration * 1000, 2)

    def add_function_profile(self, name: str, duration: float):
        self.function_profiles.append({
            "name": name,
            "duration_ms": round(duration * 1000, 2),
        })

    def finish(self, status_code: int = 200):
        self.end_time = time.time()
        self.status_code = status_code

    # -- computed --
    def get_total_time_ms(self) -> float:
        end = self.end_time or time.time()
        return round((end - self.start_time) * 1000, 2)

    def get_total_query_time_ms(self) -> float:
        return round(sum(q.get('duration_ms', 0) for q in self.queries), 2)

    # -- serialisation --
    def get_data(self) -> Dict[str, Any]:
        """Legacy CI3-style profiler sections (used in Last Request tab)."""
        total_time = self.get_total_time_ms()
        total_query_time = self.get_total_query_time_ms()

        query_data = []
        for i, q in enumerate(self.queries, 1):
            stmt_clean = ' '.join(q.get('statement', '').split())[:200]
            query_data.append({
                "label": f"[{i}] {stmt_clean}",
                "value": f"{q.get('duration_ms', 0)} ms",
            })
        if not query_data:
            query_data = [{"label": "No queries executed", "value": ""}]

        # Build benchmark rows
        benchmark_rows = [
            {"label": "Total Execution Time", "value": f"{total_time} ms"},
            {"label": "Total Query Time", "value": f"{total_query_time} ms"},
            {"label": "Python Time", "value": f"{round(total_time - total_query_time, 2)} ms"},
            {"label": "Query Count", "value": str(len(self.queries))},
        ]
        for name, dur in self.benchmarks.items():
            benchmark_rows.append({"label": name, "value": f"{dur} ms"})
        for fp in self.function_profiles:
            benchmark_rows.append({"label": f"fn: {fp['name']}", "value": f"{fp['duration_ms']} ms"})

        return {
            "CLASS/METHOD": [
                {"label": "URI", "value": f"{self.method} {self.uri}"},
            ],
            "BENCHMARKS": benchmark_rows,
            f"DATABASE ({len(self.queries)} queries)": query_data,
        }

    def get_request_profile(self) -> Dict[str, Any]:
        """Detailed request profile (used in Request Profiles tab)."""
        total_time = self.get_total_time_ms()
        total_query_time = self.get_total_query_time_ms()

        queries = []
        for i, q in enumerate(self.queries, 1):
            queries.append({
                "index": i,
                "sql": ' '.join(q.get('statement', '').split()),
                "parameters": q.get('parameters'),
                "duration_ms": q.get('duration_ms', 0),
            })

        functions = []
        for fp in self.function_profiles:
            functions.append({
                "name": fp["name"],
                "duration_ms": fp["duration_ms"],
            })

        return {
            "uri": self.uri,
            "method": self.method,
            "status_code": self.status_code,
            "timestamp": self.start_time,
            "total_time_ms": total_time,
            "total_query_time_ms": total_query_time,
            "python_time_ms": round(total_time - total_query_time, 2),
            "query_count": len(self.queries),
            "queries": queries,
            "functions": functions,
        }


# ============================================================================
# Public API - request lifecycle
# ============================================================================
def get_current_profiler() -> Optional[ProfilerData]:
    if not PROFILING_ENABLED:
        return None
    return _current_profiler.get()


def start_request_profiler(uri: str, method: str, is_ajax: bool = False, user_id: Optional[int] = None) -> Optional[ProfilerData]:
    """Start profiling for a new request. Returns None when profiling disabled."""
    if not PROFILING_ENABLED:
        return None
    profiler = ProfilerData()
    profiler.uri = uri
    profiler.method = method
    profiler.is_ajax = is_ajax
    profiler.user_id = user_id
    _current_profiler.set(profiler)
    return profiler


def end_request_profiler(user_id: Optional[int] = None, status_code: int = 200) -> Optional[float]:
    """End profiling for the current request and store data.
    Returns the total request time in ms (for X-Process-Time-ms header), or None.
    """
    if not PROFILING_ENABLED:
        return None
    profiler = _current_profiler.get()
    if not profiler:
        return None

    profiler.finish(status_code)
    total_ms = profiler.get_total_time_ms()

    uid = user_id or profiler.user_id
    if uid:
        session_id = str(uid)
        store_profiler_data(session_id, profiler.is_ajax, profiler.get_data())
        if not profiler.uri.startswith("/api/profiler"):
            store_request_profile(session_id, profiler.get_request_profile())

    # Log request summary
    query_count = len(profiler.queries)
    query_time = profiler.get_total_query_time_ms()
    logger.info(
        f"[PROFILER] {profiler.method} {profiler.uri} | "
        f"{status_code} | {total_ms:.1f}ms total | "
        f"{query_time:.1f}ms db ({query_count} queries) | "
        f"{round(total_ms - query_time, 1)}ms python"
    )

    _current_profiler.set(None)
    return total_ms


# ============================================================================
# Storage helpers
# ============================================================================
def store_profiler_data(session_id: str, is_ajax: bool, data: Dict[str, Any]):
    key = f"ajax_{session_id}" if is_ajax else f"page_{session_id}"
    _session_profiler_data[key] = {"data": data, "timestamp": time.time()}
    if len(_session_profiler_data) > 100:
        sorted_keys = sorted(
            _session_profiler_data.keys(),
            key=lambda k: _session_profiler_data[k].get('timestamp', 0),
        )
        for k in sorted_keys[:50]:
            del _session_profiler_data[k]


def store_request_profile(session_id: str, profile_data: Dict[str, Any]):
    profiles = _user_request_profiles[session_id]
    profiles.insert(0, profile_data)
    if len(profiles) > MAX_REQUESTS_PER_USER:
        _user_request_profiles[session_id] = profiles[:MAX_REQUESTS_PER_USER]


def get_all_stored_requests(session_id: str) -> List[Dict[str, Any]]:
    return _user_request_profiles.get(session_id, [])


def clear_stored_requests(session_id: str):
    _user_request_profiles[session_id] = []


def get_stored_profiler_data(session_id: str, is_ajax: bool = False) -> Optional[Dict[str, Any]]:
    key = f"ajax_{session_id}" if is_ajax else f"page_{session_id}"
    stored = _session_profiler_data.get(key)
    return stored.get("data") if stored else None


# ============================================================================
# Auth check
# ============================================================================
def is_ktech_user(email: str) -> bool:
    """Check if user is a KTech user (authorized for profiler).
    Matches CI3 checkemailktech()."""
    if not email:
        return False
    email_lower = email.lower()
    return email_lower.endswith('@ktechproducts.com') or email_lower.endswith('@ktech.com')


# ============================================================================
# @profile_function decorator
# ============================================================================
def profile_function(func: Callable) -> Callable:
    """Decorator to measure execution time of a function.

    When profiling is enabled, records the function duration in the current
    request's profiler data AND logs it.  When disabled, the decorator is a
    transparent no-op (zero overhead).

    Usage::

        @profile_function
        def heavy_computation(data):
            ...

        # Also works on async functions
        @profile_function
        async def fetch_external_api():
            ...
    """
    if not PROFILING_ENABLED:
        return func  # no-op wrapper

    import asyncio

    if asyncio.iscoroutinefunction(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start = time.time()
            try:
                return await func(*args, **kwargs)
            finally:
                duration = time.time() - start
                profiler = _current_profiler.get()
                if profiler:
                    profiler.add_function_profile(func.__qualname__, duration)
                if duration > 0.5:
                    logger.warning(f"[PROFILER] Slow function {func.__qualname__}: {duration*1000:.1f}ms")
                else:
                    logger.debug(f"[PROFILER] {func.__qualname__}: {duration*1000:.1f}ms")
        return async_wrapper
    else:
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            start = time.time()
            try:
                return func(*args, **kwargs)
            finally:
                duration = time.time() - start
                profiler = _current_profiler.get()
                if profiler:
                    profiler.add_function_profile(func.__qualname__, duration)
                if duration > 0.5:
                    logger.warning(f"[PROFILER] Slow function {func.__qualname__}: {duration*1000:.1f}ms")
                else:
                    logger.debug(f"[PROFILER] {func.__qualname__}: {duration*1000:.1f}ms")
        return sync_wrapper


# ============================================================================
# profile_block context manager
# ============================================================================
@contextmanager
def profile_block(name: str):
    """Context manager for profiling a code block.

    Usage::

        with profile_block("heavy_section"):
            do_work()
    """
    if not PROFILING_ENABLED:
        yield
        return
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        profiler = _current_profiler.get()
        if profiler:
            profiler.add_benchmark(name, duration)


# ============================================================================
# SQLAlchemy query event tracking
# ============================================================================
_query_contexts: Dict[int, float] = {}


def setup_query_profiling(engine: Engine):
    """Setup SQLAlchemy event listeners for query profiling.
    Only attaches listeners when ENABLE_PROFILING=True.
    """
    if not PROFILING_ENABLED:
        logger.info("[PROFILER] Profiling DISABLED - no query listeners attached")
        return

    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        _query_contexts[id(cursor)] = time.time()

    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        cursor_id = id(cursor)
        start_time = _query_contexts.pop(cursor_id, None)
        if start_time is None:
            return

        duration = time.time() - start_time
        duration_ms = duration * 1000

        # Add to current request's profiler
        profiler = _current_profiler.get()
        if profiler:
            profiler.add_query(statement, parameters, duration)

        # Log slow queries (> 1 second)
        if duration > 1.0:
            logger.warning(f"[PROFILER] Slow query ({duration_ms:.1f}ms): {statement[:200]}")

    logger.info("[PROFILER] Profiling ENABLED - SQLAlchemy query listeners attached")
