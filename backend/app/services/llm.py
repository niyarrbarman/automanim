import os
import asyncio
from typing import Optional, List, Dict
from ..core.config import settings

PROMPT_TEMPLATE = """
SYSTEM:
{system}

USER:
{user}

ASSISTANT:
""".strip()


class LLMService:
    def __init__(self) -> None:
        self.provider = settings.LLM_PROVIDER
        self._llm = None
        self._model_id = None
        self._ollama_model = None

        if self.provider == "ollama":
            self._init_ollama()
        elif self.provider == "llama_cpp":
            self._init_llama_cpp()
        elif self.provider == "http":
            # Expect settings.LLM_HTTP_ENDPOINT to be set
            pass


    def _init_ollama(self) -> None:
        # Set host for python ollama client and record model
        host = settings.OLLAMA_HOST
        model = settings.OLLAMA_MODEL
        if host:
            os.environ["OLLAMA_HOST"] = host
        self._ollama_model = model
        self._model_id = model

    def _init_llama_cpp(self) -> None:
        try:
            from llama_cpp import Llama
            model_path = settings.LLM_MODEL_PATH or os.environ.get("LLM_MODEL_PATH")
            if model_path and os.path.exists(model_path):
                self._llm = Llama(
                    model_path=model_path,
                    n_gpu_layers=-1,
                    n_ctx=8192,
                    verbose=False,
                )
        except Exception:
            self._llm = None

    async def generate_code(self, system_prompt: str, user_prompt: str, messages: Optional[List[Dict[str, str]]] = None) -> Optional[str]:
        if messages is not None:
            # Prepend system prompt
            chat_messages = [{"role": "system", "content": system_prompt}] + messages
            prompt = self._build_from_messages(chat_messages)
        else:
            prompt = self._build_prompt(system_prompt, user_prompt)
        if self.provider == "ollama":
            if messages is not None:
                return await asyncio.to_thread(self._completion_ollama_messages, chat_messages)
            return await asyncio.to_thread(self._completion_ollama, system_prompt, user_prompt)
        elif self.provider == "llama_cpp":
            if self._llm is None:
                return None
            return await asyncio.to_thread(self._completion_llama_cpp, prompt)
        elif self.provider == "http":
            return await self._completion_http(prompt)
        return None


    def _completion_ollama(self, system_prompt: str, user_prompt: str) -> Optional[str]:
        try:
            import ollama
            model = self._ollama_model or settings.OLLAMA_MODEL
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            resp = ollama.chat(
                model=model,
                messages=messages,
                options={
                    "temperature": float(settings.LLM_TEMPERATURE),
                    "num_predict": int(settings.LLM_MAX_TOKENS),
                },
            )
            return resp.get("message", {}).get("content")
        except Exception as e:
            print("[LLM] ollama chat failed:", repr(e))
            return None

    def _build_from_messages(self, messages: List[Dict[str, str]]) -> str:
        # Fallback to naive concatenation
        parts = []
        for m in messages:
            parts.append(f"{m.get('role','user').upper()}:\n{m.get('content','')}\n")
        parts.append("ASSISTANT:\n")
        return "\n".join(parts)

    def _completion_ollama_messages(self, messages: List[Dict[str, str]]) -> Optional[str]:
        try:
            import ollama
            model = self._ollama_model or settings.OLLAMA_MODEL
            resp = ollama.chat(
                model=model,
                messages=messages,
                options={
                    "temperature": float(settings.LLM_TEMPERATURE),
                    "num_predict": int(settings.LLM_MAX_TOKENS),
                },
            )
            return resp.get("message", {}).get("content")
        except Exception as e:
            print("[LLM] ollama chat failed:", repr(e))
            return None

    def _build_prompt(self, system_prompt: str, user_prompt: str) -> str:
        # Simple instruct-style prompt
        return PROMPT_TEMPLATE.format(system=system_prompt, user=user_prompt)

    def _completion_llama_cpp(self, prompt: str) -> Optional[str]:
        try:
            result = self._llm(
                prompt,
                max_tokens=settings.LLM_MAX_TOKENS,
                temperature=settings.LLM_TEMPERATURE,
                stop=["SYSTEM:", "USER:"],
            )
            text = result["choices"][0]["text"]
            return text
        except Exception:
            return None

    async def _completion_http(self, prompt: str) -> Optional[str]:
        import aiohttp
        if not settings.LLM_HTTP_ENDPOINT:
            return None
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(settings.LLM_HTTP_ENDPOINT, json={"prompt": prompt}) as resp:
                    if resp.status != 200:
                        return None
                    data = await resp.json()
                    # Expect {"text": "..."}
                    return data.get("text")
        except Exception:
            return None

# Create singleton instance
llm_service = LLMService()
