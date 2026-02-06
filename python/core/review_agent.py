from langchain import hub
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from core.agent_schemas import GithubCopilotAgent
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field




class CommitMessage(BaseModel):
    commit_message: str = Field(
        description="A concise, imperative git commit message"
    )


parser = PydanticOutputParser(pydantic_object=CommitMessage)


class CommitMessageGenerator:
    def __init__(self, model: str = "gpt-4o-mini"):
        self.llm = ChatOpenAI(model=model)

        self.prompt = ChatPromptTemplate.from_template("""
        You are an experienced code reviewer.
        Your task is to review the provided file diff and give a concise commit message.

        Rules:
        - Use imperative mood
        - Max 72 characters
        - No explanations

        {format_instructions}

        Diff:
        {staged_files_diff}
        """)

        self.chain = self.prompt | self.llm | parser

    def generate(self, state: GithubCopilotAgent) -> str:
        response = self.chain.invoke(
                {
                    "staged_files_diff": state["staged_files_diff"],
                    "format_instructions": parser.get_format_instructions(),
                }
            )
        print("Generated commit message:", response.commit_message)
        return {"commit_message": response.commit_message}
