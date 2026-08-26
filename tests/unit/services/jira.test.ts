import { describe, it, expect, vi, beforeEach } from "vitest";
import { JiraService } from "../../../src/services/jira.js";

describe("JiraService", () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should fetch and parse a ticket", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "10001",
        key: "TEST-1",
        fields: {
          summary: "Test summary",
          description: "Test description",
          status: { name: "Open" },
          issuetype: { name: "Bug" },
        },
      }),
    });

    const service = new JiraService("https://jira.test", "user", "token");
    const ticket = await service.getTicket("TEST-1");

    expect(ticket.key).toBe("TEST-1");
    expect(ticket.summary).toBe("Test summary");
    expect(ticket.status).toBe("Open");
    expect(ticket.issueType).toBe("Bug");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://jira.test/rest/api/2/issue/TEST-1",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining("Basic "),
        }),
      })
    );
  });

  it("should throw on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const service = new JiraService("https://jira.test", "user", "token");
    await expect(service.getTicket("MISSING-1")).rejects.toThrow("JIRA API error: 404 Not Found");
  });
});
