import { z } from "zod";
import "dotenv/config";

const configSchema = z.object({
  // JIRA
  JIRA_URL: z.string().url().default("https://your-domain.atlassian.net"),
  JIRA_USERNAME: z.string().default(""),
  JIRA_API_TOKEN: z.string().default(""),

  // GitHub
  GITHUB_TOKEN: z.string().default(""),

  // Copilot SDK
  COPILOT_MODEL: z.string().default("gpt-5"),
  COPILOT_MODE: z.enum(["copilot-cli", "empty"]).default("empty"),
  COPILOT_BASE_DIRECTORY: z.string().default(".copilot"),

  // BYOK Provider (session-level)
  COPILOT_PROVIDER_TYPE: z.enum(["openai", "azure", "anthropic"]).optional(),
  COPILOT_PROVIDER_BASE_URL: z.string().url().optional(),
  COPILOT_PROVIDER_API_KEY: z.string().optional(),
  COPILOT_PROVIDER_BEARER_TOKEN: z.string().optional(),

  // App
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  REPO_BASE_PATH: z.string().default(process.platform === "win32" ? "C:\\tmp\\agentic-engineer\\repos" : "/tmp/agentic-engineer/repos"),
});

export type Config = z.infer<typeof configSchema>;

export const config = configSchema.parse(process.env);
