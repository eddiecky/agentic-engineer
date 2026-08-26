# Agentic Engineer v2.0

An AI agent that receives JIRA webhooks and autonomously opens GitHub PRs using the **GitHub Copilot SDK** agent runtime.

## What's New in v2.0

- **Node.js / TypeScript** — Full rewrite from Python
- **GitHub Copilot SDK** — Production agent runtime with built-in planning, tool use, and self-correction
- **Autonomous agent loop** — The agent decides what files to read, what to edit, and when to run tests
- **Surgical edits** — No more dumping all files into a single prompt; the agent explores and edits on demand
- **Self-validation** — The agent runs tests and fixes failures before finishing

## Prerequisites

- **Node.js** `^20.19.0` or `>=22.12.0`
- **GitHub Copilot** subscription (or BYOK keys)
- **Git** installed locally

## Configuration

### 1. Environment variables (`.env`)

Copy `.env.example` to `.env` and fill in your credentials:

```bash
# JIRA
JIRA_URL=https://your-domain.atlassian.net
JIRA_USERNAME=you@example.com
JIRA_API_TOKEN=your_token

# GitHub
GITHUB_TOKEN=ghp_xxx

# Copilot SDK
COPILOT_MODEL=gpt-5

# App
PORT=3000
LOG_LEVEL=info
REPO_BASE_PATH=/tmp/agentic-engineer/repos
```

### 2. Repo mappings (`data/repo_mappings.json`)

Create `data/repo_mappings.json` to map JIRA projects to GitHub repos:

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
   npm install
   ```

2. **Run in development mode**
   ```bash
   npm run dev
   ```

3. **Build for production**
   ```bash
   npm run build
   npm start
   ```

4. **Expose the webhook endpoint**
   ```bash
   ngrok http 3000
   ```

5. **Set the JIRA webhook URL**
   Go to **JIRA Settings → System → Webhooks** and create a new webhook:

   | Setting | Value |
   |---------|-------|
   | **URL** | `https://<your-ngrok-url>/webhooks/jira` |
   | **Events** | Issue updated |

## Project Structure

```
├── src/
│   ├── index.ts              # Fastify entrypoint
│   ├── config/               # Zod-validated env config
│   ├── api/                  # Webhook routes
│   ├── services/             # JIRA, GitHub, Copilot SDK clients
│   ├── agent/                # Agent engine, permissions, prompts
│   ├── store/                # JSON repo mappings store
│   ├── types/                # Shared TypeScript interfaces
│   └── utils/                # Logger
├── tests/                    # Vitest test suite
├── data/                     # Runtime repo mappings
├── archive/python/           # v1.0 Python codebase
└── DESIGN.md                 # Architecture design document
```

## Running Tests

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:watch    # Watch mode
```

## Architecture

The agent uses the **GitHub Copilot SDK** to run an autonomous coding session:

1. JIRA webhook triggers the workflow
2. Ticket details are fetched from JIRA
3. The target repo is cloned/pulled
4. A Copilot session is created with the repo as the working directory
5. The agent receives a prompt describing the ticket
6. The agent autonomously:
   - Reads relevant files
   - Plans and implements changes
   - Runs tests
   - Fixes failures
7. Changes are committed, pushed, and a PR is opened

See [DESIGN.md](DESIGN.md) for the full architecture document.

## License

MIT
