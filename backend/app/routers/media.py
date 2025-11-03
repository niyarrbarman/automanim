from fastapi import APIRouter
from pathlib import Path
from ..core.config import settings
from ..models.schemas import MediaListResponse, MediaItem

router = APIRouter(tags=["media"])

@router.get("/media/list", response_model=MediaListResponse)
async def list_media():
    media_dir = Path(settings.MEDIA_ROOT)
    items = []
    for file in sorted(media_dir.glob("**/*.mp4")):
        rel = file.relative_to(settings.MEDIA_ROOT)
        items.append(MediaItem(name=str(rel), url=f"/media/{rel}"))
    return MediaListResponse(items=items)
