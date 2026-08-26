# Agentic Engineer — Design Document

> **Version:** 2.0  
> **Date:** 2026-08-26  
> **Status:** Draft  
> **Language:** Node.js / TypeScript  
> **Agent Runtime:** GitHub Copilot SDK (`@github/copilot-sdk`)

---

## 1. Overview

Agentic Engineer is an autonomous coding agent that receives JIRA webhooks and opens GitHub PRs with AI-generated code changes. This v2.0 rewrite replaces the Python/LangGraph single-shot prompt architecture with a Node.js/TypeScript codebase powered by the **GitHub Copilot SDK** — a production agent runtime that handles planning, tool invocation, file editing, and self-correction automatically.

### Key Improvements Over v1.0 (Python)

| Aspect | v1.0 (Python) | v2.0 (Node.js + Copilot SDK) |
|--------|---------------|------------------------------|
| **Orchestration** | Hardcoded 6-node LangGraph pipeline | Copilot agent decides its own plan |
| **Code changes** | Dumps all files into one prompt, overwrites everything | Reads relevant files, makes surgical edits |
| **Validation** | None — PR opened regardless | Agent runs tests and self-corrects |
| **Context window** | Limited to ~20 files | Infinite sessions with automatic compaction |
| **Failure handling** | Silent bad PR | Agent retries, verifies, reports errors |
| **Tool use** | None — LLM generates raw text | Built-in `read_file`, `edit_file`, `run_command`, `search_code` |

---

## 2. Architecture

### 2.1 High-Level Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ JIRA Issue  │────▶│ Webhook API  │────▶│ Fetch Ticket    │
│ Transitioned│     │ (Fastify)    │     │ (JIRA Service)  │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                  │
                                                  ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ GitHub PR   │◀────│ Commit & PR  │◀────│ Clone / Pull    │
│ Opened      │     │ (Git Service)│     │ (Git Service)   │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │ Copilot Session │
                                         │ (Agent Runtime) │
                                         └─────────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
            ┌─────────────┐              ┌─────────────┐              ┌─────────────┐
            │ Read Files  │              │ Edit Files  │              │ Run Tests   │
            │ (built-in)  │              │ (built-in)  │              │ (built-in)  │
            └─────────────┘              └─────────────┘              └─────────────┘
```

### 2.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Agentic Engineer                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Config      │  │ Store       │  │ Webhook API │  │ Agent Engine        │ │
│  │ (Zod + env) │  │ (JSON file) │  │ (Fastify)   │  │ (Copilot SDK)       │ │
│  └─────────────┘  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
│                                            │                                 │
│  ┌─────────────────────────────────────────┼─────────────────────────────────┤
│  │           Services Layer                │                                 │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───┴─────────────┐                  │
│  │  │ JIRA Service│  │ Git Service │  │ Copilot Service │                  │
│  │  │ (REST API)  │  │ (Octokit +  │  │ (SDK Client +   │                  │
│  │  │             │  │  git CLI)   │  │  Session Mgr)   │                  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘                  │
│  └──────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Components

### 3.1 Config (`src/config/index.ts`)

Zod-validated environment configuration. Replaces Python's `pydantic-settings`.

```typescript
interface Config {
  // JIRA
  JIRA_URL: string;
  JIRA_USERNAME: string;
  JIRA_API_TOKEN: string;

  // GitHub
  GITHUB_TOKEN: string;

  // Copilot SDK
  COPILOT_MODEL: string;           // e.g. "gpt-5", "claude-sonnet-4.5"
  COPILOT_MODE: "copilot-cli" | "empty";

