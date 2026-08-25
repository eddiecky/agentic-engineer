import abc
import re
from typing import List, Tuple

import httpx

from config import resolve_config


class LLMProvider(abc.ABC):
    @abc.abstractmethod
    async def generate(self, prompt: str) -> str:
        ...


class OpenRouterProvider(LLMProvider):
    def __init__(self, api_key: str = None, model: str = "anthropic/claude-3.5-sonnet"):
        self.api_key = api_key or resolve_config("OPENROUTER_API_KEY")
        self.model = model
        self.base_url = "https://openrouter.ai/api/v1"

    async def generate(self, prompt: str) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://agentic-engineer.local",
            "X-Title": "Agentic Engineer",
        }
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


class CopilotProvider(LLMProvider):
    async def generate(self, prompt: str) -> str:
        import subprocess

        result = subprocess.run(
            ["gh", "copilot", "suggest", "-t", "shell", "--", prompt],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Copilot CLI failed: {result.stderr}")
        return result.stdout


class LLMService:
    def __init__(self, provider: str = None):
        provider = provider or resolve_config("DEFAULT_LLM_PROVIDER")
        if provider == "openrouter":
            self.provider: LLMProvider = OpenRouterProvider(model=resolve_config("OPENROUTER_MODEL"))
        elif provider == "copilot":
            self.provider: LLMProvider = CopilotProvider()
        else:
            raise ValueError(f"Unknown LLM provider: {provider}")

    async def generate_code_changes(self, ticket: dict, file_contents: List[Tuple[str, str]]) -> str:
        files_str = "\n\n".join(
            [
                f"### {name}\n```{self._guess_lang(name)}\n{content}\n```"
                for name, content in file_contents
            ]
        )
        prompt = f"""You are a senior software engineer. Implement the changes described in the JIRA ticket below.

Ticket: {ticket['key']}
Summary: {ticket['summary']}
Description: {ticket.get('description', '')}

Current files:
{files_str}

Return ONLY the complete modified files in this exact format for each file:
### filename.ext
```ext
<complete new file content>
```

Do not include unchanged files in your response.
"""
        return await self.provider.generate(prompt)

    @staticmethod
    def parse_changes(raw: str) -> List[Tuple[str, str]]:
        """Parse LLM output into list of (filename, content)."""
        pattern = r"###\s*(?P<filename>[^\n]+)\n+```(?:[^\n]*)?\n?(?P<content>.*?)```"
        matches = re.finditer(pattern, raw, re.DOTALL)
        return [(m.group("filename").strip(), m.group("content").strip()) for m in matches]

    @staticmethod
    def _guess_lang(filename: str) -> str:
        ext = filename.split(".")[-1] if "." in filename else ""
        mapping = {
            "py": "python",
            "js": "javascript",
            "ts": "typescript",
            "html": "html",
            "css": "css",
            "md": "markdown",
            "json": "json",
            "yml": "yaml",
            "yaml": "yaml",
            "toml": "toml",
        }
        return mapping.get(ext, "")
