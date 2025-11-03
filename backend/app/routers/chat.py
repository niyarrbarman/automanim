from fastapi import APIRouter, HTTPException
from ..models.schemas import GenerateRequest, GenerateResponse
from ..services.llm import LLMService
from ..core.session_store import SessionStore
from ..utils.code_utils import sanitize_code, extract_scene_class

router = APIRouter(tags=["chat"])
llm_service = LLMService()
store = SessionStore.get()

SYSTEM_PROMPT = (
    "You are a Manim code generator.\n"
    "Rules:\n"
    "- If the user request is NOT about Manim, reply with -1 and nothing else.\n"
    "- Otherwise, OUTPUT ONLY Python code (no backticks, no comments, no text).\n"
    "- The code must include: from manim import *\n"
    "- Define exactly one Scene class named GeneratedScene(Scene) with a construct(self) method.\n"
    "- The code must be self-contained and runnable via manim CLI.\n"
    "- Use only animations available in Manim v0.19.x (e.g., Create, Transform, ReplacementTransform, FadeIn, FadeOut, Write, Indicate, GrowFromCenter).\n"
    "- Do NOT use non-existent or experimental APIs (e.g., TransformFromMask).\n"
    "- Conversation is cumulative: each new user message refines or extends the same one GeneratedScene.\n"
    "  Incorporate ALL prior user instructions unless the latest explicitly replaces them.\n"
    "  For requests like 'expand it' or 'transform it', first create the earlier object(s) from history, then apply the new animation.\n"
    "  Always output the full, final scene code that includes previous steps and the new change.\n"
)

@router.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    if not req.prompt or not isinstance(req.prompt, str):
        return GenerateResponse(code=-1)

    # Add current user message to session, then build full history
    store.append_message(req.session_id, "user", req.prompt)
    history = store.get_messages(req.session_id)

    raw_output = await llm_service.generate_code(
        system_prompt=SYSTEM_PROMPT,
        user_prompt=req.prompt,
        messages=history,
    )

    if raw_output is None:
        return GenerateResponse(code=-1)

    code = sanitize_code(raw_output)
    if code.strip() == "-1":
        # Record assistant response too for completeness
        store.append_message(req.session_id, "assistant", "-1")
        return GenerateResponse(code=-1)

    scene_class = extract_scene_class(code)
    if not scene_class:
        # Not a valid manim scene -> treat as -1
        store.append_message(req.session_id, "assistant", "-1")
        return GenerateResponse(code=-1)

    # Persist both user and assistant turns
    store.append_message(req.session_id, "assistant", code)
    return GenerateResponse(code=code, scene_class=scene_class)


@router.post("/reset/{session_id}")
async def reset_session(session_id: str):
    store.clear_session(session_id)
    return {"ok": True}
