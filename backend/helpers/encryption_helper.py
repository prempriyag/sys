"""
FastAPI-native encryption helper functions for secure file path handling
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import os
from urllib.parse import quote, unquote
from config.settings import Settings

settings = Settings()

# Get encryption key from environment or use SECRET_KEY from settings
# Fernet requires a 32-byte key, so we'll derive it from SECRET_KEY
def get_fernet_key() -> bytes:
    """
    Generate Fernet key from application SECRET_KEY
    Uses PBKDF2 to derive a 32-byte key from the SECRET_KEY
    """
    # Get secret key from settings (should be in .env file)
    secret_key = settings.SECRET_KEY.encode('utf-8')
    
    # Use PBKDF2 to derive a 32-byte key
    # Salt is fixed for consistency (in production, consider storing salt separately)
    salt = b'osucsc_encryption_salt_2024'  # Fixed salt for consistency
    
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
        backend=default_backend()
    )
    
    # Derive key from SECRET_KEY
    key = base64.urlsafe_b64encode(kdf.derive(secret_key))
    return key

# Initialize Fernet with derived key
_fernet = Fernet(get_fernet_key())

def encrypt(data: str, url_safe: bool = True) -> str:
    """
    Encrypt data using Fernet symmetric encryption
    FastAPI-native encryption using AES-128 in CBC mode with HMAC
    """
    try:
        # Encrypt using Fernet (Fernet tokens are already base64url encoded, which is URL-safe)
        encrypted = _fernet.encrypt(data.encode('utf-8'))
        encrypted_str = encrypted.decode('utf-8')
        
        if url_safe:
            # Fernet uses base64url encoding which is already URL-safe
            # But we'll URL-encode it to handle any edge cases in query parameters
            encrypted_str = quote(encrypted_str, safe='')
        
        return encrypted_str
    except Exception as e:
        raise Exception(f"Encryption error: {str(e)}")

def decrypt(data: str) -> str:
    """
    Decrypt data using Fernet symmetric decryption
    FastAPI-native decryption
    """
    try:
        # URL-decode first if it was URL-encoded
        data = unquote(data)
        
        # Decrypt using Fernet
        decrypted = _fernet.decrypt(data.encode('utf-8'))
        return decrypted.decode('utf-8')
    except Exception as e:
        raise Exception(f"Decryption error: {str(e)}")

def get_encrypt_file_path(path: str) -> str:
    """
    Encrypt file path for secure viewing
    Returns URL-safe encrypted path for use in query parameters
    """
    return encrypt(path, url_safe=True)

def file_decrypt(encrypted_path: str) -> str:
    """
    Decrypt file path
    Returns the original file path, preserving Windows path format
    """
    decrypted = decrypt(encrypted_path)
    # Convert forward slashes to backslashes for Windows paths
    # This ensures compatibility with Windows file system
    return decrypted.replace('/', '\\')



