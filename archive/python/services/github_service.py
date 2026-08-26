import os
import subprocess
from pathlib import Path

import os
import subprocess
from pathlib import Path

from github import Github

from config import settings


class GitHubService:
    def __init__(self, token: str = None):
        self.token = token or settings.GITHUB_TOKEN
        self.github = Github(self.token)

    def clone_or_pull(self, repo_url: str, local_path: str) -> str:
        path = Path(local_path)
        if path.exists() and (path / ".git").exists():
            subprocess.run(
                ["git", "-C", str(path), "pull"],
                check=True,
                capture_output=True,
                text=True,
            )
        else:
            authenticated_url = self._inject_token(repo_url)
            subprocess.run(
                ["git", "clone", authenticated_url, str(path)],
                check=True,
                capture_output=True,
                text=True,
            )
        return str(path)

    def create_branch(self, local_path: str, branch_name: str) -> str:
        subprocess.run(
            ["git", "-C", local_path, "checkout", "-b", branch_name],
            check=True,
            capture_output=True,
            text=True,
        )
        return branch_name

    def commit_and_push(self, local_path: str, branch_name: str, message: str):
        subprocess.run(
            ["git", "-C", local_path, "add", "-A"],
            check=True,
            capture_output=True,
            text=True,
        )
        subprocess.run(
            [
                "git",
                "-C",
                local_path,
                "-c",
                "user.email=agent@example.com",
                "-c",
                "user.name=Agentic Engineer",
                "commit",
                "-m",
                message,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        subprocess.run(
            ["git", "-C", local_path, "push", "origin", branch_name],
            check=True,
            capture_output=True,
            text=True,
        )

    def create_pr(self, repo_full_name: str, base_branch: str, head_branch: str, title: str, body: str) -> str:
        repo = self.github.get_repo(repo_full_name)
        pr = repo.create_pull(title=title, body=body, base=base_branch, head=head_branch)
        return pr.html_url

    def _inject_token(self, repo_url: str) -> str:
        if repo_url.startswith("https://"):
            return f"https://{self.token}@{repo_url[8:]}"
        if repo_url.startswith("http://"):
            return f"http://{self.token}@{repo_url[7:]}"
        return repo_url
