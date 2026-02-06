import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { env } from "process";

/**
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("[git-copilot] Extension ACTIVATED");
  console.log("[git-copilot] Extension path is:", context.extensionPath);

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
          console.log("[git-copilot] Progress started");
          progress.report({ message: "🚀 Starting Git Copilot…" });

          // 1️⃣ Detect current directory
          const currentDir = getCurrentDirectory();
          if (!currentDir) {
            console.log("[git-copilot] No current directory found");
            return;
          }

          // 2️⃣ Detect git repository root
          const repoPath = findGitRepoRoot(currentDir);
          if (!repoPath) {
            console.log("[git-copilot] No Git repository found in current workspace");
            return;
          }

          // 3️⃣ Run Python agent
          console.log("[git-copilot] Running Python agent");
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
  console.log("[git-copilot] getOrAskOpenAIKey: started");

  const existing = await context.secrets.get("OPENAI_API_KEY");
  if (existing) {
    console.log("[git-copilot] getOrAskOpenAIKey: existing key found");
    return existing;
  }

  console.log("[git-copilot] getOrAskOpenAIKey: no existing key found, asking user");
  const key = await vscode.window.showInputBox({
    title: "Git Copilot – OpenAI API Key Required",
    prompt: "Enter your OpenAI API key (stored securely)",
    password: true,
    ignoreFocusOut: true,
    placeHolder: "sk-..."
  });

  if (!key) {
    console.log("[git-copilot] getOrAskOpenAIKey: user cancelled");
    vscode.window.showErrorMessage(
      "Git Copilot cannot run without an OpenAI API key"
    );
    return null;
  }

  console.log("[git-copilot] getOrAskOpenAIKey: storing key securely");
  await context.secrets.store("OPENAI_API_KEY", key);
  vscode.window.showInformationMessage("OpenAI API key saved securely");

  console.log("[git-copilot] getOrAskOpenAIKey: finished");
  return key;
}

/* -------------------------------------------------- */
/* 🧭 DIRECTORY + GIT HELPERS */
/* -------------------------------------------------- */

function getCurrentDirectory(): string | null {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    console.log("[git-copilot] getCurrentDirectory: from active text editor");
    return path.dirname(editor.document.uri.fsPath);
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders?.length) {
    console.log("[git-copilot] getCurrentDirectory: from workspace folders");
    return folders[0].uri.fsPath;
  }

  console.log("[git-copilot] getCurrentDirectory: no active file or workspace folder found");
  vscode.window.showWarningMessage(
    "No active file or workspace folder found"
  );
  return null;
}

function findGitRepoRoot(startDir: string): string | null {
  console.log("[git-copilot] findGitRepoRoot: started");

  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      console.log("[git-copilot] findGitRepoRoot: found");
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

    console.log("[git-copilot] runPythonAgentWithStreaming: started");

    if (!fs.existsSync(scriptPath)) {
      console.log("[git-copilot] runPythonAgentWithStreaming: Python entry file not found");
      vscode.window.showErrorMessage(
        `Python entry file not found:\n${scriptPath}`
      );
      reject();
      return;
    }

    console.log("[git-copilot] runPythonAgentWithStreaming: spawning Python process");


    const env = {
      ...process.env,
      OPENAI_API_KEY: openaiKey  
    }
    console.log("[git-copilot] runPythonAgentWithStreaming: spawned Python process", env);
    const proc = spawn(pythonPath, [scriptPath], {
      cwd: repoPath,
      env: env,
      stdio: ["pipe", "pipe", "pipe"]
    });

    console.log("[git-copilot] runPythonAgentWithStreaming: process spawned", repoPath, env, openaiKey);

    // Add this immediately after spawn:
    proc.on("error", (err) => {
      console.error("[git-copilot] Process spawn error:", err);
      end(`Failed to start Python process: ${err.message}`);
    });

    console.log("[git-copilot] Process spawned with PID:", proc.pid);



    let buffer = "";
    let finished = false;

    const end = (err?: string) => {
      console.log("[git-copilot] runPythonAgentWithStreaming: process finished");
      if (finished) return;
      finished = true;

      if (err) {
        console.log("[git-copilot] runPythonAgentWithStreaming: error occurred");
        vscode.window.showErrorMessage(`Git Copilot Error:\n${err}`);
        proc.kill();
        reject(new Error(err));
      } else {
        console.log("[git-copilot] runPythonAgentWithStreaming: finished");
        progress.report({ message: "✅ Git Copilot finished" });
        resolve();
      }
    };

    console.log("[git-copilot] runPythonAgentWithStreaming: listening for events");
    proc.stdout.on("data", async (data) => {
      console.log("[git-copilot] runPythonAgentWithStreaming: stdout event received", data.toString());
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);

          console.log("[git-copilot] runPythonAgentWithStreaming: stdout event parsed", event);

          if (event.type === "error") {
            console.log("[git-copilot] runPythonAgentWithStreaming: error event received", event.message);
            end(event.message);
            return;
          }

          if (event.type === "status") {
            console.log("[git-copilot] runPythonAgentWithStreaming: status event received", event.message);
            progress.report({ message: event.message });
          }

          if (event.type === "input_request") {
            console.log("[git-copilot] runPythonAgentWithStreaming: input request event received", event);
            await handleInputRequest(proc, event);
          }

        } catch (err) {
          console.log("[git-copilot] runPythonAgentWithStreaming: stdout error", line, err);
        }
      }
    });

    proc.stderr.on("data", (d) =>
      console.error("[git-copilot] runPythonAgentWithStreaming: stderr error", d.toString())
    );

    proc.on("close", (code) => {
      if (!finished) {
        console.log("[git-copilot] runPythonAgentWithStreaming: finished with code", code);
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

