from __future__ import annotations

import re
from openai import AsyncOpenAI


class OpenAIService:
    def __init__(self, api_key: str, model: str = "gpt-4o-mini", base_url: str | None = None) -> None:
        self.api_key = (api_key or "").strip()
        self.model = model
        self.base_url = (base_url or "").strip() or None

        # Auto-configure Groq provider if a Groq key is supplied
        if self.api_key.startswith("gsk_"):
            if not self.base_url:
                self.base_url = "https://api.groq.com/openai/v1"
            if self.model in {"gpt-4o-mini", "gpt-4o"}:
                self.model = "openai/gpt-oss-120b"

        self.client: AsyncOpenAI | None = None
        if self.has_valid_api_key():
            self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    def has_valid_api_key(self) -> bool:
        """Checks if a real OpenAI API key is configured."""
        if not self.api_key:
            return False
        if self.api_key in {"your_openai_api_key_here", "none", "null"}:
            return False
        if self.api_key.startswith("your_"):
            return False
        return True

    async def generate_chat_completion(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 800,
    ) -> str:
        if not self.has_valid_api_key():
            raise ValueError("OpenAI API key is missing or still set to the placeholder value.")

        if self.client is None:
            self.client = AsyncOpenAI(api_key=self.api_key)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as exc:  # pragma: no cover - surfaced as a clean API error upstream
            raise RuntimeError(f"OpenAI API request failed: {exc}") from exc

        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("OpenAI returned an empty response.")

        return content.strip()

    def generate_fallback_response(
        self,
        messages: list[dict[str, str]],
        rag_context: str = "",
    ) -> str:
        """Generates a structured, document-grounded response when running in local/demo environment mode."""
        user_message = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_message = msg.get("content", "").strip()
                break

        query_lower = user_message.lower()

        # Handle greetings
        if query_lower in {"hi", "hello", "hey", "good morning", "good afternoon", "greetings"}:
            return (
                "Hello! I am your company AI assistant. I am currently running in local environment mode "
                "with direct access to internal documents and company knowledge.\n\n"
                "You can ask me about:\n"
                "- Company mission & overview\n"
                "- Product principles\n"
                "- Support team responsibilities\n"
                "- Onboarding guidance\n\n"
                "*Tip: Add your `OPENAI_API_KEY` to the `.env` file to connect to live OpenAI models.*"
            )

        # If RAG context is available, answer from context
        if rag_context:
            clean_context = rag_context
            if "Relevant context:" in clean_context:
                clean_context = clean_context.split("Relevant context:")[-1].strip()

            sections: list[str] = []

            if "support" in query_lower:
                sections.append(
                    "**Support Team Responsibilities:**\n"
                    "- Handles onboarding questions, process guidance, account support, and internal troubleshooting.\n"
                    "- Operates under the principle of keeping customer support fast, accurate, and trustworthy with human oversight."
                )

            if "principle" in query_lower or "product" in query_lower:
                sections.append(
                    "**Product Principles:**\n"
                    "1. Keep customer support fast and accurate.\n"
                    "2. Use trustworthy AI with human oversight.\n"
                    "3. Protect company information and customer data.\n"
                    "4. Build integrations that are easy to extend."
                )

            if "onboard" in query_lower or "employee" in query_lower:
                sections.append(
                    "**Employee Onboarding Overview:**\n"
                    "- Learn and adopt core product principles and support workflows.\n"
                    "- Maintain data confidentiality in accordance with company security policies.\n"
                    "- Contact the internal support team for account setup and tooling assistance."
                )

            if "mission" in query_lower or "about" in query_lower or "overview" in query_lower:
                sections.append(
                    "**Company Mission:**\n"
                    "Our company helps teams automate internal operations and improve productivity through modern AI and data-driven workflows."
                )

            if sections:
                answer = "\n\n".join(sections)
            else:
                answer = (
                    f"Based on our internal documents:\n\n"
                    f"{clean_context[:600]}\n\n"
                    "Feel free to ask for additional details or specific guidance."
                )

            return f"{answer}\n\n*(Local RAG Mode: Answers sourced directly from local knowledge base. Configure `OPENAI_API_KEY` in `.env` for generative AI.)*"

        # Default fallback response
        return (
            f"I received your inquiry: \"{user_message}\".\n\n"
            "The backend is running in local environment mode, and no relevant company documents matched this specific question. "
            "To connect live generative LLM completions, set your `OPENAI_API_KEY` in `.env`."
        )


def build_default_system_prompt() -> str:
    return (
        "You are a helpful AI assistant for a company application. "
        "Answer clearly, professionally, and concisely. "
        "If the answer is not in the supplied context, be transparent and say so."
    )


