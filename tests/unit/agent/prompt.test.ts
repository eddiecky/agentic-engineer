import { describe, it, expect } from "vitest";
import { buildPrompt } from "../../../src/agent/prompt.js";
import type { Ticket } from "../../../src/types/index.js";

describe("buildPrompt", () => {
  it("should include ticket details in the prompt", () => {
    const ticket: Ticket = {
      id: "1",
      key: "PROJ-42",
      summary: "Add auth middleware",
      description: "Implement JWT-based authentication",
      status: "Open",
      issueType: "Story",
    };

    const prompt = buildPrompt(ticket);

    expect(prompt).toContain("PROJ-42");
    expect(prompt).toContain("Add auth middleware");
    expect(prompt).toContain("Implement JWT-based authentication");
    expect(prompt).toContain("read_file");
    expect(prompt).toContain("edit_file");
    expect(prompt).toContain("Run the test suite");
  });

  it("should handle missing description", () => {
    const ticket: Ticket = {
      id: "1",
      key: "PROJ-42",
      summary: "Add auth middleware",
      description: null,
      status: "Open",
      issueType: "Story",
    };

    const prompt = buildPrompt(ticket);

    expect(prompt).toContain("(no description provided)");
  });
});
