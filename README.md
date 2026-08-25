# Agentic Engineer MVP

An AI agent that receives JIRA webhooks and autonomously opens GitHub PRs with LLM-enhanced code.

## Configuration

### 1. Environment variables (`.env`)

Create a `.env` file in the project root:

```bash
# JIRA
JIRA_URL=https://your-domain.atlassian.net
JIRA_USERNAME=you@example.com
JIRA_API_TOKEN=your_token

# GitHub
GITHUB_TOKEN=ghp_xxx

# LLM
OPENROUTER_API_KEY=sk-or-v1-xxx
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
DEFAULT_LLM_PROVIDER=openrouter
```

### 2. Repo mappings (`data/repo_mappings.json`)

Manually create `data/repo_mappings.json` to map JIRA projects to GitHub repos:

```json
{
  "1": {
    "jira_project_key": "PROJ",
    "github_repo": "acme/rocket",
    "base_branch": "main"
  }
}
```

## Quick Start

1. **Install dependencies**
   ```bash
   pip install -e ".[test]"
   ```

2. **Run the server**
   ```bash
   uvicorn main:app --reload
   ```

3. **Expose the webhook endpoint**
   ```bash
   ngrok http 8000
   ```

4. **Set the JIRA webhook URL** to the tunnel URL (e.g. `https://abc123.ngrok.io/webhooks/jira`).

## Project Structure

```
├── main.py                 # FastAPI entrypoint
├── config.py               # Pydantic settings (reads .env)
├── store.py                # JSON file store for repo mappings
├── api/
│   └── webhooks.py         # JIRA webhook receiver
├── services/
│   ├── jira_service.py     # JIRA API client
│   ├── github_service.py   # GitHub + git CLI wrappers
│   └── llm_service.py      # LLM provider abstraction
├── agents/
│   └── workflow.py         # LangGraph orchestration
└── tests/
    └── ...                 # Test suite
```

## Running Tests

```bash
pytest
```
