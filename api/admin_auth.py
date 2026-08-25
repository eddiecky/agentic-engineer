import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from config import resolve_config

security = HTTPBasic(auto_error=False)


def admin_auth(credentials: HTTPBasicCredentials = Depends(security)):
    password = resolve_config("ADMIN_PASSWORD")
    if not password:
        return

    if not credentials or not secrets.compare_digest(credentials.password, password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
