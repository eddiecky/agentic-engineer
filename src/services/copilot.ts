import { CopilotClient, ToolSet, approveAll } from "@github/copilot-sdk";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import type { AgentResult, Ticket } from "../types/index.js";
import { buildPrompt } from "../agent/prompt.js";
import { createTools } from "../agent/tools.js";

function buildProviderConfig() {
  if (!config.COPILOT_PROVIDER_BASE_URL) {
    return undefined;
  }

  const provider: Record<string, unknown> = {
    type: config.COPILOT_PROVIDER_TYPE ?? "openai",
    baseUrl: config.COPILOT_PROVIDER_BASE_URL,
  };

  if (config.COPILOT_PROVIDER_API_KEY) {
    provider.apiKey = config.COPILOT_PROVIDER_API_KEY;
  }

  if (config.COPILOT_PROVIDER_BEARER_TOKEN) {
    provider.bearerToken = config.COPILOT_PROVIDER_BEARER_TOKEN;
  }

  return provider;
}

export class CopilotService {
  private client: CopilotClient;

  constructor() {
    this.client = new CopilotClient({
      mode: "empty",
      baseDirectory: config.COPILOT_BASE_DIRECTORY,
    });
  }

  async start(): Promise<void> {
    await this.client.start();
    logger.info("Copilot client started");
  }

  async stop(): Promise<void> {
    await this.client.stop();
    logger.info("Copilot client stopped");
  }

  async runAgent(options: {
    workingDirectory: string;
    ticket: Ticket;
  }): Promise<AgentResult> {
    const { workingDirectory, ticket } = options;

    logger.info({ ticketKey: ticket.key, workingDirectory }, "Starting Copilot agent session");

    // Build custom tools bound to this working directory
    const tools = createTools(workingDirectory);
    const toolSet = new ToolSet();
    toolSet.addCustom("*"); // Allow all custom tools

    const sessionConfig: Record<string, unknown> = {
      model: config.COPILOT_MODEL,
      workingDirectory,
      availableTools: toolSet.toArray(),
      tools,
      onPermissionRequest: approveAll,
      systemMessage: {
        mode: "customize",
        sections: {
          identity: {
            action: "replace",
            content:
              "You are a senior software engineer implementing JIRA tickets. You work autonomously and carefully.",
          },
        },
      },
    };

    const provider = buildProviderConfig();
    if (provider) {
      sessionConfig.provider = provider;
    }

    const session = await this.client.createSession(sessionConfig);

    // Track session events
    const events: string[] = [];

    session.on("tool.execution_start", (event) => {
      logger.debug({ tool: event.data.toolName }, "Tool started");
    });

    session.on("tool.execution_complete", (event) => {
      logger.debug({ tool: (event.data as any).toolName }, "Tool completed");
    });

    session.on("assistant.message", (event) => {
      const content = event.data.content;
      events.push(content);
      logger.info({ content: content.slice(0, 200) }, "Agent message");
    });

    // Send the implementation prompt with extended timeout for coding tasks
    const prompt = buildPrompt(ticket);
    logger.debug({ prompt: prompt.slice(0, 200) }, "Sending prompt to agent");

    await session.sendAndWait({ prompt }, 600000); // 10 minutes

    // Collect final summary from events
    const summary = events.length > 0 ? events[events.length - 1] : undefined;

    await session.disconnect();

    logger.info({ ticketKey: ticket.key }, "Agent session completed");

    return {
      success: true,
      summary,
    };
  }
}
