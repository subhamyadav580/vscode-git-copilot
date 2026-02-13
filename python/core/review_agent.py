from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from langchain_community.chat_models import ChatLiteLLM
from pydantic import BaseModel, Field
from core.agent_schemas import GithubCopilotAgent
import os


class CommitMessage(BaseModel):
    commit_message: str = Field(
        description="A concise, imperative git commit message"
    )


parser = PydanticOutputParser(pydantic_object=CommitMessage)


class CommitMessageGenerator:

    def __init__(self):
        config = self.detect_provider_from_env()

        self.provider = config["provider"]
        self.model = config["model"]
        self.api_key = config["api_key"]

        print(f"Using provider: {self.provider}, model: {self.model}")

        self.llm = ChatLiteLLM(
            model=f"{self.provider}/{self.model}",
            api_key=self.api_key,
            temperature=0.2,
        )

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


    def generate(self, state: GithubCopilotAgent) -> dict:
        response = self.chain.invoke(
            {
                "staged_files_diff": state["staged_files_diff"],
                "format_instructions": parser.get_format_instructions(),
            }
        )

        print("Generated commit message:", response.commit_message)
        return {"commit_message": response.commit_message}


    def detect_provider_from_env(self):
        provider_env_map = {
            "openai": {
                "env": "OPENAI_API_KEY",
                "mini_model": "gpt-4o-mini",
            },
            "anthropic": {
                "env": "ANTHROPIC_API_KEY",
                "mini_model": "claude-3-haiku-20240307",
            },
            "groq": {
                "env": "GROQ_API_KEY",
                "mini_model": "llama3-8b-8192",
            },
            "gemini": {
                "env": "GEMINI_API_KEY",
                "mini_model": "gemini-1.5-flash",
            },
            "mistral": {
                "env": "MISTRAL_API_KEY",
                "mini_model": "mistral-small-latest",
            },
        }

        for provider, config in provider_env_map.items():
            api_key = os.getenv(config["env"])
            if api_key:
                return {
                    "provider": provider,
                    "api_key": api_key,
                    "model": config["mini_model"],
                }

        raise EnvironmentError("No supported LLM API keys found in environment")