  // App
  PORT: number;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
  REPO_BASE_PATH: string;          // Where repos are cloned
}
```

### 3.2 Store (`src/store/mappings.ts`)

JSON file-based store for JIRA project → GitHub repo mappings. Same format as v1.0.

```typescript
interface RepoMapping {
  id: number;
  jira_project_key: string;
  github_repo: string;   // "owner/repo"
  base_branch: string;   // default "main"
}
```

### 3.3 Webhook API (`src/api/webhooks.ts`)

Fastify route handler for JIRA webhooks.

**Endpoint:** `POST /webhooks/jira`

**Validation:**
- Must contain `issue` object with `key` and `fields.project.key`
- Project must have a repo mapping in the store

**Flow:**
1. Parse and validate JIRA payload
2. Look up repo mapping
3. Enqueue background job (via `p-queue` or Fastify's `onSend` hook)
4. Return `202 Accepted` immediately

### 3.4 JIRA Service (`src/services/jira.ts`)

Async REST client for JIRA API using `fetch` or `axios`.

```typescript
class JiraService {
  async getTicket(ticketId: string): Promise<Ticket>;
}

interface Ticket {
  id: string;
  key: string;
  summary: string;
  description: string | null;
  status: string;
  issueType: string;
}
```

### 3.5 Git Service (`src/services/github.ts`)

Wraps Octokit (GitHub API) and `git` CLI (via `simple-git` or `child_process`).

```typescript
class GitService {
  cloneOrPull(repoUrl: string, localPath: string): Promise<string>;
  createBranch(localPath: string, branchName: string): Promise<string>;
  commitAndPush(localPath: string, branchName: string, message: string): Promise<void>;
  createPR(repoFullName: string, base: string, head: string, title: string, body: string): Promise<string>;
}
```

### 3.6 Copilot Service (`src/services/copilot.ts`)

Manages the Copilot SDK client lifecycle and session creation.

```typescript
class CopilotService {
  private client: CopilotClient;

  async start(): Promise<void>;
  async stop(): Promise<void>;

  async runAgent(options: AgentOptions): Promise<AgentResult>;
}

interface AgentOptions {
  workingDirectory: string;
  ticket: Ticket;
  onPermissionRequest?: PermissionHandler;
}

interface AgentResult {
  success: boolean;
  summary?: string;
  error?: string;
}
```

---

## 4. Agent Engine (`src/agent/engine.ts`)

The core orchestration logic. This is where the Copilot SDK is invoked.

### 4.1 Session Configuration

```typescript
const session = await client.createSession({
  model: config.COPILOT_MODEL,
  workingDirectory: repoPath,
  onPermissionRequest: customPermissionHandler,  // or approveAll
  systemMessage: {
    mode: "customize",
    sections: {
      identity: {
        action: "replace",
        content: "You are a senior software engineer implementing JIRA tickets.",
      },
      guidelines: {
        action: "append",
        content: `
- Read relevant files before making changes
- Make minimal, focused edits
- Run the test suite after changes
- Fix any test failures
- Do not modify files unrelated to the ticket
        `,
      },
    },
  },
});
```

### 4.2 Prompt Template

```
Implement the following JIRA ticket:

Ticket: {ticket.key}
Summary: {ticket.summary}
Description: {ticket.description || "(no description)"}

The repository is checked out at the current working directory.
Please:
1. Read the relevant files to understand the codebase
2. Plan your changes
3. Implement the necessary code changes
4. Run the test suite to verify your changes
5. Fix any test failures
6. Report what you changed
```

### 4.3 Permission Handler

For a server environment, we want to auto-approve safe operations but reject dangerous ones:

```typescript
function customPermissionHandler(request: PermissionRequest): PermissionRequestResult {
  // Auto-approve file reads
  if (request.kind === "read") {
    return { kind: "approve-for-session" };
  }

  // Auto-approve file writes within the repo
  if (request.kind === "write") {
    return { kind: "approve-for-session" };
  }

  // Auto-approve test commands
  if (request.kind === "shell" && isTestCommand(request.fullCommandText)) {
    return { kind: "approve-for-session" };
  }

  // Reject other shell commands
  if (request.kind === "shell") {
    return {
      kind: "reject",
      feedback: "Shell commands are restricted. Only test commands are allowed.",
    };
  }

  // Default: approve once
  return { kind: "approve-once" };
}
```

### 4.4 Event Handling

Listen for session events to track progress:

```typescript
session.on("tool.execution_start", (event) => {
  logger.info(`Tool started: ${event.data.toolName}`);
});

