import pytest
from unittest.mock import AsyncMock, patch

from agents.workflow import (
    apply_changes_node,
    clone_repo_node,
    fetch_ticket_node,
    generate_changes_node,
    push_and_pr_node,
    AgentState,
)


@pytest.mark.asyncio
async def test_fetch_ticket_node_success():
    with patch("agents.workflow.JiraService") as MockSvc:
        inst = MockSvc.return_value
        inst.get_ticket = AsyncMock(return_value={"key": "TEST-1", "summary": "Fix bug"})
        state = AgentState(
            ticket_id="TEST-1", ticket_details={}, repo_url="", local_path="",
            branch_name="", repo_full_name="", base_branch="main", code_diff=[],
            pr_url="", error="",
        )
        result = await fetch_ticket_node(state)
        assert result["ticket_details"]["key"] == "TEST-1"
        assert result.get("error", "") == ""


@pytest.mark.asyncio
async def test_fetch_ticket_node_error():
    with patch("agents.workflow.JiraService") as MockSvc:
        inst = MockSvc.return_value
        inst.get_ticket = AsyncMock(side_effect=Exception("JIRA down"))
        state = AgentState(
            ticket_id="TEST-1", ticket_details={}, repo_url="", local_path="",
            branch_name="", repo_full_name="", base_branch="main", code_diff=[],
            pr_url="", error="",
        )
        result = await fetch_ticket_node(state)
        assert "JIRA down" in result["error"]


@pytest.mark.asyncio
async def test_generate_changes_node_success():
    with patch("agents.workflow.LLMService") as MockSvc:
        inst = MockSvc.return_value
        inst.generate_code_changes = AsyncMock(return_value="### file.py\n```py\nprint(1)\n```")
        inst.parse_changes.return_value = [("file.py", "print(1)")]

        state = AgentState(
            ticket_id="T-1", ticket_details={"summary": "test"}, repo_url="",
            local_path="", branch_name="", repo_full_name="", base_branch="main",
            code_diff=[("file.py", "print(0)")], pr_url="", error="",
        )
        result = await generate_changes_node(state)
        assert result["code_diff"] == [("file.py", "print(1)")]


@pytest.mark.asyncio
async def test_apply_changes_node(tmp_path):
    repo_dir = tmp_path / "repo"
    repo_dir.mkdir()
    state = AgentState(
        ticket_id="T-1", ticket_details={}, repo_url="", local_path=str(repo_dir),
        branch_name="", repo_full_name="", base_branch="main",
        code_diff=[("src/main.py", "print('hello')")], pr_url="", error="",
    )
    result = await apply_changes_node(state)
    assert not result.get("error")
    assert (repo_dir / "src" / "main.py").read_text() == "print('hello')"


@pytest.mark.asyncio
async def test_clone_repo_node_error():
    state = AgentState(
        ticket_id="T-1", ticket_details={}, repo_url="bad-url", local_path="",
        branch_name="", repo_full_name="a/b", base_branch="main",
        code_diff=[], pr_url="", error="",
    )
    with patch("agents.workflow.GitHubService") as MockSvc:
        inst = MockSvc.return_value
        inst.clone_or_pull = MagicMock(side_effect=Exception("clone failed"))
        result = await clone_repo_node(state)
        assert "clone failed" in result["error"]


@pytest.mark.asyncio
async def test_push_and_pr_node_success():
    state = AgentState(
        ticket_id="PROJ-42", ticket_details={"summary": "Add feature"},
        repo_url="", local_path="/tmp/fake", branch_name="", repo_full_name="acme/rocket",
        base_branch="main", code_diff=[], pr_url="", error="",
    )
    with patch("agents.workflow.GitHubService") as MockSvc:
        inst = MockSvc.return_value
        inst.create_branch = MagicMock(return_value="agent/PROJ-42-abc123")
        inst.commit_and_push = MagicMock()
        inst.create_pr.return_value = "https://github.com/acme/rocket/pull/99"
        result = await push_and_pr_node(state)
        assert result["pr_url"] == "https://github.com/acme/rocket/pull/99"
        assert result["branch_name"].startswith("agent/PROJ-42-")
