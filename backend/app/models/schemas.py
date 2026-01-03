from pydantic import BaseModel, Field
from typing import Optional, List, Union

class VideoSettings(BaseModel):
    resolution_width: int = 854
    resolution_height: int = 480
    fps: int = 30
    quality: str = Field("low", description="low|medium|high|ultra")

class GenerateRequest(BaseModel):
    session_id: str
    prompt: str

class GenerateResponse(BaseModel):
    code: Union[str, int]  # code string or -1
    scene_class: Optional[str] = None

class RenderRequest(BaseModel):
    session_id: str
    code: str
    scene_class: Optional[str] = None
    settings: Optional[VideoSettings] = None
    preview: bool = True

class RenderResponse(BaseModel):
    success: bool
    video_url: Optional[str] = None
    log: Optional[str] = None

class SaveVideoRequest(BaseModel):
    session_id: str
    filename: str
    source_path: str

class MediaItem(BaseModel):
    name: str
    url: str

class MediaListResponse(BaseModel):
    items: List[MediaItem]