session.on("tool.execution_complete", (event) => {
  logger.info(`Tool completed: ${event.data.toolName}`);
});

session.on("assistant.message", (event) => {
  logger.info(`Agent: ${event.data.content}`);
});

session.on("session.idle", () => {
  logger.info("Agent session completed");
});
```

---

## 5. Data Flow

### 5.1 Webhook → PR (Happy Path)

```
1. JIRA sends webhook (issue transitioned to "In Progress")
2. Fastify receives POST /webhooks/jira
3. Validate payload → extract issue key + project key
4. Lookup repo mapping in JSON store
5. Return 202 Accepted to JIRA
6. Background job starts:
   a. Fetch ticket details from JIRA API
   b. Clone or pull repo to REPO_BASE_PATH/{owner}_{repo}
   c. Create Copilot session with workingDirectory = repo path
   d. Send implementation prompt to session
   e. Copilot agent autonomously reads, edits, tests
   f. Wait for session.idle event
   g. Create branch: agent/{ticket-key}-{short-id}
   h. Commit and push
   i. Create GitHub PR
   j. Log PR URL
```

### 5.2 Error Handling

| Failure Point | Behavior |
|---------------|----------|
| Invalid webhook payload | Return 400 Bad Request |
| No repo mapping | Return 404 Not Found |
| JIRA API failure | Log error, abort job |
| Git clone failure | Log error, abort job |
| Copilot session error | Log error, abort job (no PR created) |
| Test failures after agent edits | Agent retries (built-in), or abort if persistent |
| PR creation failure | Log error, branch exists but no PR |

---

## 6. File Structure

```
agentic-engineer/
├── src/
│   ├── config/
│   │   └── index.ts              # Zod schema + env validation
│   ├── api/
│   │   └── webhooks.ts           # Fastify webhook routes
│   ├── services/
│   │   ├── jira.ts               # JIRA REST client
│   │   ├── github.ts             # Octokit + git CLI wrapper
│   │   └── copilot.ts            # Copilot SDK client manager
│   ├── agent/
│   │   ├── engine.ts             # Main orchestration: session → prompt → wait → result
│   │   ├── permissions.ts        # Permission handler logic
│   │   └── prompt.ts             # Prompt templates
│   ├── store/
│   │   └── mappings.ts           # JSON file store for repo mappings
│   ├── types/
│   │   └── index.ts              # Shared TypeScript interfaces
│   ├── utils/
│   │   └── logger.ts             # Pino logger setup
│   └── index.ts                  # Fastify bootstrap + graceful shutdown
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── jira.test.ts
│   │   │   ├── github.test.ts
│   │   │   └── copilot.test.ts
│   │   ├── store/
│   │   │   └── mappings.test.ts
│   │   └── agent/
│   │       ├── permissions.test.ts
│   │       └── prompt.test.ts
│   ├── integration/
│   │   └── webhooks.test.ts      # Fastify inject tests
│   └── fixtures/
│       ├── jira-payload.json
│       └── repo-mappings.json
├── data/
│   └── repo_mappings.json        # Runtime repo mappings (gitignored in prod)
├── archive/
│   └── python/                   # v1.0 Python codebase
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.js
└── README.md
```

---

## 7. Dependencies

### Production

| Package | Purpose |
|---------|---------|
| `@github/copilot-sdk` | Copilot agent runtime |
| `fastify` | HTTP server + webhook API |
| `octokit` | GitHub REST/GraphQL API |
| `simple-git` | Git CLI wrapper |
| `zod` | Runtime schema validation |
| `pino` | Structured logging |
| `dotenv` | `.env` file loading |

### Development

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler |
| `tsx` | TypeScript execution (dev) |
| `vitest` | Test runner |
| `@types/node` | Node.js type definitions |
| `eslint` | Linting |

---

## 8. Configuration

### Environment Variables (`.env`)

```bash
# JIRA
JIRA_URL=https://your-domain.atlassian.net
JIRA_USERNAME=you@example.com
JIRA_API_TOKEN=your_token

