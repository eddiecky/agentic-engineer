from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_webhook_missing_issue():
    resp = client.post("/webhooks/jira", json={})
    assert resp.status_code == 400


def test_webhook_missing_keys():
    resp = client.post("/webhooks/jira", json={"issue": {"key": "X-1"}})
    assert resp.status_code == 400


@patch("api.webhooks.RepoMappingStore.get_by_project")
def test_webhook_no_mapping(mock_get):
    mock_get.return_value = None

    payload = {"issue": {"key": "PROJ-1", "fields": {"project": {"key": "PROJ"}}}}
    resp = client.post("/webhooks/jira", json=payload)
    assert resp.status_code == 404


@patch("api.webhooks.RepoMappingStore.get_by_project")
@patch("api.webhooks.workflow")
def test_webhook_success(mock_workflow, mock_get):
    mock_get.return_value = {
        "id": 1,
        "jira_project_key": "PROJ",
        "github_repo": "acme/rocket",
        "base_branch": "main",
    }

    payload = {"issue": {"key": "PROJ-1", "fields": {"project": {"key": "PROJ"}}}}
    resp = client.post("/webhooks/jira", json=payload)
    assert resp.status_code == 202
    assert resp.json()["status"] == "accepted"
    mock_workflow.ainvoke.assert_called_once()
