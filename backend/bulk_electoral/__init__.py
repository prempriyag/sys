"""
Bulk Electoral Roll module.
PDF extraction + insert to voter_data. Isolated from extract_batches module.
"""
from .controller import router

__all__ = ["router"]
