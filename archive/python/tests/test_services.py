from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.github_service import GitHubService
from services.jira_service import JiraService
from services.llm_service import LLMService, OpenRouterProvider


@pytest.mark.asyncio
async def test_jira_get_ticket():
    with patch("services.jira_service.httpx.AsyncClient") as MockClient:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "id": "1",
            "key": "TEST-1",
            "fields": {
                "summary": "Test summary",
                "description": "Test desc",
                "status": {"name": "Open"},
                "issuetype": {"name": "Bug"},
            },
        }
        mock_resp.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.get = AsyncMock(return_value=mock_resp)

        MockClient.return_value = mock_client

        svc = JiraService(base_url="https://jira.test", username="u", api_token="t")
        ticket = await svc.get_ticket("TEST-1")
        assert ticket["key"] == "TEST-1"
        assert ticket["summary"] == "Test summary"


@pytest.mark.asyncio
async def test_openrouter_generate():
    with patch("services.llm_service.httpx.AsyncClient") as MockClient:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "print('hello')"}}]
        }
        mock_resp.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.post = AsyncMock(return_value=mock_resp)

        MockClient.return_value = mock_client

        provider = OpenRouterProvider(api_key="k")
        result = await provider.generate("write hello world")
        assert result == "print('hello')"


def test_llm_service_parse_changes():
    raw = "### file1.py\n```python\nprint(1)\n```\n### file2.py\n```python\nprint(2)\n```"
    changes = LLMService.parse_changes(raw)
    assert len(changes) == 2
    assert changes[0] == ("file1.py", "print(1)")
    assert changes[1] == ("file2.py", "print(2)")


@patch("services.github_service.subprocess.run")
def test_github_clone(mock_run):
    mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
    svc = GitHubService(token="tok")
    path = svc.clone_or_pull("https://github.com/org/repo.git", "/tmp/test_repo")
    assert path == "/tmp/test_repo"
    mock_run.assert_called_once()


@patch("services.github_service.subprocess.run")
def test_github_create_branch(mock_run):
    mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
    svc = GitHubService(token="tok")
    branch = svc.create_branch("/tmp/repo", "feature-x")
    assert branch == "feature-x"
