import os
import stat
import subprocess
from core.agent_schemas import GithubCopilotAgent
import json
import sys

class GitCopilotUtils:
    def __init__(self):
        """
        Initializes a GitCopilotUtils object.

        This object contains methods for performing common git operations
        safely.
        """
        self.EXCLUDE_DIRS = {
            ".cache",
            "node_modules",
            ".npm",
            ".venv",
            "Library",
            "Applications",
        }




    def request_user_input(self, key: str, prompt: str, options=None):
        print(json.dumps({
            "type": "input_request",
            "key": key,
            "prompt": prompt,
            "options": options or []
        }), flush=True)

        response = sys.stdin.readline()
        data = json.loads(response)

        return data.get("value", [])



    def find_git_repos(self, state: GithubCopilotAgent) -> dict:
        repos = []
        home = os.path.expanduser("~")
        print("Searching for git repositories...")
        for dirpath, dirnames, _ in os.walk(home, topdown=True, followlinks=False):
            if ".git" in dirnames:
                repos.append(dirpath)
                dirnames.clear() 
                continue

            dirnames[:] = [
                d for d in dirnames
                if d not in self.EXCLUDE_DIRS
            ]
        return {"repos_list": repos}


    def get_current_git_branch(self, state: GithubCopilotAgent) -> GithubCopilotAgent:
        """
        Gets the current git branch.

        Returns:
            GithubCopilotAgent: AgentState with the current branch name.
        """
        branch = subprocess.check_output(
            ["git", "branch", "--show-current"],
            stderr=subprocess.DEVNULL
            )
        return {"branch_name": branch.decode().strip()}


    def git_unstaged_files(self, state: GithubCopilotAgent) -> dict:
        """
        Lists all unstaged files with absolute paths.
        """
        print("Listing unstaged files...")

        # 1️⃣ Get repo root
        repo_root = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True
        ).stdout.strip()

        # 2️⃣ Get unstaged files (relative paths)
        result = subprocess.run(
            ["git", "diff", "--name-only"],
            capture_output=True,
            text=True,
            check=True
        )

        # 3️⃣ Convert to absolute paths
        unstaged_files = [
            os.path.join(repo_root, path)
            for path in result.stdout.splitlines()
            if path.strip()
        ]
        print("Unstaged files found:", unstaged_files)
        return {"unstaged_files": unstaged_files}

    def stage_files_safe(self, state: GithubCopilotAgent):
        files = state.get("unstaged_files", [])

        if not files:
            return {"staged_files": []}

        # Only keep files that still exist
        valid_files = [f for f in files if os.path.exists(f)]
        if not valid_files:
            return {"staged_files": []}

        # 🔹 Ask VS Code to show file picker (checkbox UI)
        selected = self.request_user_input(
            key="stage_files",
            prompt="Select files to stage",
            options=valid_files   # 👈 THIS enables QuickPick
        )

        # User cancelled or selected nothing
        if not selected:
            return {"staged_files": []}

        # Stage selected files
        subprocess.run(["git", "add"] + selected, check=True)

        return {"staged_files": selected}


    def get_staged_diff(self, state: GithubCopilotAgent) -> GithubCopilotAgent:
        """
        Gets the diff of the staged files.

        Returns:
            GithubCopilotAgent: AgentState with the diff of the staged files.
        """
        result = subprocess.run(
            ["git", "diff", "--cached"],
            capture_output=True,
            text=True
        )
        return {"staged_files_diff": result.stdout.strip()}


    def commit_files(self, state: GithubCopilotAgent) -> GithubCopilotAgent:

        """
        Commits all the staged files with a given message.

        Args:
            state (GithubCopilotAgent): AgentState with the commit message.

        Returns:
            GithubCopilotAgent: AgentState with no additional information.

        """
        commit_result = subprocess.run(["git", "commit", "-m", state['commit_message']], check=True)
        print("Files committed with message:", commit_result)
        return {}

    def push_branch(self, state: GithubCopilotAgent) -> GithubCopilotAgent:

        """
        Pushes the current branch to the remote repository.

        Args:
            state (GithubCopilotAgent): AgentState with the branch name.

        Returns:
            GithubCopilotAgent: AgentState with no additional information.
        """
        resultl =  subprocess.run(["git", "push", "origin", state["branch_name"]], check=True)
        print("Branch pushed:", resultl)
        return {}
    
    def select_and_navigate_repo(self, state: GithubCopilotAgent) -> dict:
        """
        Selects a git repository from the list and navigates to it
        after user confirmation.
        """
        repos = state.get("repos_list", [])

        if not repos:
            print("No git repositories found.")
            return {"repo_path": ""}

        print("\nChoose a repository to navigate to:")
        for i, repo_path in enumerate(repos):
            print(f"{i + 1}. {repo_path}")
        print(f"{len(repos) + 1}. Exit")

        try:
            choice = int(input("\nEnter the number of the repository: ")) - 1

            if choice == len(repos):
                print("Exiting without selecting a repository.")
                return {"repo_path": ""}

            if not (0 <= choice < len(repos)):
                print("Invalid choice.")
                return {"repo_path": ""}

            selected_repo = repos[choice]

            # 🔐 Confirmation step
            confirm = input(
                f"Confirm navigation to:\n{selected_repo}\n(y/n): "
            ).strip().lower()

            if confirm not in {"y", "yes"}:
                print("Navigation cancelled.")
                return {"repo_path": ""}

            os.chdir(selected_repo)
            print(f"Navigated to repository: {selected_repo}")

            return {"repo_path": selected_repo}

        except ValueError:
            print("Invalid input. Please enter a number.")
            return {}


    def check_files_to_commit(self, state: GithubCopilotAgent) -> GithubCopilotAgent:
        """
        Checks if there are any staged files to commit.

        Args:
            state (GithubCopilotAgent): AgentState with the staged files diff.

        Returns:
            GithubCopilotAgent: AgentState with a boolean indicating if there are staged files.
        """
        if len(state["staged_files_diff"]) > 0:
            return {"has_staged_files": True}
        else:
            print("No files to commit.")
            return {"has_staged_files": False}