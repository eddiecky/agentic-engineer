# Agentic Engineer MVP

An AI agent that receives JIRA webhooks and autonomously opens GitHub PRs with LLM-enhanced code.

## Quick Start

1. **Run setup** (creates a Python virtual environment and installs dependencies)
   ```bash
   ./setup.sh
   source .venv/bin/activate
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your JIRA, GitHub, and LLM credentials
   ```

3. **Run the server**
   ```bash
   uvicorn main:app --reload
   ```

4. **Open the admin panel**
   Navigate to http://localhost:8000/admin

## Project Structure

```
├── main.py                 # FastAPI entrypoint
├── config.py               # Pydantic settings
├── database.py             # SQLAlchemy setup
├── models.py               # DB models
├── api/
│   ├── webhooks.py         # JIRA webhook receiver
│   └── admin.py            # Configuration CRUD
├── services/
│   ├── jira_service.py     # JIRA API client
│   ├── github_service.py   # GitHub + git CLI wrappers
│   └── llm_service.py      # LLM provider abstraction
├── agents/
│   └── workflow.py         # LangGraph orchestration
├── admin_static/
│   └── index.html          # Admin frontend
└── tests/
    └── ...                 # Test suite
```

## Running Tests

```bash
pytest
```

## Receiving JIRA Webhooks

JIRA sends webhooks from Atlassian's public servers, so the app must be reachable from the internet.

### Local development — use a tunnel

```bash
# Example with ngrok
ngrok http 8000
```

Then set the JIRA webhook URL to the generated public URL (e.g. `https://abc123.ngrok.io/webhooks/jira`).

### Production — deploy to a public server

Deploy to any cloud provider (AWS, GCP, Heroku, Fly.io, etc.) and use the public domain as the webhook URL.
