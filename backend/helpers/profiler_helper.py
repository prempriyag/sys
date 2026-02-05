"""
Profiler helper - FastAPI version of CI3 MY_Profiler
Tracks request timing, database queries, and provides debugging info for authorized users
"""
import time
import logging
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
from sqlalchemy import event
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


class ProfilerData:
    """Thread-local storage for profiler data during request lifecycle."""
    
    def __init__(self):
        self.enabled = False
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.queries: List[Dict[str, Any]] = []
        self.benchmarks: Dict[str, float] = {}
        self.uri: str = ""
        self.method: str = ""
        
    def reset(self):
        """Reset profiler data for new request."""
        self.start_time = time.time()
        self.end_time = None
        self.queries = []
        self.benchmarks = {}
        self.uri = ""
        self.method = ""
    
    def add_query(self, statement: str, parameters: Any, duration: float):
        """Add a query to the profiler."""
        if self.enabled:
            self.queries.append({
                "statement": str(statement)[:500],  # Truncate long queries
                "parameters": str(parameters)[:200] if parameters else None,
                "duration_ms": round(duration * 1000, 2)
            })
    
    def add_benchmark(self, name: str, duration: float):
        """Add a benchmark timing."""
        if self.enabled:
            self.benchmarks[name] = round(duration * 1000, 2)
    
    def finish(self):
        """Mark request as finished."""
        self.end_time = time.time()
    
    def get_data(self) -> Dict[str, Any]:
        """Get compiled profiler data."""
        total_time = (self.end_time or time.time()) - (self.start_time or time.time())
        
        # Calculate total query time
        total_query_time = sum(q.get('duration_ms', 0) for q in self.queries)
        
        return {
            "CLASS/METHOD": [{"label": "URI", "value": f"{self.method} {self.uri}"}],
            "BENCHMARKS": [
                {"label": "Total Execution Time", "value": f"{round(total_time * 1000, 2)} ms"},
                {"label": "Total Query Time", "value": f"{total_query_time} ms"},
            ],
            f"DATABASE ({len(self.queries)} queries)": [
                {"label": q.get('statement', ''), "value": f"{q.get('duration_ms', 0)} ms"} 
                for q in self.queries
            ] if self.queries else [{"label": "No queries executed", "value": ""}]
        }


# Global profiler data (per-request, thread-local in production would use contextvars)
_profiler_data: Dict[int, ProfilerData] = {}


def get_profiler_for_request(request_id: int) -> ProfilerData:
    """Get or create profiler data for a request."""
    if request_id not in _profiler_data:
        _profiler_data[request_id] = ProfilerData()
    return _profiler_data[request_id]


def cleanup_profiler_for_request(request_id: int):
    """Cleanup profiler data after request."""
    if request_id in _profiler_data:
        del _profiler_data[request_id]


# Session-based profiler storage (matches CI3 behavior)
_session_profiler_data: Dict[str, Dict[str, Any]] = {}


def store_profiler_data(session_id: str, is_ajax: bool, data: Dict[str, Any]):
    """Store profiler data in session storage (matches CI3 session behavior)."""
    key = f"ajax_{session_id}" if is_ajax else f"page_{session_id}"
    _session_profiler_data[key] = data
    
    # Keep only last 100 entries to prevent memory leak
    if len(_session_profiler_data) > 100:
        oldest_keys = list(_session_profiler_data.keys())[:50]
        for k in oldest_keys:
            del _session_profiler_data[k]


def get_stored_profiler_data(session_id: str, is_ajax: bool = False) -> Optional[Dict[str, Any]]:
    """Get stored profiler data for a session."""
    key = f"ajax_{session_id}" if is_ajax else f"page_{session_id}"
    return _session_profiler_data.get(key)


def is_ktech_user(email: str) -> bool:
    """Check if user is a KTech user (authorized for profiler).
    Matches CI3 checkemailktech() function."""
    if not email:
        return False
    email_lower = email.lower()
    return email_lower.endswith('@ktechproducts.com') or email_lower.endswith('@ktech.com')


# SQLAlchemy query event listener for profiling
_query_start_times: Dict[int, float] = {}


def setup_query_profiling(engine: Engine):
    """Setup SQLAlchemy event listeners for query profiling."""
    
    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        conn_id = id(conn)
        _query_start_times[conn_id] = time.time()
    
    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        conn_id = id(conn)
        start_time = _query_start_times.pop(conn_id, None)
        if start_time:
            duration = time.time() - start_time
            # Log slow queries
            if duration > 1.0:  # > 1 second
                logger.warning(f"Slow query ({duration:.2f}s): {statement[:200]}")


@contextmanager
def profile_block(name: str, profiler: Optional[ProfilerData] = None):
    """Context manager for profiling a code block."""
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        if profiler:
            profiler.add_benchmark(name, duration)
