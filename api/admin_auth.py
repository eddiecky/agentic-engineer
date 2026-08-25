import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from config import settings

security = HTTPBasic(auto_error=False)


def admin_auth(credentials: HTTPBasicCredentials = Depends(security)):
    password = settings.ADMIN_PASSWORD
    if not password:
        return

    if not credentials or not secrets.compare_digest(credentials.password, password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )
