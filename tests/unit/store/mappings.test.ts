import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RepoMappingStore } from "../../../src/store/mappings.js";

// Override the data directory for tests
const testDir = mkdtempSync(join(tmpdir(), "agentic-engineer-test-"));
const testDataDir = join(testDir, "data");
const testDataFile = join(testDataDir, "repo_mappings.json");

// We need to mock the DATA_DIR in the store module
// For simplicity, we'll test via the public API and use a temp file
// by temporarily overriding process.cwd()

describe("RepoMappingStore", () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    process.cwd = () => testDir;
    mkdirSync(testDataDir, { recursive: true });
    writeFileSync(testDataFile, JSON.stringify({}), "utf-8");
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should list all mappings", async () => {
    writeFileSync(
      testDataFile,
      JSON.stringify({
        "1": { jira_project_key: "PROJ", github_repo: "acme/rocket", base_branch: "main" },
      }),
      "utf-8"
    );

    const mappings = await RepoMappingStore.listAll();
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toEqual({
      id: 1,
      jira_project_key: "PROJ",
      github_repo: "acme/rocket",
      base_branch: "main",
    });
  });

  it("should get mapping by project key", async () => {
    writeFileSync(
      testDataFile,
      JSON.stringify({
        "1": { jira_project_key: "PROJ", github_repo: "acme/rocket" },
      }),
      "utf-8"
    );

    const mapping = await RepoMappingStore.getByProject("PROJ");
    expect(mapping).toBeDefined();
    expect(mapping?.github_repo).toBe("acme/rocket");
  });

  it("should return undefined for unknown project", async () => {
    const mapping = await RepoMappingStore.getByProject("UNKNOWN");
    expect(mapping).toBeUndefined();
  });

  it("should create a new mapping", async () => {
    const mapping = await RepoMappingStore.create("NEW", "owner/repo", "develop");
    expect(mapping.id).toBe(1);
    expect(mapping.jira_project_key).toBe("NEW");
    expect(mapping.github_repo).toBe("owner/repo");
    expect(mapping.base_branch).toBe("develop");
  });

  it("should delete a mapping", async () => {
    await RepoMappingStore.create("DEL", "owner/repo");
    const result = await RepoMappingStore.delete(1);
    expect(result).toBe(true);

    const mapping = await RepoMappingStore.getByProject("DEL");
    expect(mapping).toBeUndefined();
  });

  it("should return false when deleting non-existent mapping", async () => {
    const result = await RepoMappingStore.delete(999);
    expect(result).toBe(false);
  });
});
