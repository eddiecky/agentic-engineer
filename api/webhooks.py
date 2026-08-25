import asyncio

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

from agents.workflow import AgentState, workflow
from store import RepoMappingStore

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/jira")
async def jira_webhook(request: Request, background_tasks: BackgroundTasks):
    payload = await request.json()
    issue = payload.get("issue")
    if not issue:
        event_type = payload.get("issue_event_type_name")
        if event_type:
            issue = payload
        else:
            raise HTTPException(status_code=400, detail="No issue data in payload")

    issue_key = issue.get("key")
    fields = issue.get("fields", {})
    project_key = fields.get("project", {}).get("key")

    if not issue_key or not project_key:
        raise HTTPException(status_code=400, detail="Missing issue key or project key")

    mapping = RepoMappingStore.get_by_project(project_key)
    if not mapping:
        raise HTTPException(
            status_code=404, detail=f"No repo mapping for project {project_key}"
        )

    repo_url = f"https://github.com/{mapping['github_repo']}.git"

    initial_state = AgentState(
        ticket_id=issue_key,
        ticket_details={},
        repo_url=repo_url,
        local_path="",
        branch_name="",
        repo_full_name=mapping["github_repo"],
        base_branch=mapping.get("base_branch", "main"),
        code_diff=[],
        pr_url="",
        error="",
    )

    background_tasks.add_task(_run_workflow_sync, initial_state)
    return {"status": "accepted", "ticket_id": issue_key}


def _run_workflow_sync(state: AgentState):
    asyncio.run(workflow.ainvoke(state))
