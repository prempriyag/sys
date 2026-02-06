"""
Profiler helper - FastAPI version of CI3 MY_Profiler
Tracks request timing, database queries, and provides debugging info for authorized users
Uses contextvars for thread-safe per-request tracking
"""
import time
import logging
from typing import Optional, Dict, Any, List
from contextlib import contextmanager
from contextvars import ContextVar
from sqlalchemy import event
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)

# Context variable for per-request profiler data (thread-safe)
_current_profiler: ContextVar[Optional['ProfilerData']] = ContextVar('current_profiler', default=None)

# Session-based profiler storage (matches CI3 behavior - stores last request's data)
_session_profiler_data: Dict[str, Dict[str, Any]] = {}


class ProfilerData:
    """Per-request profiler data storage."""
    
    def __init__(self):
        self.enabled = True
        self.start_time: float = time.time()
        self.end_time: Optional[float] = None
        self.queries: List[Dict[str, Any]] = []
        self.benchmarks: Dict[str, float] = {}
        self.uri: str = ""
        self.method: str = ""
        self.user_id: Optional[int] = None
        self.is_ajax: bool = False
        
    def add_query(self, statement: str, parameters: Any, duration: float):
        """Add a query to the profiler."""
        self.queries.append({
            "statement": str(statement)[:1000],  # Truncate long queries
            "parameters": str(parameters)[:500] if parameters else None,
            "duration_ms": round(duration * 1000, 2)
        })
    
    def add_benchmark(self, name: str, duration: float):
        """Add a benchmark timing."""
        self.benchmarks[name] = round(duration * 1000, 2)
    
    def finish(self):
        """Mark request as finished."""
        self.end_time = time.time()
    
    def get_total_time_ms(self) -> float:
        """Get total request time in milliseconds."""
        end = self.end_time or time.time()
        return round((end - self.start_time) * 1000, 2)
    
    def get_total_query_time_ms(self) -> float:
        """Get total time spent in database queries."""
        return round(sum(q.get('duration_ms', 0) for q in self.queries), 2)
    
    def get_data(self) -> Dict[str, Any]:
        """Get compiled profiler data (matches CI3 format)."""
        total_time = self.get_total_time_ms()
        total_query_time = self.get_total_query_time_ms()
        
        # Format queries for display
        query_data = []
        for i, q in enumerate(self.queries, 1):
            stmt = q.get('statement', '')
            # Clean up the query for display
            stmt_clean = ' '.join(stmt.split())[:200]
            query_data.append({
                "label": f"[{i}] {stmt_clean}",
                "value": f"{q.get('duration_ms', 0)} ms"
            })
        
        if not query_data:
            query_data = [{"label": "No queries executed", "value": ""}]
        
        return {
            "CLASS/METHOD": [
                {"label": "URI", "value": f"{self.method} {self.uri}"}
            ],
            "BENCHMARKS": [
                {"label": "Total Execution Time", "value": f"{total_time} ms"},
                {"label": "Total Query Time", "value": f"{total_query_time} ms"},
                {"label": "PHP/Python Time", "value": f"{round(total_time - total_query_time, 2)} ms"},
                {"label": "Query Count", "value": str(len(self.queries))},
                *[{"label": name, "value": f"{dur} ms"} for name, dur in self.benchmarks.items()]
            ],
            f"DATABASE ({len(self.queries)} queries)": query_data
        }


def get_current_profiler() -> Optional[ProfilerData]:
    """Get the current request's profiler data."""
    return _current_profiler.get()


def start_request_profiler(uri: str, method: str, is_ajax: bool = False, user_id: Optional[int] = None) -> ProfilerData:
    """Start profiling for a new request."""
    profiler = ProfilerData()
    profiler.uri = uri
    profiler.method = method
    profiler.is_ajax = is_ajax
    profiler.user_id = user_id
    _current_profiler.set(profiler)
    return profiler


def end_request_profiler(user_id: Optional[int] = None):
    """End profiling for the current request and store data."""
    profiler = _current_profiler.get()
    if profiler:
        profiler.finish()
        
        # Store for the user (use user_id from profiler or parameter)
        uid = user_id or profiler.user_id
        if uid:
            store_profiler_data(str(uid), profiler.is_ajax, profiler.get_data())
        
        _current_profiler.set(None)


def store_profiler_data(session_id: str, is_ajax: bool, data: Dict[str, Any]):
    """Store profiler data in session storage (matches CI3 session behavior)."""
    key = f"ajax_{session_id}" if is_ajax else f"page_{session_id}"
    _session_profiler_data[key] = {
        "data": data,
        "timestamp": time.time()
    }
    
    # Keep only last 100 entries to prevent memory leak
    if len(_session_profiler_data) > 100:
        # Remove oldest entries
        sorted_keys = sorted(_session_profiler_data.keys(), 
                            key=lambda k: _session_profiler_data[k].get('timestamp', 0))
        for k in sorted_keys[:50]:
            del _session_profiler_data[k]


def get_stored_profiler_data(session_id: str, is_ajax: bool = False) -> Optional[Dict[str, Any]]:
    """Get stored profiler data for a session."""
    key = f"ajax_{session_id}" if is_ajax else f"page_{session_id}"
    stored = _session_profiler_data.get(key)
    if stored:
        return stored.get("data")
    return None


def is_ktech_user(email: str) -> bool:
    """Check if user is a KTech user (authorized for profiler).
    Matches CI3 checkemailktech() function."""
    if not email:
        return False
    email_lower = email.lower()
    return email_lower.endswith('@ktechproducts.com') or email_lower.endswith('@ktech.com')


# SQLAlchemy query event tracking
_query_contexts: Dict[int, float] = {}


def setup_query_profiling(engine: Engine):
    """Setup SQLAlchemy event listeners for query profiling."""
    
    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        # Store start time keyed by connection id
        _query_contexts[id(cursor)] = time.time()
    
    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        cursor_id = id(cursor)
        start_time = _query_contexts.pop(cursor_id, None)
        
        if start_time:
            duration = time.time() - start_time
            
            # Add to current request's profiler
            profiler = get_current_profiler()
            if profiler:
                profiler.add_query(statement, parameters, duration)
            
            # Log slow queries (> 1 second)
            if duration > 1.0:
                logger.warning(f"Slow query ({duration:.2f}s): {statement[:200]}")


@contextmanager
def profile_block(name: str):
    """Context manager for profiling a code block."""
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        profiler = get_current_profiler()
        if profiler:
            profiler.add_benchmark(name, duration)
