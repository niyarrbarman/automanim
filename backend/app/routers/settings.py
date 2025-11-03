from fastapi import APIRouter
from ..models.schemas import VideoSettings
from ..core.session_store import SessionStore

router = APIRouter(tags=["settings"])
store = SessionStore.get()

@router.post("/settings/{session_id}")
async def set_settings(session_id: str, settings: VideoSettings):
    store.set_settings(session_id, settings.dict())
    return {"ok": True, "settings": settings}

@router.get("/settings/{session_id}")
async def get_settings(session_id: str):
    return store.get_settings(session_id)
