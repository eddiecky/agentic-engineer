import httpx

from config import resolve_config


class JiraService:
    def __init__(self, base_url: str = None, username: str = None, api_token: str = None):
        self.base_url = (base_url or resolve_config("JIRA_URL")).rstrip("/")
        self.username = username or resolve_config("JIRA_USERNAME")
        self.api_token = api_token or resolve_config("JIRA_API_TOKEN")

    async def get_ticket(self, ticket_id: str) -> dict:
        url = f"{self.base_url}/rest/api/2/issue/{ticket_id}"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                auth=(self.username, self.api_token),
                headers={"Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            fields = data.get("fields", {})
            return {
                "id": data.get("id"),
                "key": data.get("key"),
                "summary": fields.get("summary"),
                "description": fields.get("description"),
                "status": fields.get("status", {}).get("name"),
                "issue_type": fields.get("issuetype", {}).get("name"),
            }
