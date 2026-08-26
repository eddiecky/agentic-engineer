import { Octokit } from "@octokit/rest";
import simpleGit from "simple-git";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export class GitService {
  private octokit: Octokit;

  constructor(token: string = config.GITHUB_TOKEN) {
    this.octokit = new Octokit({ auth: token });
  }

  async cloneOrPull(repoUrl: string, localPath: string): Promise<string> {
    const git = simpleGit();
    const authenticatedUrl = this.injectToken(repoUrl);

    try {
      await git.clone(authenticatedUrl, localPath, ["--depth", "1"]);
      logger.info({ localPath }, "Repository cloned");
    } catch {
      // Already exists, pull instead
      const repoGit = simpleGit(localPath);
      await repoGit.pull("origin", "main");
      logger.info({ localPath }, "Repository pulled");
    }

    return localPath;
  }

  async createBranch(localPath: string, branchName: string): Promise<string> {
    const git = simpleGit(localPath);
    await git.checkoutLocalBranch(branchName);
    logger.info({ branchName }, "Branch created");
    return branchName;
  }

  async commitAndPush(localPath: string, branchName: string, message: string): Promise<void> {
    const git = simpleGit(localPath);
    await git.add(".");
    await git.commit(message, undefined, {
      "--author": "Agentic Engineer <agent@example.com>",
    });
    await git.push("origin", branchName);
    logger.info({ branchName, message }, "Changes committed and pushed");
  }

  async createPR(
    repoFullName: string,
    baseBranch: string,
    headBranch: string,
    title: string,
    body: string
  ): Promise<string> {
    const [owner, repo] = repoFullName.split("/");
    const response = await this.octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head: headBranch,
      base: baseBranch,
    });

    const prUrl = response.data.html_url;
    logger.info({ prUrl }, "Pull request created");
    return prUrl;
  }

  private injectToken(repoUrl: string): string {
    const token = config.GITHUB_TOKEN;
    if (repoUrl.startsWith("https://")) {
      return `https://${token}@${repoUrl.slice(8)}`;
    }
    if (repoUrl.startsWith("http://")) {
      return `http://${token}@${repoUrl.slice(7)}`;
    }
    return repoUrl;
  }
}