# GitHub
GITHUB_TOKEN=ghp_xxx

# Copilot SDK
COPILOT_MODEL=gpt-5
# Optional: BYOK provider
# COPILOT_PROVIDER_BASE_URL=https://api.openai.com/v1
# COPILOT_PROVIDER_API_KEY=sk-...

# App
PORT=3000
LOG_LEVEL=info
REPO_BASE_PATH=/tmp/agentic-engineer/repos
```

### Repo Mappings (`data/repo_mappings.json`)

Same format as v1.0:

```json
{
  "1": {
    "jira_project_key": "PROJ",
    "github_repo": "acme/rocket",
    "base_branch": "main"
  }
}
```

---

## 9. Testing Strategy

### Unit Tests

- **JIRA Service:** Mock `fetch`, test `getTicket` response parsing
- **Git Service:** Mock `simple-git` and `octokit`, test clone/branch/PR flow
- **Copilot Service:** Mock `CopilotClient`, test session creation and event handling
- **Store:** Test CRUD operations on JSON file
- **Permissions:** Test permission handler decisions for each `kind`
- **Prompts:** Test prompt template rendering

### Integration Tests

- **Webhook API:** Use Fastify's `inject()` to test routes with mocked services
- **End-to-end:** Mock all external APIs, verify full webhook → PR flow

### Test Commands

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch    # Watch mode
```

---

## 10. Deployment & Operations

### Local Development

```bash
npm install
npm run dev           # tsx watch src/index.ts
```

### Production

```bash
npm run build         # tsc
npm start             # node dist/index.js
```

### Docker (Future)

```dockerfile
FROM node:22-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
CMD ["node", "dist/index.js"]
```

---

## 11. Security Considerations

1. **Webhook validation:** JIRA webhooks should be validated (signature or IP allowlist)
2. **Permission boundaries:** The Copilot permission handler must reject dangerous shell commands
3. **Token storage:** GitHub and JIRA tokens in environment variables, never committed
4. **Repo isolation:** Each ticket gets its own clone to prevent cross-contamination
5. **Network:** Copilot SDK communicates with GitHub APIs — ensure egress is allowed

---

## 12. Migration Notes (v1.0 → v2.0)

| v1.0 (Python) | v2.0 (Node.js) | Notes |
|---------------|----------------|-------|
| `config.py` | `src/config/index.ts` | Zod instead of Pydantic |
| `store.py` | `src/store/mappings.ts` | Same JSON format |
| `api/webhooks.py` | `src/api/webhooks.ts` | Fastify instead of FastAPI |
| `services/jira_service.py` | `src/services/jira.ts` | `fetch` instead of `httpx` |
| `services/github_service.py` | `src/services/github.ts` | Octokit + simple-git |
| `services/llm_service.py` | `src/services/copilot.ts` | Copilot SDK replaces raw LLM calls |
| `agents/workflow.py` | `src/agent/engine.ts` | Copilot agent loop replaces LangGraph |
| `tests/` | `tests/` | Vitest instead of pytest |
| `pyproject.toml` | `package.json` | npm instead of pip |

---

## 13. Open Questions

1. **Webhook queueing:** Should we use `p-queue`, BullMQ, or Fastify's built-in hooks for background jobs?
2. **Session persistence:** Should we persist Copilot session IDs to resume long-running tasks?
3. **Multi-tenancy:** How should repo mappings scale beyond a single JSON file?
4. **Observability:** Should we integrate OpenTelemetry via the SDK's built-in telemetry?
5. **PR review:** Should the agent also handle PR review comments (future feature)?

---

## 14. References

- [GitHub Copilot SDK](https://github.com/github/copilot-sdk)
- [Copilot SDK Node.js README](https://github.com/github/copilot-sdk/tree/main/nodejs)
- [Getting Started Guide](https://github.com/github/copilot-sdk/blob/main/docs/getting-started.md)
- [Permission Handling](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md#permission-handling)
- [System Message Customization](https://github.com/github/copilot-sdk/blob/main/nodejs/README.md#system-message-customization)
