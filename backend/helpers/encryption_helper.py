"""
Encryption helper functions matching CI3 encryption
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import os
from config.settings import Settings

settings = Settings()

# CI3 encryption key from config.php
ENCRYPTION_KEY = '07dbb6e6832da0841dd79701200e4b179f1a94a7b3dd26f612817f3c03117434'

def get_fernet_key():
    """Generate Fernet key from CI3 encryption key"""
    # Convert hex string to bytes
    key_bytes = bytes.fromhex(ENCRYPTION_KEY)
    # Use first 32 bytes for Fernet (Fernet requires 32 bytes)
    key_32 = key_bytes[:32]
    # Base64 encode for Fernet
    return base64.urlsafe_b64encode(key_32)

_fernet = Fernet(get_fernet_key())

def encrypt(data: str, url_safe: bool = True) -> str:
    """
    Encrypt data matching CI3 encryption
    CI3 uses CodeIgniter's encryption library which uses AES-256-CBC
    For compatibility, we'll use a similar approach
    """
    try:
        # Encrypt using Fernet (AES-128-CBC in CBC mode with HMAC)
        encrypted = _fernet.encrypt(data.encode('utf-8'))
        encrypted_str = encrypted.decode('utf-8')
        
        if url_safe:
            # Make URL safe (matching CI3's strtr)
            encrypted_str = encrypted_str.replace('+', '.').replace('=', '-').replace('/', '~')
        
        return encrypted_str
    except Exception as e:
        raise Exception(f"Encryption error: {str(e)}")

def decrypt(data: str) -> str:
    """
    Decrypt data matching CI3 decryption
    """
    try:
        # Reverse URL safe encoding
        data = data.replace('.', '+').replace('-', '=').replace('~', '/')
        
        # Decrypt using Fernet
        decrypted = _fernet.decrypt(data.encode('utf-8'))
        return decrypted.decode('utf-8')
    except Exception as e:
        raise Exception(f"Decryption error: {str(e)}")

def get_encrypt_file_path(path: str) -> str:
    """
    Encrypt file path for secure viewing
    Matches CI3's getencryptfilepath() function
    """
    return encrypt(path, url_safe=True)

def file_decrypt(encrypted_path: str) -> str:
    """
    Decrypt file path
    Matches CI3's filedecrypt() function
    Converts forward slashes to backslashes for Windows paths
    """
    decrypted = decrypt(encrypted_path)
    # Convert forward slashes to backslashes (Windows path format)
    return decrypted.replace('/', '\\')

