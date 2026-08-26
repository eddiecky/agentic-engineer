import { describe, it, expect } from "vitest";
import { customPermissionHandler } from "../../../src/agent/permissions.js";

describe("customPermissionHandler", () => {
  it("should approve file reads for session", () => {
    const result = customPermissionHandler({ kind: "read" } as any);
    expect(result.kind).toBe("approve-for-session");
  });

  it("should approve file writes for session", () => {
    const result = customPermissionHandler({ kind: "write" } as any);
    expect(result.kind).toBe("approve-for-session");
  });

  it("should approve test commands", () => {
    const result = customPermissionHandler({
      kind: "shell",
      fullCommandText: "npm test",
    } as any);
    expect(result.kind).toBe("approve-for-session");
  });

  it("should approve pytest commands", () => {
    const result = customPermissionHandler({
      kind: "shell",
      fullCommandText: "pytest tests/",
    } as any);
    expect(result.kind).toBe("approve-for-session");
  });

  it("should reject dangerous shell commands", () => {
    const result = customPermissionHandler({
      kind: "shell",
      fullCommandText: "rm -rf /",
    } as any);
    expect(result.kind).toBe("reject");
  });

  it("should approve safe read-only commands once", () => {
    const result = customPermissionHandler({
      kind: "shell",
      fullCommandText: "git status",
    } as any);
    expect(result.kind).toBe("approve-once");
  });

  it("should approve MCP tools once", () => {
    const result = customPermissionHandler({ kind: "mcp" } as any);
    expect(result.kind).toBe("approve-once");
  });
});
