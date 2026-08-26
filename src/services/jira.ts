import type { Ticket } from "../types/index.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

export class JiraService {
  private baseUrl: string;
  private username: string;
  private apiToken: string;

  constructor(
    baseUrl: string = config.JIRA_URL,
    username: string = config.JIRA_USERNAME,
    apiToken: string = config.JIRA_API_TOKEN
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.username = username;
    this.apiToken = apiToken;
  }

  async getTicket(ticketId: string): Promise<Ticket> {
    const url = `${this.baseUrl}/rest/api/2/issue/${ticketId}`;
    const auth = Buffer.from(`${this.username}:${this.apiToken}`).toString("base64");

    logger.debug({ ticketId, url }, "Fetching JIRA ticket");

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`JIRA API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      id: string;
      key: string;
      fields: {
        summary: string;
        description: string | null;
        status: { name: string };
        issuetype: { name: string };
      };
    };

    return {
      id: data.id,
      key: data.key,
      summary: data.fields.summary,
      description: data.fields.description,
      status: data.fields.status.name,
      issueType: data.fields.issuetype.name,
    };
  }
}
