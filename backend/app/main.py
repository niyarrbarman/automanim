from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .core.config import settings
from .routers import chat, render, settings as settings_router, media, models

app = FastAPI(title="AutoManim API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount media for serving rendered videos
app.mount("/media", StaticFiles(directory=settings.MEDIA_ROOT), name="media")

app.include_router(chat.router, prefix="/api")
app.include_router(render.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(models.router, prefix="/api")

# Initialize LLM service
from .services.llm import llm_service


@app.get("/health")
async def health():
    return {"status": "ok"}
