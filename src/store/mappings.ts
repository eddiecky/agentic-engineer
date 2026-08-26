import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import type { RepoMapping } from "../types/index.js";

function getMappingsFile(): string {
  return join(process.cwd(), "data", "repo_mappings.json");
}

interface MappingsData {
  [key: string]: {
    jira_project_key: string;
    github_repo: string;
    base_branch?: string;
  };
}

async function readMappings(): Promise<MappingsData> {
  const file = getMappingsFile();
  if (!existsSync(file)) {
    return {};
  }
  const raw = await readFile(file, "utf-8");
  return JSON.parse(raw) as MappingsData;
}

async function writeMappings(data: MappingsData): Promise<void> {
  const file = getMappingsFile();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export class RepoMappingStore {
  static async listAll(): Promise<RepoMapping[]> {
    const data = await readMappings();
    return Object.entries(data).map(([key, val]) => ({
      id: parseInt(key, 10),
      jira_project_key: val.jira_project_key,
      github_repo: val.github_repo,
      base_branch: val.base_branch ?? "main",
    }));
  }

  static async getByProject(jiraProjectKey: string): Promise<RepoMapping | undefined> {
    const mappings = await this.listAll();
    return mappings.find((m) => m.jira_project_key === jiraProjectKey);
  }

  static async create(
    jiraProjectKey: string,
    githubRepo: string,
    baseBranch = "main"
  ): Promise<RepoMapping> {
    const data = await readMappings();
    const newId = Math.max(0, ...Object.keys(data).map((k) => parseInt(k, 10))) + 1;
    data[String(newId)] = {
      jira_project_key: jiraProjectKey,
      github_repo: githubRepo,
      base_branch: baseBranch,
    };
    await writeMappings(data);
    return { id: newId, jira_project_key: jiraProjectKey, github_repo: githubRepo, base_branch: baseBranch };
  }

  static async delete(mappingId: number): Promise<boolean> {
    const data = await readMappings();
    const key = String(mappingId);
    if (!(key in data)) {
      return false;
    }
    delete data[key];
    await writeMappings(data);
    return true;
  }
}
