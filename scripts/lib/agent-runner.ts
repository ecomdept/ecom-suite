import { spawn } from "node:child_process";

export interface AgentRunOptions {
  prompt: string;
  cwd: string;
  outputDir: string;
}

export interface AgentRunner {
  name: string;
  run(options: AgentRunOptions): Promise<void>;
}

function runWithPromptOnStdin(command: string, args: string[], cwd: string, prompt: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "inherit", "inherit"] });

    child.on("error", (error) => {
      reject(
        new Error(
          `Could not start "${command}". Check it is installed and on your PATH, and that you are signed in. (${error.message})`,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`"${command}" exited with code ${code}.`));
    });

    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

export const claudeCodeRunner: AgentRunner = {
  name: "claude-code",
  run: ({ prompt, cwd, outputDir }) =>
    runWithPromptOnStdin(
      "claude",
      ["-p", "--add-dir", outputDir, "--permission-mode", "acceptEdits"],
      cwd,
      prompt,
    ),
};

const AGENT_RUNNERS: Record<string, AgentRunner> = {
  "claude-code": claudeCodeRunner,
};

export function resolveAgentRunner(name = process.env.ANALYSIS_AGENT || "claude-code") {
  const runner = AGENT_RUNNERS[name];
  if (!runner) {
    throw new Error(`Unknown agent "${name}". Available agents: ${Object.keys(AGENT_RUNNERS).join(", ")}.`);
  }
  return runner;
}
