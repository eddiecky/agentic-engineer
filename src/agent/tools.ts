import { defineTool } from "@github/copilot-sdk";
import { readFile, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

export function createTools(workingDirectory: string) {
  const readFileTool = defineTool("read_file", {
    description:
      "Read the contents of a file. Returns the full file content as a string. Use this to examine source code, configs, or any text file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file to read (relative to project root)",
        },
      },
      required: ["path"],
    },
    handler: async (args: { path: string }) => {
      const fullPath = `${workingDirectory}/${args.path}`.replace(/\\/g, "/");
      logger.debug({ path: args.path }, "Tool: read_file");
      try {
        const content = await readFile(fullPath, "utf-8");
        return { content };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: message };
      }
    },
  });

  const editFileTool = defineTool("edit_file", {
    description:
      "Make a surgical edit to a file. Replaces old_str with new_str. Both old_str and new_str must match exactly (including whitespace). Use this for precise code changes. If old_str is not found, returns an error.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path to the file (relative to project root)",
        },
        old_str: {
          type: "string",
          description:
            "The exact existing text to replace. Must match the file content precisely.",
        },
        new_str: {
          type: "string",
          description: "The new text to insert in place of old_str.",
        },
      },
      required: ["path", "old_str", "new_str"],
    },
    handler: async (args: { path: string; old_str: string; new_str: string }) => {
      const fullPath = `${workingDirectory}/${args.path}`.replace(/\\/g, "/");
      logger.debug({ path: args.path }, "Tool: edit_file");
      try {
        const content = await readFile(fullPath, "utf-8");
        if (!content.includes(args.old_str)) {
          return {
            error: `old_str not found in file. The file may have changed or the old_str does not match exactly.`,
          };
        }
        const newContent = content.replace(args.old_str, args.new_str);
        await writeFile(fullPath, newContent, "utf-8");
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { error: message };
      }
    },
  });

  const runCommandTool = defineTool("run_command", {
    description:
      "Execute a shell command in the project directory. Returns stdout, stderr, and exit code. Use for running tests, builds, linting, or git commands. Prefer 'read_file' for reading files instead of 'cat'.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
      },
      required: ["command"],
    },
    handler: async (args: { command: string }) => {
      logger.debug({ command: args.command }, "Tool: run_command");
      try {
        const isWindows = process.platform === "win32";
        const { stdout, stderr } = await execAsync(args.command, {
          cwd: workingDirectory,
          timeout: 60000,
          shell: isWindows ? "powershell" : "/bin/sh",
        });
        return {
          stdout: stdout.slice(0, 10000),
          stderr: stderr.slice(0, 5000),
          exitCode: 0,
        };
      } catch (error: any) {
        return {
          stdout: error.stdout?.slice(0, 10000) ?? "",
          stderr: error.stderr?.slice(0, 5000) ?? "",
          exitCode: error.code ?? 1,
          error: error.message,
        };
      }
    },
  });

  const searchCodeTool = defineTool("search_code", {
    description:
      "Search for text patterns in files within the project directory. Returns matching lines with file paths.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "The text or regex pattern to search for",
        },
        path: {
          type: "string",
          description: "Relative directory or file glob to search in (default: project root)",
        },
      },
      required: ["pattern"],
    },
    handler: async (args: { pattern: string; path?: string }) => {
      logger.debug({ pattern: args.pattern }, "Tool: search_code");
      try {
        const target = args.path ?? ".";
        const isWindows = process.platform === "win32";
        const searchPath = `${workingDirectory}/${target}`.replace(/\\/g, "/");
        const grepCmd = isWindows
          ? `Select-String -Path "${searchPath}/*" -Pattern "${args.pattern}" -ErrorAction SilentlyContinue | Select-Object -First 50`
          : `grep -r -n -E "${args.pattern}" "${searchPath}" 2>/dev/null | head -n 50`;

        const { stdout } = await execAsync(grepCmd, {
          cwd: workingDirectory,
          timeout: 30000,
          shell: isWindows ? "powershell" : "/bin/sh",
        });
        return { results: stdout.slice(0, 10000) };
      } catch (error: any) {
        return {
          results: error.stdout?.slice(0, 10000) ?? "",
          error: error.message,
        };
      }
    },
  });

  const listFilesTool = defineTool("list_files", {
    description:
      "List files and directories at a given path. Use this to explore the project structure instead of 'ls' or 'dir'.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative directory path to list (default: project root)",
        },
      },
      required: [],
    },
    handler: async (args: { path?: string }) => {
      const target = args.path ?? ".";
      logger.debug({ path: target }, "Tool: list_files");
      try {
        const isWindows = process.platform === "win32";
        const listPath = `${workingDirectory}/${target}`.replace(/\\/g, "/");
        const cmd = isWindows
          ? `Get-ChildItem -Path "${listPath}" | Select-Object Name, Mode | Format-Table -AutoSize`
          : `ls -la "${listPath}"`;
        const { stdout } = await execAsync(cmd, {
          cwd: workingDirectory,
          timeout: 10000,
          shell: isWindows ? "powershell" : "/bin/sh",
        });
        return { listing: stdout.slice(0, 5000) };
      } catch (error: any) {
        return { listing: "", error: error.message };
      }
    },
  });

  return [
    readFileTool,
    editFileTool,
    runCommandTool,
    searchCodeTool,
    listFilesTool,
  ];
}

