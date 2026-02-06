import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

/**
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("[git-copilot] Extension ACTIVATED");
  console.log("[git-copilot] Extension path:", context.extensionPath);

  const disposable = vscode.commands.registerCommand(
    "git-copilot.runAgent",
    async () => {
      console.log("[git-copilot] Command invoked: runAgent");

      // 🔐 Ensure OpenAI key exists
      const openaiKey = await getOrAskOpenAIKey(context);
      if (!openaiKey) return;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Git Copilot",
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: "🚀 Starting Git Copilot…" });

          // 1️⃣ Detect current directory
          const currentDir = getCurrentDirectory();
          if (!currentDir) return;

          // 2️⃣ Detect git repository root
          const repoPath = findGitRepoRoot(currentDir);
          if (!repoPath) {
            vscode.window.showWarningMessage(
              "No Git repository found in current workspace"
            );
            return;
          }

          // 3️⃣ Run Python agent
          await runPythonAgentWithStreaming(
            context,
            progress,
            repoPath,
            openaiKey
          );
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

/* -------------------------------------------------- */
/* 🔐 OPENAI KEY HANDLING */
/* -------------------------------------------------- */

async function getOrAskOpenAIKey(
  context: vscode.ExtensionContext
): Promise<string | null> {

  const existing = await context.secrets.get("OPENAI_API_KEY");
  if (existing) return existing;

  const key = await vscode.window.showInputBox({
    title: "Git Copilot – OpenAI API Key Required",
    prompt: "Enter your OpenAI API key (stored securely)",
    password: true,
    ignoreFocusOut: true,
    placeHolder: "sk-..."
  });

  if (!key) {
    vscode.window.showErrorMessage(
      "Git Copilot cannot run without an OpenAI API key"
    );
    return null;
  }

  await context.secrets.store("OPENAI_API_KEY", key);
  vscode.window.showInformationMessage("OpenAI API key saved securely");

  return key;
}

/* -------------------------------------------------- */
/* 🧭 DIRECTORY + GIT HELPERS */
/* -------------------------------------------------- */

function getCurrentDirectory(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    return path.dirname(editor.document.uri.fsPath);
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders?.length) {
    return folders[0].uri.fsPath;
  }

  vscode.window.showWarningMessage(
    "No active file or workspace folder found"
  );
  return null;
}

function findGitRepoRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/* -------------------------------------------------- */
/* 🐍 PYTHON RUNNER */
/* -------------------------------------------------- */

async function runPythonAgentWithStreaming(
  context: vscode.ExtensionContext,
  progress: vscode.Progress<{ message?: string }>,
  repoPath: string,
  openaiKey: string
): Promise<void> {

  return new Promise((resolve, reject) => {

    const pythonPath = path.join(
      context.extensionPath,
      "python",
      "venv",
      "bin",
      "python"
    );

    const scriptPath = path.join(
      context.extensionPath,
      "python",
      "main.py"
    );

    if (!fs.existsSync(scriptPath)) {
      vscode.window.showErrorMessage(
        `Python entry file not found:\n${scriptPath}`
      );
      reject();
      return;
    }

    const proc = spawn(pythonPath, [scriptPath], {
      cwd: repoPath,
      env: {
        ...process.env,
        OPENAI_API_KEY: openaiKey   // 🔐 injected securely
      },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let buffer = "";
    let finished = false;

    const end = (err?: string) => {
      if (finished) return;
      finished = true;

      if (err) {
        vscode.window.showErrorMessage(`Git Copilot Error:\n${err}`);
        proc.kill();
        reject(new Error(err));
      } else {
        progress.report({ message: "✅ Git Copilot finished" });
        resolve();
      }
    };

    proc.stdout.on("data", async (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);

          if (event.type === "error") {
            end(event.message);
            return;
          }

          if (event.type === "status") {
            progress.report({ message: event.message });
          }

          if (event.type === "input_request") {
            await handleInputRequest(proc, event);
          }

        } catch {
          console.log("[git-copilot][stdout]", line);
        }
      }
    });

    proc.stderr.on("data", (d) =>
      console.error("[git-copilot][stderr]", d.toString())
    );

    proc.on("close", (code) => {
      if (!finished) {
        code === 0 ? end() : end("Python process failed");
      }
    });
  });
}

/* -------------------------------------------------- */
/* 🎛 USER INPUT HANDLER */
/* -------------------------------------------------- */

async function handleInputRequest(proc: any, event: any): Promise<void> {

  const qp = vscode.window.createQuickPick<vscode.QuickPickItem>();
  qp.canSelectMany = true;
  qp.title = event.prompt;

  const files = event.options.map((p: string) => ({
    label: path.basename(p),
    description: p
  }));

  qp.items = [
    { label: "🔹 Select all files", alwaysShow: true },
    { label: "❌ Cancel", alwaysShow: true },
    ...files
  ];

  return new Promise((resolve) => {
    qp.onDidAccept(() => {
      let value: string[] = [];

      if (qp.selectedItems.some(i => i.label.startsWith("❌"))) {
        value = [];
      } else if (qp.selectedItems.some(i => i.label.startsWith("🔹"))) {
        value = files.map((f: vscode.QuickPickItem) => f.description!).filter(Boolean);
      } else {
        value = qp.selectedItems.map(i => i.description!).filter(Boolean);
      }

      proc.stdin.write(JSON.stringify({ key: event.key, value }) + "\n");
      qp.hide();
      resolve();
    });

    qp.onDidHide(() => {
      qp.dispose();
      resolve();
    });

    qp.show();
  });
}

/**
 * Called when the extension is deactivated
 */
export function deactivate() {
  console.log("[git-copilot] Extension DEACTIVATED");
}
