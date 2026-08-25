from store import RepoMappingStore
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/admin/api", tags=["admin"])


class RepoMappingCreate(BaseModel):
    jira_project_key: str
    github_repo: str
    base_branch: str = "main"


class RepoMappingOut(BaseModel):
    id: int
    jira_project_key: str
    github_repo: str
    base_branch: str


@router.get("/repos", response_model=list[RepoMappingOut])
def list_repos():
    return RepoMappingStore.list_all()


@router.post("/repos", response_model=RepoMappingOut)
def create_repo(payload: RepoMappingCreate):
    return RepoMappingStore.create(**payload.model_dump())


@router.delete("/repos/{mapping_id}")
def delete_repo(mapping_id: int):
    if not RepoMappingStore.delete(mapping_id):
        raise HTTPException(status_code=404, detail="Mapping not found")
    return {"status": "deleted"}
