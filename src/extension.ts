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
          if (!currentDir) {
            console.warn("[git-copilot] No current directory found");
            return;
          }

          console.log("[git-copilot] Current directory:", currentDir);

          // 2️⃣ Detect git repository root
          const repoPath = findGitRepoRoot(currentDir);
          if (!repoPath) {
            vscode.window.showWarningMessage(
              "No Git repository found starting from current directory"
            );
            return;
          }

          console.log("[git-copilot] Git repository root:", repoPath);
          progress.report({ message: "📂 Git repository detected" });

          // 3️⃣ Run Python agent (inside extension) and stream output
          await runPythonAgentWithStreaming(
            context,
            progress,
            repoPath
          );
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * Returns the "current working directory" in VS Code terms
 * - Active file directory
 * - OR workspace root
 */
function getCurrentDirectory(): string | null {
  const editor = vscode.window.activeTextEditor;

  if (editor) {
    return path.dirname(editor.document.uri.fsPath);
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    return workspaceFolders[0].uri.fsPath;
  }

  vscode.window.showWarningMessage(
    "No active file or workspace folder found"
  );
  return null;
}

/**
 * Walks UP the directory tree to find a .git folder or file
 */
function findGitRepoRoot(startDir: string): string | null {
  let currentDir = path.resolve(startDir);

  while (true) {
    const gitPath = path.join(currentDir, ".git");

    // .git can be a directory OR a file (submodules)
    if (fs.existsSync(gitPath)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

/**
 * Runs Python agent (bundled inside extension)
 * Streams JSON stdout into VS Code progress banner
 */
async function runPythonAgentWithStreaming(
  context: vscode.ExtensionContext,
  progress: vscode.Progress<{ message?: string }>,
  repoPath: string
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
      stdio: ["pipe", "pipe", "pipe"]
    });

    let buffer = "";
    let terminated = false;

    const safeEnd = (err?: string) => {
      if (terminated) return;
      terminated = true;

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

          // ❌ ERROR FROM PYTHON
          if (event.type === "error") {
            safeEnd(event.message);
            return;
          }

          // 🔹 STATUS UPDATE
          if (event.type === "status") {
            progress.report({ message: event.message });
          }

          // 🔹 INPUT REQUEST
          if (event.type === "input_request") {
            await handleInputRequest(proc, event);
          }

        } catch {
          console.log("[git-copilot][stdout]", line);
        }
      }
    });

    proc.stderr.on("data", (data) => {
      console.error("[git-copilot][stderr]", data.toString());
    });

    proc.on("error", (err) => {
      safeEnd(err.message);
    });

    proc.on("close", (code) => {
      if (!terminated) {
        code === 0
          ? safeEnd()
          : safeEnd("Python process exited unexpectedly");
      }
    });
  });
}


async function handleInputRequest(
  proc: any,
  event: any
): Promise<void> {

  const qp = vscode.window.createQuickPick<vscode.QuickPickItem>();
  qp.canSelectMany = true;
  qp.title = event.prompt;
  qp.placeholder = "Choose files to stage";

  const fileItems: vscode.QuickPickItem[] = event.options.map(
    (opt: string) => ({
      label: path.basename(opt),
      description: opt
    })
  );

  const selectAllItem: vscode.QuickPickItem = {
    label: "🔹 Select all files",
    alwaysShow: true
  };

  const cancelItem: vscode.QuickPickItem = {
    label: "❌ Cancel",
    alwaysShow: true
  };

  qp.items = [selectAllItem, cancelItem, ...fileItems];

  return new Promise((resolve) => {
    qp.onDidAccept(() => {
      let value: string[] = [];

      const selected = qp.selectedItems;

      if (selected.some(i => i.label.startsWith("❌"))) {
        value = [];
      } else if (selected.some(i => i.label.startsWith("🔹"))) {
        value = fileItems.map(i => i.description!);
      } else {
        value = selected
          .map(i => i.description)
          .filter(Boolean) as string[];
      }

      proc.stdin.write(
        JSON.stringify({
          key: event.key,
          value
        }) + "\n"
      );

      qp.hide();
      resolve();
    });

    qp.onDidHide(() => {
      resolve();
      qp.dispose();
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
