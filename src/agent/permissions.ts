import type { PermissionRequest, PermissionRequestResult } from "@github/copilot-sdk";
import { logger } from "../utils/logger.js";

function isTestCommand(command: string): boolean {
  const testPatterns = [
    /^npm test/,
    /^npm run test/,
    /^pytest/,
    /^python -m pytest/,
    /^jest/,
    /^vitest/,
    /^cargo test/,
    /^go test/,
    /^dotnet test/,
  ];
  return testPatterns.some((pattern) => pattern.test(command.trim()));
}

export function customPermissionHandler(
  request: PermissionRequest
): PermissionRequestResult {
  logger.debug({ kind: request.kind, tool: (request as any).toolName }, "Permission request");

  // Auto-approve file reads
  if (request.kind === "read") {
    return { kind: "approve-for-session" };
  }

  // Auto-approve file writes
  if (request.kind === "write") {
    return { kind: "approve-for-session" };
  }

  // Auto-approve safe shell commands (tests, lint, build)
  if (request.kind === "shell") {
    const cmd = (request as any).fullCommandText ?? "";
    if (isTestCommand(cmd)) {
      return { kind: "approve-for-session" };
    }
    // Allow common safe commands
    const safePrefixes = ["git status", "git diff", "ls", "cat", "find", "grep"];
    if (safePrefixes.some((prefix) => cmd.startsWith(prefix))) {
      return { kind: "approve-once" };
    }
    // Reject potentially dangerous commands
    return {
      kind: "reject",
      feedback:
        "Shell commands are restricted. Only test commands and safe read-only commands are allowed.",
    };
  }

  // Auto-approve MCP and custom tools
  if (request.kind === "mcp" || request.kind === "custom-tool") {
    return { kind: "approve-once" };
  }

  // Default: approve once
  return { kind: "approve-once" };
}
