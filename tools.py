from __future__ import annotations

from typing import Any


class ToolRegistry:
    """Placeholder registry for future integrations such as web search or company APIs."""

    def __init__(self) -> None:
        self.tools = {
            "web_search": self.web_search,
            "company_api_lookup": self.company_api_lookup,
        }

    async def web_search(self, query: str) -> str:
        raise NotImplementedError("Web search integration is not configured yet.")

    async def company_api_lookup(self, endpoint: str, params: dict[str, Any] | None = None) -> str:
        raise NotImplementedError("External API integration is not configured yet.")

    def available_tools(self) -> list[str]:
        return list(self.tools.keys())

