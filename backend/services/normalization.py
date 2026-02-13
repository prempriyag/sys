
import re

class NormalizationService:
    @staticmethod
    def normalize_text(text: str) -> str:
        if not text:
            return ""
        # Convert to uppercase
        text = text.upper()
        # Remove non-alphanumeric characters (keep basic punctuation if needed, but SOP says remove)
        # SOP 3.2: Remove non-alphanumeric from address fields
        # Let's keep spaces and maybe commas for readability, but strict alphanumeric for matching
        # For now, standard normalization:
        text = re.sub(r'[^A-Z0-9\s]', '', text)
        # Remove extra whitespace
        text = " ".join(text.split())
        return text

    @staticmethod
    def normalize_name(name: str) -> str:
        # SOP 3.2: Tamil-to-English transliteration (Placeholder)
        # e.g. Lakshmi vs Laxmi. 
        # Ideally uses a library or mapping. For now, basic text normalization.
        return NormalizationService.normalize_text(name)
