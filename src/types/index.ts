/**
 * Shared TypeScript interfaces for Agentic Engineer
 */

export interface Ticket {
  id: string;
  key: string;
  summary: string;
  description: string | null;
  status: string;
  issueType: string;
}

export interface RepoMapping {
  id: number;
  jira_project_key: string;
  github_repo: string;
  base_branch: string;
}

export interface AgentResult {
  success: boolean;
  summary?: string;
  error?: string;
}

export interface JiraWebhookPayload {
  issue?: {
    id?: string;
    key: string;
    fields: {
      project: {
        key: string;
      };
      summary: string;
      description?: string | null;
      status?: { name: string };
      issuetype?: { name: string };
    };
  };
  issue_event_type_name?: string;
}
