import json
from langgraph.graph import StateGraph, START, END
from core.git_utils import GitCopilotUtils
from core.agent_schemas import GithubCopilotAgent
from core.review_agent import CommitMessageGenerator


gitUtils = GitCopilotUtils()
commitMessageGenerator = CommitMessageGenerator()
graph = StateGraph(GithubCopilotAgent)

# -------------------------------
# Add nodes
# -------------------------------
graph.add_node("get_current_git_branch", gitUtils.get_current_git_branch)
graph.add_node("list_unstaged_files", gitUtils.git_unstaged_files)
graph.add_node("stage_files_safe", gitUtils.stage_files_safe)
graph.add_node("get_staged_diff", gitUtils.get_staged_diff)
graph.add_node("check_files_to_commit", gitUtils.check_files_to_commit)
graph.add_node("generate_commit_message", commitMessageGenerator.generate)
graph.add_node("commit_files", gitUtils.commit_files)
graph.add_node("push_branch", gitUtils.push_branch)

# -------------------------------
# Add edges
# -------------------------------
graph.add_edge(START, "get_current_git_branch")
graph.add_edge("get_current_git_branch", "list_unstaged_files")
graph.add_edge("list_unstaged_files", "stage_files_safe")
graph.add_edge("stage_files_safe", "get_staged_diff")
graph.add_edge("get_staged_diff", "check_files_to_commit")

graph.add_conditional_edges(
    "check_files_to_commit",
    lambda state: (
        "generate_commit_message"
        if state["has_staged_files"]
        else END
    ),
)

graph.add_edge("generate_commit_message", "commit_files")
graph.add_edge("commit_files", "push_branch")
graph.add_edge("push_branch", END)

app = graph.compile()

# -------------------------------
# Node → Banner message mapping
# -------------------------------
NODE_STATUS_MESSAGES = {
    "get_current_git_branch": "📌 Getting current Git branch",
    "list_unstaged_files": "🗂 Listing unstaged files",
    "stage_files_safe": "📥 Staging files",
    "get_staged_diff": "🧾 Generating staged diff",
    "check_files_to_commit": "🔍 Checking files to commit",
    "generate_commit_message": "✍️ Generating commit message",
    "commit_files": "✅ Creating commit",
    "push_branch": "🚀 Pushing branch to remote",
}

# -------------------------------
# Stream execution with VS Code–friendly output
# -------------------------------
def run_agent():
    for event in app.stream({}):
        for node_name in event.keys():
            if node_name in NODE_STATUS_MESSAGES:
                print(json.dumps({
                    "type": "status",
                    "node": node_name,
                    "message": NODE_STATUS_MESSAGES[node_name]
                }), flush=True)

    print(json.dumps({
        "type": "status",
        "message": "✅ Git Copilot workflow completed"
    }), flush=True)


if __name__ == "__main__":
    run_agent()
