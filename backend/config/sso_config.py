"""
SSO Configuration for Client and KTech SSO
Supports both SAML and OAuth
"""
from typing import Dict, Optional
from pydantic_settings import BaseSettings
from config.settings import settings
import os


class SSOConfig(BaseSettings):
    """SSO Configuration class - reads from environment variables"""
    
    # SSO Method Selection (set to 'oauth' or 'saml' or None to auto-detect)
    CLIENT_SSO_METHOD: Optional[str] = None  # 'oauth', 'saml', or None for auto-detect
    KTECH_SSO_METHOD: Optional[str] = None  # 'oauth', 'saml', or None for auto-detect
    
    # Client SSO - OAuth (Azure AD)
    CLIENT_OAUTH_TENANT_ID: Optional[str] = None
    CLIENT_OAUTH_CLIENT_ID: Optional[str] = None
    CLIENT_OAUTH_CLIENT_SECRET: Optional[str] = None
    CLIENT_OAUTH_AUTHORITY: str = "https://login.microsoftonline.com"
    CLIENT_OAUTH_RESOURCE_URI: str = "https://graph.windows.net"
    
    # Client SSO - SAML
    CLIENT_SAML_ENTITY_ID: Optional[str] = None
    CLIENT_SAML_IDP_ENTITY_ID: Optional[str] = None
    CLIENT_SAML_IDP_SSO_URL: Optional[str] = None
    CLIENT_SAML_IDP_SLS_URL: Optional[str] = None
    CLIENT_SAML_IDP_X509_CERT: Optional[str] = None
    CLIENT_SAML_SP_X509_CERT: Optional[str] = None
    CLIENT_SAML_SP_PRIVATE_KEY: Optional[str] = None
    
    # KTech SSO - OAuth (Azure AD)
    KTECH_OAUTH_TENANT_ID: Optional[str] = None
    KTECH_OAUTH_CLIENT_ID: Optional[str] = None
    KTECH_OAUTH_CLIENT_SECRET: Optional[str] = None
    KTECH_OAUTH_AUTHORITY: str = "https://login.microsoftonline.com"
    KTECH_OAUTH_RESOURCE_URI: str = "https://graph.microsoft.com"  # KTech uses Microsoft Graph API (matches CI3 aad_auth_ktech.php)
    
    # KTech SSO - SAML
    KTECH_SAML_ENTITY_ID: Optional[str] = None
    KTECH_SAML_IDP_ENTITY_ID: Optional[str] = None
    KTECH_SAML_IDP_SSO_URL: Optional[str] = None
    KTECH_SAML_IDP_SLS_URL: Optional[str] = None
    KTECH_SAML_IDP_X509_CERT: Optional[str] = None
    KTECH_SAML_SP_X509_CERT: Optional[str] = None
    KTECH_SAML_SP_PRIVATE_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"
    
    @property
    def CLIENT_OAUTH_REDIRECT_URI(self) -> str:
        """Client OAuth redirect URI"""
        return f"{settings.BASE_URL}/api/sso/client/oauth/callback"
    
    @property
    def CLIENT_SAML_ACS_URL(self) -> str:
        """Client SAML Assertion Consumer Service URL"""
        return f"{settings.BASE_URL}/api/sso/client/saml/callback"
    
    @property
    def CLIENT_SAML_SLS_URL(self) -> str:
        """Client SAML Single Logout Service URL"""
        return f"{settings.BASE_URL}/api/sso/client/saml/sls"
    
    @property
    def KTECH_OAUTH_REDIRECT_URI(self) -> str:
        """KTech OAuth redirect URI"""
        return f"{settings.BASE_URL}/api/sso/ktech/oauth/callback"
    
    @property
    def KTECH_SAML_ACS_URL(self) -> str:
        """KTech SAML Assertion Consumer Service URL"""
        return f"{settings.BASE_URL}/api/sso/ktech/saml/callback"
    
    @property
    def KTECH_SAML_SLS_URL(self) -> str:
        """KTech SAML Single Logout Service URL"""
        return f"{settings.BASE_URL}/api/sso/ktech/saml/sls"

    def get_client_oauth_config(self) -> Dict:
        """Get Client OAuth configuration"""
        return {
            "tenant_id": self.CLIENT_OAUTH_TENANT_ID,
            "client_id": self.CLIENT_OAUTH_CLIENT_ID,
            "client_secret": self.CLIENT_OAUTH_CLIENT_SECRET,
            "redirect_uri": self.CLIENT_OAUTH_REDIRECT_URI,
            "authority": self.CLIENT_OAUTH_AUTHORITY,
            "resource_uri": self.CLIENT_OAUTH_RESOURCE_URI,
        }
    
    def get_ktech_oauth_config(self) -> Dict:
        """Get KTech OAuth configuration"""
        return {
            "tenant_id": self.KTECH_OAUTH_TENANT_ID,
            "client_id": self.KTECH_OAUTH_CLIENT_ID,
            "client_secret": self.KTECH_OAUTH_CLIENT_SECRET,
            "redirect_uri": self.KTECH_OAUTH_REDIRECT_URI,
            "authority": self.KTECH_OAUTH_AUTHORITY,
            "resource_uri": self.KTECH_OAUTH_RESOURCE_URI,
        }
    
    def get_client_saml_config(self) -> Dict:
        """Get Client SAML configuration"""
        return {
            "sp": {
                "entityId": self.CLIENT_SAML_ENTITY_ID,
                "assertionConsumerService": {
                    "url": self.CLIENT_SAML_ACS_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "singleLogoutService": {
                    "url": self.CLIENT_SAML_SLS_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "x509cert": self.CLIENT_SAML_SP_X509_CERT or "",
                "privateKey": self.CLIENT_SAML_SP_PRIVATE_KEY or "",
            },
            "idp": {
                "entityId": self.CLIENT_SAML_IDP_ENTITY_ID,
                "singleSignOnService": {
                    "url": self.CLIENT_SAML_IDP_SSO_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "singleLogoutService": {
                    "url": self.CLIENT_SAML_IDP_SLS_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "x509cert": self.CLIENT_SAML_IDP_X509_CERT or "",
            },
            "security": {
                "authnRequestsSigned": False,
                "logoutRequestsSigned": False,
                "logoutResponsesSigned": False,
                "signatureAlgorithm": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
                "digestAlgorithm": "http://www.w3.org/2001/04/xmlenc#sha256",
            }
        }
    
    def get_ktech_saml_config(self) -> Dict:
        """Get KTech SAML configuration"""
        return {
            "sp": {
                "entityId": self.KTECH_SAML_ENTITY_ID,
                "assertionConsumerService": {
                    "url": self.KTECH_SAML_ACS_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "singleLogoutService": {
                    "url": self.KTECH_SAML_SLS_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "x509cert": self.KTECH_SAML_SP_X509_CERT or "",
                "privateKey": self.KTECH_SAML_SP_PRIVATE_KEY or "",
            },
            "idp": {
                "entityId": self.KTECH_SAML_IDP_ENTITY_ID,
                "singleSignOnService": {
                    "url": self.KTECH_SAML_IDP_SSO_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "singleLogoutService": {
                    "url": self.KTECH_SAML_IDP_SLS_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "x509cert": self.KTECH_SAML_IDP_X509_CERT or "",
            },
            "security": {
                "authnRequestsSigned": False,
                "logoutRequestsSigned": False,
                "logoutResponsesSigned": False,
                "signatureAlgorithm": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
                "digestAlgorithm": "http://www.w3.org/2001/04/xmlenc#sha256",
            }
        }
    
    def get_client_sso_method(self) -> Optional[str]:
        """
        Get active Client SSO method
        Returns 'oauth', 'saml', or None if neither is configured
        """
        # If explicitly set, use that
        if self.CLIENT_SSO_METHOD:
            return self.CLIENT_SSO_METHOD.lower()
        
        # Auto-detect: Check which one is configured
        oauth_config = self.get_client_oauth_config()
        saml_config = self.get_client_saml_config()
        
        oauth_configured = (
            oauth_config.get('tenant_id') and 
            oauth_config.get('client_id') and 
            oauth_config.get('client_secret')
        )
        
        saml_configured = (
            saml_config.get('sp', {}).get('entityId') and
            saml_config.get('idp', {}).get('entityId') and
            saml_config.get('idp', {}).get('singleSignOnService', {}).get('url')
        )
        
        # Prefer OAuth if both are configured
        if oauth_configured:
            return 'oauth'
        elif saml_configured:
            return 'saml'
        else:
            return None
    
    def get_ktech_sso_method(self) -> Optional[str]:
        """
        Get active KTech SSO method
        Returns 'oauth', 'saml', or None if neither is configured
        """
        # If explicitly set, use that
        if self.KTECH_SSO_METHOD:
            return self.KTECH_SSO_METHOD.lower()
        
        # Auto-detect: Check which one is configured
        oauth_config = self.get_ktech_oauth_config()
        saml_config = self.get_ktech_saml_config()
        
        oauth_configured = (
            oauth_config.get('tenant_id') and 
            oauth_config.get('client_id') and 
            oauth_config.get('client_secret')
        )
        
        saml_configured = (
            saml_config.get('sp', {}).get('entityId') and
            saml_config.get('idp', {}).get('entityId') and
            saml_config.get('idp', {}).get('singleSignOnService', {}).get('url')
        )
        
        # Prefer OAuth if both are configured
        if oauth_configured:
            return 'oauth'
        elif saml_configured:
            return 'saml'
        else:
            return None


# Create singleton instance
sso_config = SSOConfig()
