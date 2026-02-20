"""
Extraction service configuration.
Production-grade settings for ECI voter roll PDF extraction.
"""
import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ExtractionConfig:
    """Configuration for voter roll extraction."""

    # PDF type detection
    min_text_chars_per_page: int = 50
    sample_pages_for_detection: int = 5
    image_area_ratio_threshold: float = 0.7  # If >70% of page is images, treat as scanned

    # OCR settings (tuned for speed: lower DPI, no preprocess by default)
    ocr_dpi: int = 200
    ocr_max_pages: int = 1000
    ocr_preprocess: bool = False  # OpenCV preprocessing improves quality but slows extraction

    # Limits
    max_file_size_mb: int = 100
    extraction_timeout_seconds: int = 600

    # EPIC validation
    epic_patterns: list = field(default_factory=lambda: [
        r"[A-Z]{3}[0-9]{7}",  # ABC1234567
        r"[A-Z]{3}[0-9]{6}",  # ABC123456 (some states)
    ])

    # Validation
    age_min: int = 18
    age_max: int = 120
    valid_genders: tuple = ("M", "F", "O", "Male", "Female", "Other")

    @classmethod
    def from_env(cls) -> "ExtractionConfig":
        """Load config from environment variables."""
        return cls(
            min_text_chars_per_page=int(os.getenv("EXTRACT_MIN_TEXT_CHARS", "50")),
            sample_pages_for_detection=int(os.getenv("EXTRACT_SAMPLE_PAGES", "5")),
            ocr_dpi=int(os.getenv("EXTRACT_OCR_DPI", "200")),
            ocr_max_pages=int(os.getenv("EXTRACT_OCR_MAX_PAGES", "1000")),
            ocr_preprocess=os.getenv("EXTRACT_OCR_PREPROCESS", "false").lower() in ("true", "1", "yes"),
            max_file_size_mb=int(os.getenv("EXTRACT_MAX_FILE_MB", "100")),
            extraction_timeout_seconds=int(os.getenv("EXTRACT_TIMEOUT", "600")),
        )


# Singleton instance
_config: Optional[ExtractionConfig] = None


def get_extraction_config() -> ExtractionConfig:
    """Get extraction configuration (singleton)."""
    global _config
    if _config is None:
        _config = ExtractionConfig.from_env()
    return _config
