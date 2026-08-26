import { CopilotService } from "../services/copilot.js";
import { GitService } from "../services/github.js";
import { JiraService } from "../services/jira.js";
import { RepoMappingStore } from "../store/mappings.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import type { AgentResult, Ticket } from "../types/index.js";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export class AgentEngine {
  private jiraService: JiraService;
  private gitService: GitService;
  private copilotService: CopilotService;

  constructor() {
    this.jiraService = new JiraService();
    this.gitService = new GitService();
    this.copilotService = new CopilotService();
  }

  async initialize(): Promise<void> {
    await this.copilotService.start();
  }

  async shutdown(): Promise<void> {
    await this.copilotService.stop();
  }

  async processTicket(issueKey: string, projectKey: string, ticketData?: Ticket): Promise<AgentResult> {
    logger.info({ issueKey, projectKey }, "Processing ticket");

    // 1. Lookup repo mapping
    const mapping = await RepoMappingStore.getByProject(projectKey);
    if (!mapping) {
      return { success: false, error: `No repo mapping for project ${projectKey}` };
    }

    // 2. Use provided ticket data or fetch from JIRA
    let ticket: Ticket;
    if (ticketData) {
      ticket = ticketData;
      logger.info({ issueKey }, "Using ticket data from webhook");
    } else {
      try {
        ticket = await this.jiraService.getTicket(issueKey);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: `Failed to fetch ticket: ${message}` };
      }
    }

    // 3. Clone or pull repo
    const repoUrl = `https://github.com/${mapping.github_repo}.git`;
    const localPath = join(config.REPO_BASE_PATH, mapping.github_repo.replace("/", "_"));

    try {
      await this.gitService.cloneOrPull(repoUrl, localPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to clone repo: ${message}` };
    }

    // 4. Run Copilot agent
    let agentResult: AgentResult;
    try {
      agentResult = await this.copilotService.runAgent({
        workingDirectory: localPath,
        ticket,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Agent failed: ${message}` };
    }

    if (!agentResult.success) {
      return agentResult;
    }

    // 5. Create branch, commit, push
    const branchName = `agent/${issueKey}-${randomUUID().slice(0, 6)}`;
    try {
      await this.gitService.createBranch(localPath, branchName);
      await this.gitService.commitAndPush(
        localPath,
        branchName,
        `feat(${issueKey}): ${ticket.summary}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to push changes: ${message}` };
    }

    // 6. Create PR
    try {
      const prUrl = await this.gitService.createPR(
        mapping.github_repo,
        mapping.base_branch,
        branchName,
        `${issueKey}: ${ticket.summary}`,
        ticket.description ?? ""
      );
      logger.info({ prUrl }, "Pull request created");
      return { success: true, summary: agentResult.summary, error: undefined };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to create PR: ${message}` };
    }
  }
}
