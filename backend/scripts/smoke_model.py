import os
import sys
from pathlib import Path

# Allow running from repo root or scripts folder
ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT / 'backend'))

from app.services.llm import LLMService  # noqa: E402
from app.utils.code_utils import sanitize_code, extract_scene_class  # noqa: E402
from app.core.config import settings  # noqa: E402


def main():
    print("[smoke] Provider:", settings.LLM_PROVIDER)
    print("[smoke] Model ID (config):", settings.LLM_MODEL_ID)
    print("[smoke] HF_TOKEN set:", bool(settings.HF_TOKEN or os.environ.get('HF_TOKEN')))
    if settings.LLM_PROVIDER == 'ollama':
        print("[smoke] OLLAMA_HOST:", settings.OLLAMA_HOST)
        print("[smoke] OLLAMA_MODEL:", settings.OLLAMA_MODEL)

    svc = LLMService()
    prompt = (
        "Create a Manim scene: draw a circle of radius 5, then animate it expanding to radius 8.\n"
        "Follow the rules: output ONLY Python code, include 'from manim import *', define class GeneratedScene(Scene) with construct."
    )
    system = (
        "You are a Manim code generator.\n"
        "- If the request is not about Manim, return -1 only.\n"
        "- Otherwise output ONLY Python code (no backticks/text).\n"
        "- Must include: from manim import *\n"
        "- Must define: class GeneratedScene(Scene):\n    def construct(self): ...\n"
    )

    print("[smoke] LLMService loaded model id:", getattr(svc, "_model_id", None))
    if settings.LLM_PROVIDER == 'transformers':
        print("[smoke] Pipe ready:", bool(getattr(svc, "_pipe", None)))
    elif settings.LLM_PROVIDER == 'ollama':
        print("[smoke] Using Ollama model:", getattr(svc, "_ollama_model", None))
    print("[smoke] Generating...")
    import asyncio

    async def run():
        raw = await svc.generate_code(system, prompt)
        print("[smoke] Raw output length:", 0 if raw is None else len(raw))
        print("[smoke] Raw head:\n", (raw or "")[:500])
        code = sanitize_code(raw or "")
        print("[smoke] Sanitized length:", len(code))
        print("[smoke] Sanitized head:\n", code[:500])
        scene = extract_scene_class(code)
        print("[smoke] Detected scene:", scene)
        if code.strip() == "-1":
            print("[smoke] Model returned -1 (non-Manim input)")
        elif scene is None:
            print("[smoke] No Scene subclass detected — check prompt/system instructions.")
        else:
            print("[smoke] SUCCESS: Scene detected.")

    asyncio.run(run())


if __name__ == "__main__":
    main()
