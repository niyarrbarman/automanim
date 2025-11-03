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
        self._tokenizer = None
        self._pipe = None
        self._model_id = None
        self._ollama_model = None

        if self.provider == "transformers":
            self._init_transformers()
        elif self.provider == "ollama":
            self._init_ollama()
        elif self.provider == "llama_cpp":
            self._init_llama_cpp()
        elif self.provider == "http":
            # Expect settings.LLM_HTTP_ENDPOINT to be set
            pass

    def _init_transformers(self) -> None:
        try:
            import transformers
            from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
            from huggingface_hub import login as hf_login

            model_id = os.environ.get("LLM_MODEL_ID") or settings.LLM_MODEL_ID
            if not model_id:
                model_id = "prithivMLmods/Pyxidis-Manim-CodeGen-1.7B"
            self._model_id = model_id

            token = settings.HF_TOKEN or os.environ.get("HF_TOKEN")
            if token:
                try:
                    hf_login(token=token)
                except Exception:
                    pass

            # Try to load the model with CPU fallback
            # We avoid bitsandbytes here for broader portability
            print(f"[LLM] Initializing transformers model: {model_id}")
            self._tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
            self._llm = AutoModelForCausalLM.from_pretrained(
                model_id,
                torch_dtype="auto",
                device_map="auto" if os.environ.get("ACCELERATE_DEVICE_MAP", "") else None,
                trust_remote_code=True,
            )
            self._pipe = pipeline(
                "text-generation",
                model=self._llm,
                tokenizer=self._tokenizer,
                # generation config can be overridden per-call
            )
            print("[LLM] Transformers pipeline created.")
        except Exception as e:
            print("[LLM] transformers init failed:", repr(e))
            self._llm = None
            self._pipe = None

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
        if self.provider == "transformers":
            if self._pipe is None:
                return None
            return await asyncio.to_thread(self._completion_transformers, prompt)
        elif self.provider == "ollama":
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

    def _completion_transformers(self, prompt: str) -> Optional[str]:
        try:
            outputs = self._pipe(
                prompt,
                max_new_tokens=settings.LLM_MAX_TOKENS,
                do_sample=True,
                temperature=max(0.0, min(1.0, settings.LLM_TEMPERATURE)),
                eos_token_id=self._tokenizer.eos_token_id if self._tokenizer else None,
                repetition_penalty=1.05,
            )
            if not outputs:
                return None
            text = outputs[0]["generated_text"][len(prompt):]
            return text
        except Exception:
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
        tok = getattr(self, "_tokenizer", None)
        try:
            if tok and hasattr(tok, "apply_chat_template"):
                rendered = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
                if isinstance(rendered, str) and len(rendered) > 0:
                    return rendered
        except Exception:
            pass
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
        # Prefer chat template if available for better adherence to Llama 3.1 format
        tok = getattr(self, "_tokenizer", None)
        try:
            if tok and hasattr(tok, "apply_chat_template"):
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
                rendered = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
                if isinstance(rendered, str) and len(rendered) > 0:
                    return rendered
        except Exception:
            pass
        # Fallback to simple instruct-style prompt
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
