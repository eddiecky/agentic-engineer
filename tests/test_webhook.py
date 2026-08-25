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


@patch("api.webhooks.SessionLocal")
def test_webhook_no_mapping(mock_session_local):
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    mock_session_local.return_value = mock_db

    payload = {"issue": {"key": "PROJ-1", "fields": {"project": {"key": "PROJ"}}}}
    resp = client.post("/webhooks/jira", json=payload)
    assert resp.status_code == 404


@patch("api.webhooks.SessionLocal")
@patch("api.webhooks.workflow")
def test_webhook_success(mock_workflow, mock_session_local):
    mapping = MagicMock()
    mapping.github_repo = "acme/rocket"
    mapping.base_branch = "main"

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mapping
    mock_session_local.return_value = mock_db

    payload = {"issue": {"key": "PROJ-1", "fields": {"project": {"key": "PROJ"}}}}
    resp = client.post("/webhooks/jira", json=payload)
    assert resp.status_code == 202
    assert resp.json()["status"] == "accepted"
    mock_workflow.ainvoke.assert_called_once()
