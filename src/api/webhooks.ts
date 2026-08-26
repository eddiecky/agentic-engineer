import type { FastifyInstance } from "fastify";
import { RepoMappingStore } from "../store/mappings.js";
import { AgentEngine } from "../agent/engine.js";
import { logger } from "../utils/logger.js";
import type { JiraWebhookPayload } from "../types/index.js";

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  const agentEngine = new AgentEngine();
  await agentEngine.initialize();

  fastify.addHook("onClose", async () => {
    await agentEngine.shutdown();
  });

  fastify.post<{
    Body: JiraWebhookPayload;
  }>("/jira", async (request, reply) => {
    const payload = request.body;

    // Extract issue data
    let issue = payload.issue;
    if (!issue && payload.issue_event_type_name) {
      // Some JIRA webhooks wrap the issue differently
      issue = payload as unknown as JiraWebhookPayload["issue"];
    }

    if (!issue) {
      return reply.status(400).send({ error: "No issue data in payload" });
    }

    const issueKey = issue.key;
    const projectKey = issue.fields?.project?.key;

    if (!issueKey || !projectKey) {
      return reply.status(400).send({ error: "Missing issue key or project key" });
    }

    // Lookup repo mapping
    const mapping = await RepoMappingStore.getByProject(projectKey);
    if (!mapping) {
      return reply.status(404).send({ error: `No repo mapping for project ${projectKey}` });
    }

    // Build ticket from webhook payload to avoid redundant JIRA fetch
    const ticket = {
      id: issue.id || "",
      key: issueKey,
      summary: issue.fields.summary || "",
      description: issue.fields.description || null,
      status: issue.fields.status?.name || "Unknown",
      issueType: issue.fields.issuetype?.name || "Unknown",
    };

    // Process in background (don't await)
    agentEngine
      .processTicket(issueKey, projectKey, ticket)
      .then((result) => {
        if (result.success) {
          logger.info({ issueKey }, "Ticket processed successfully");
        } else {
          logger.error({ issueKey, error: result.error }, "Ticket processing failed");
        }
      })
      .catch((error) => {
        logger.error({ issueKey, error }, "Unexpected error processing ticket");
      });

    return reply.status(202).send({ status: "accepted", ticket_id: issueKey });
  });
}
