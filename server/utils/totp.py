"""
TOTP (Time-based One-Time Password) generator for Angel One authentication
"""
import pyotp


def generate_totp(totp_secret: str) -> str:
    """
    Generates the current 6-digit TOTP code from the secret.
    
    Args:
        totp_secret: The TOTP secret obtained from Angel One
        
    Returns:
        6-digit TOTP code as string
        
    Raises:
        ValueError: If TOTP secret is not provided
    """
    if not totp_secret:
        raise ValueError("TOTP secret is required to generate a login code")
    
    # Remove any whitespace from the secret
    clean_secret = totp_secret.replace(" ", "")
    
    # Angel One uses standard TOTP (30s step, 6 digits, SHA1)
    totp = pyotp.TOTP(clean_secret)
    return totp.now()

# Made with Bob
