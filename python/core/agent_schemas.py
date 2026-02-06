from typing import Any, TypedDict, List



class GithubCopilotAgent(TypedDict):
    repos_list: List[str]
    repo_path: str
    branch_name: str
    unstaged_files: List[str]
    staged_files: List[str]
    staged_files_diff: str
    has_staged_files: bool
    commit_message: str