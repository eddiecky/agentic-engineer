import asyncio
import glob
import os
import uuid
from typing import Any

from langgraph.graph import END, StateGraph

from services.github_service import GitHubService
from services.jira_service import JiraService
from services.llm_service import LLMService


class AgentState(dict):
    ticket_id: str
    ticket_details: dict
    repo_url: str
    repo_full_name: str
    base_branch: str
    local_path: str
    branch_name: str
    code_diff: Any
    pr_url: str
    error: str


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

async def fetch_ticket_node(state: AgentState) -> AgentState:
    try:
        service = JiraService()
        ticket = await service.get_ticket(state["ticket_id"])
        return {"ticket_details": ticket, "error": ""}
    except Exception as e:
        return {"error": f"fetch_ticket: {e}"}


async def clone_repo_node(state: AgentState) -> AgentState:
    if state.get("error"):
        return {}
    try:
        service = GitHubService()
        local_path = f"/tmp/agentic-engineer/repos/{state['repo_full_name'].replace('/', '_')}"
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        service.clone_or_pull(state["repo_url"], local_path)
        return {"local_path": local_path, "error": ""}
    except Exception as e:
        return {"error": f"clone_repo: {e}"}


async def read_code_node(state: AgentState) -> AgentState:
    if state.get("error"):
        return {}
    try:
        local_path = state["local_path"]
        files = []
        for pattern in ["*.py", "**/*.py", "README*"]:
            files.extend(glob.glob(os.path.join(local_path, pattern), recursive=True))

        seen = set()
        file_contents = []
        for f in files[:20]:
            if f in seen:
                continue
            seen.add(f)
            try:
                with open(f, "r", encoding="utf-8") as fh:
                    content = fh.read()
                rel_path = os.path.relpath(f, local_path)
                file_contents.append((rel_path, content))
            except Exception:
                continue
        return {"code_diff": file_contents, "error": ""}
    except Exception as e:
        return {"error": f"read_code: {e}"}


async def generate_changes_node(state: AgentState) -> AgentState:
    if state.get("error"):
        return {}
    try:
        service = LLMService()
        raw = await service.generate_code_changes(state["ticket_details"], state["code_diff"])
        changes = service.parse_changes(raw)
        return {"code_diff": changes, "error": ""}
    except Exception as e:
        return {"error": f"generate_changes: {e}"}


async def apply_changes_node(state: AgentState) -> AgentState:
    if state.get("error"):
        return {}
    try:
        local_path = state["local_path"]
        for filename, content in state["code_diff"]:
            filepath = os.path.join(local_path, filename)
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
        return {"error": ""}
    except Exception as e:
        return {"error": f"apply_changes: {e}"}


async def push_and_pr_node(state: AgentState) -> AgentState:
    if state.get("error"):
        return {}
    try:
        service = GitHubService()
        branch_name = f"agent/{state['ticket_id']}-{uuid.uuid4().hex[:6]}"
        service.create_branch(state["local_path"], branch_name)
        service.commit_and_push(
            state["local_path"],
            branch_name,
            f"feat({state['ticket_id']}): {state['ticket_details']['summary']}",
        )
        pr_url = service.create_pr(
            state["repo_full_name"],
            state["base_branch"],
            branch_name,
            f"{state['ticket_id']}: {state['ticket_details']['summary']}",
            state["ticket_details"].get("description", ""),
        )
        return {"branch_name": branch_name, "pr_url": pr_url, "error": ""}
    except Exception as e:
        return {"error": f"push_and_pr: {e}"}


def error_handler_node(state: AgentState) -> AgentState:
    print(f"Workflow error: {state.get('error')}")
    return {}


# ---------------------------------------------------------------------------
# Routing helpers
# ---------------------------------------------------------------------------

def _make_router(next_ok: str):
    def router(state: AgentState) -> str:
        return "error" if state.get("error") else "ok"

    return router


# ---------------------------------------------------------------------------
# Build graph
# ---------------------------------------------------------------------------

builder = StateGraph(AgentState)

builder.add_node("fetch_ticket", fetch_ticket_node)
builder.add_node("clone_repo", clone_repo_node)
builder.add_node("read_code", read_code_node)
builder.add_node("generate_changes", generate_changes_node)
builder.add_node("apply_changes", apply_changes_node)
builder.add_node("push_and_pr", push_and_pr_node)
builder.add_node("error_handler", error_handler_node)

builder.set_entry_point("fetch_ticket")

builder.add_conditional_edges("fetch_ticket", _make_router("clone_repo"), {"error": "error_handler", "ok": "clone_repo"})
builder.add_conditional_edges("clone_repo", _make_router("read_code"), {"error": "error_handler", "ok": "read_code"})
builder.add_conditional_edges("read_code", _make_router("generate_changes"), {"error": "error_handler", "ok": "generate_changes"})
builder.add_conditional_edges("generate_changes", _make_router("apply_changes"), {"error": "error_handler", "ok": "apply_changes"})
builder.add_conditional_edges("apply_changes", _make_router("push_and_pr"), {"error": "error_handler", "ok": "push_and_pr"})

builder.add_edge("push_and_pr", END)
builder.add_edge("error_handler", END)

workflow = builder.compile()
