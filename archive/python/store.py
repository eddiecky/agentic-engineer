import json
import os
from pathlib import Path
from typing import Dict, List, Optional

_DATA_DIR = Path(__file__).parent / "data"
_DATA_DIR.mkdir(exist_ok=True)
_MAPPINGS_FILE = _DATA_DIR / "repo_mappings.json"


def _read() -> dict:
    if not _MAPPINGS_FILE.exists():
        return {}
    return json.loads(_MAPPINGS_FILE.read_text(encoding="utf-8"))


def _write(data: dict):
    _MAPPINGS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


class RepoMappingStore:
    @staticmethod
    def list_all() -> List[Dict]:
        data = _read()
        return [
            {
                "id": int(key),
                "jira_project_key": val["jira_project_key"],
                "github_repo": val["github_repo"],
                "base_branch": val.get("base_branch", "main"),
            }
            for key, val in data.items()
        ]

    @staticmethod
    def get_by_project(jira_project_key: str) -> Optional[Dict]:
        for mapping in RepoMappingStore.list_all():
            if mapping["jira_project_key"] == jira_project_key:
                return mapping
        return None

    @staticmethod
    def create(jira_project_key: str, github_repo: str, base_branch: str = "main") -> Dict:
        data = _read()
        new_id = max((int(k) for k in data.keys()), default=0) + 1
        entry = {
            "jira_project_key": jira_project_key,
            "github_repo": github_repo,
            "base_branch": base_branch,
        }
        data[str(new_id)] = entry
        _write(data)
        return {"id": new_id, **entry}

    @staticmethod
    def delete(mapping_id: int) -> bool:
        data = _read()
        key = str(mapping_id)
        if key not in data:
            return False
        del data[key]
        _write(data)
        return True
