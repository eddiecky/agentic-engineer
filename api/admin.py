from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import RepoMapping

router = APIRouter(prefix="/admin/api", tags=["admin"])


# ---------------------------------------------------------------------------
# Repo mappings only — config lives in .env
# ---------------------------------------------------------------------------

class RepoMappingCreate(BaseModel):
    jira_project_key: str
    github_repo: str
    base_branch: str = "main"


class RepoMappingOut(BaseModel):
    id: int
    jira_project_key: str
    github_repo: str
    base_branch: str

    model_config = {"from_attributes": True}


@router.get("/repos", response_model=list[RepoMappingOut])
def list_repos(db: Session = Depends(get_db)):
    return db.query(RepoMapping).all()


@router.post("/repos", response_model=RepoMappingOut)
def create_repo(payload: RepoMappingCreate, db: Session = Depends(get_db)):
    mapping = RepoMapping(**payload.model_dump())
    db.add(mapping)
    db.commit()
    db.refresh(mapping)
    return mapping


@router.delete("/repos/{mapping_id}")
def delete_repo(mapping_id: int, db: Session = Depends(get_db)):
    mapping = db.query(RepoMapping).filter(RepoMapping.id == mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    db.delete(mapping)
    db.commit()
    return {"status": "deleted"}
