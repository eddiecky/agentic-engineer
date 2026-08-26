import type { Ticket } from "../types/index.js";

export function buildPrompt(ticket: Ticket): string {
  const description = ticket.description ?? "(no description provided)";

  return `You are implementing the following JIRA ticket. Work autonomously and carefully.

## Ticket
- **Key**: ${ticket.key}
- **Summary**: ${ticket.summary}
- **Description**: ${description}

## Available Tools
You have access to these tools. Use them as needed:
- **read_file** — Read any file in the project. Pass the relative path.
- **edit_file** — Make precise edits. Pass path, old_str (exact text to replace), and new_str.
- **run_command** — Run shell commands (tests, builds, git, etc.).
- **search_code** — Search for patterns across files.
- **list_files** — List directory contents.

## Instructions

Follow this exact workflow:

### Phase 1: Repository Analysis
1. Use list_files and read_file to understand the project structure
2. Identify the tech stack (check package.json, framework files, etc.)
3. List the main source directories and key files
4. Understand the current architecture and patterns used
5. Identify where the feature should be implemented

### Phase 2: Planning
1. Describe your implementation plan BEFORE writing any code
2. List the specific files you will modify and why
3. Explain the approach you will take

### Phase 3: Implementation
1. Make minimal, focused changes to implement the feature
2. Use edit_file for surgical changes — old_str must match exactly
3. Follow existing code patterns and conventions
4. Add any necessary event handlers, state, or UI components
5. Ensure the implementation is complete and functional

### Phase 4: Verification
1. Run the test suite (if available) using run_command
2. Fix any test failures
3. Verify the feature works as expected

### Phase 5: Summary
Provide a brief summary of:
- What files you changed
- What you implemented
- Any notes or considerations

## Rules
- Do NOT modify files unrelated to this ticket
- Do NOT leave incomplete implementations, TODOs, or stubs
- Follow existing code style and patterns
- If stuck after trying, explain the blocker and what you tried
- When using edit_file, old_str must match the file content EXACTLY`;
}
