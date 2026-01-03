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
    "- Think thoroughly about what the user is asking before replying.\n"
    "- OUTPUT ONLY Python code (no backticks, no comments, no text).\n"
    "- The code must include: from manim import *\n"
    "- Define exactly one Scene class named GeneratedScene(Scene) with a construct(self) method.\n"
    "- The code must be self-contained and runnable via manim CLI.\n"
    "- Use only animations available in Manim v0.19.x.\n"
    "- CRITICAL: Use MathTex(...) for ALL mathematical formulas, equations, variables, and LaTeX symbols (e.g., F_n, \\frac, ^). \n"
    "- CRITICAL: Use Tex(...) ONLY for plain text explanations. NEVER put math mode syntax (like _, ^, \\) inside Tex() without $...$ delimiters.\n"
    "- CRITICAL: When using .animate, you MUST CALL the method. Example: `self.play(obj.animate.shift(UP))` is CORRECT. `self.play(obj.animate.shift, UP)` is WRONG (causes TypeError).\n"
    "- Conversation is cumulative: incorporate ALL prior user instructions unless the latest explicitly replaces them.\n"
    "  Incorporate ALL prior user instructions unless the latest explicitly replaces them.\n"
    "  For requests like 'expand it' or 'transform it', first create the earlier object(s) from history, then apply the new animation.\n"
    "  Always output the full, final scene code that includes previous steps and the new change.\n"
)

@router.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    if not req.prompt or not isinstance(req.prompt, str):
        return GenerateResponse(code=-1)

    # If context_summary is provided (for branching/updates), use it as history
    # Otherwise, fall back to session store (for legacy or fresh starts)
    if req.context_summary:
        # Client manages history via context_summary.
        # We treat context_summary as the conversation history.
        # We append the new prompt to it for the LLM.
        
        # We don't necessarily update the store's linear history here because
        # branching makes linear history invalid. We just log the standardized exchange.
        
        # Construct messages strictly from context_summary + current user prompt
        # We inject a special instruction to treat the summary as the history.
        
        system_instruction = SYSTEM_PROMPT + (
            "\n\nCONTEXT FROM PREVIOUS ITERATIONS:\n"
            f"{req.context_summary}\n\n"
            "INSTRUCTION: The user provided the above context. "
            "Treat it as the history of what has been implemented so far. "
            "Implement the NEW request below by extending/modifying this history."
        )
        
        # We use a fresh message list for this generation to avoid pollution
        # But we must include the current user prompt!
        history = [{"role": "user", "content": req.prompt}]
        
        raw_output = await llm_service.generate_code(
            system_prompt=system_instruction,
            user_prompt=req.prompt,
            messages=history, 
        )
        
    else:
        # Legacy/Linear mode (fresh start or linear chat)
        # Add current user message to session
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
        if not req.context_summary:
            store.append_message(req.session_id, "assistant", "-1")
        return GenerateResponse(code=-1)

    scene_class = extract_scene_class(code)
    if not scene_class:
        if not req.context_summary:
            store.append_message(req.session_id, "assistant", "-1")
        return GenerateResponse(code=-1)

    # Persist only if linear
    if not req.context_summary:
        store.append_message(req.session_id, "assistant", code)
        
    return GenerateResponse(code=code, scene_class=scene_class)


@router.post("/reset/{session_id}")
async def reset_session(session_id: str):
    store.clear_session(session_id)
    return {"ok": True}
