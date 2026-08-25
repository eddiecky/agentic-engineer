from sqlalchemy import Column, Integer, String

from database import Base


class Configuration(Base):
    __tablename__ = "configurations"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(String, nullable=False)


class RepoMapping(Base):
    __tablename__ = "repo_mappings"

    id = Column(Integer, primary_key=True, index=True)
    jira_project_key = Column(String, nullable=False, index=True)
    github_repo = Column(String, nullable=False)  # format: owner/repo
    base_branch = Column(String, default="main")
