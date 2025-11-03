from fastapi import APIRouter
from ..models.schemas import RenderRequest, RenderResponse
from ..services.manim_runner import ManimRunner

router = APIRouter(tags=["render"])
runner = ManimRunner()

@router.post("/render", response_model=RenderResponse)
async def render(req: RenderRequest):
    success, path, log = await runner.render(
        session_id=req.session_id,
        code=req.code,
        scene_class=req.scene_class,
        video_settings=req.settings,
        preview=req.preview,
    )
    if not success:
        return RenderResponse(success=False, log=log)
    return RenderResponse(success=True, video_url=path, log=log)
