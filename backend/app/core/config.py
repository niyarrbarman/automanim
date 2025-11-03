from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    MEDIA_ROOT: str = str(BASE_DIR / "media")
    WORK_ROOT: str = str(BASE_DIR / "workdir")

    # LLM settings
    LLM_PROVIDER: str = Field("ollama", description="ollama|transformers|llama_cpp|http")
    # Ollama
    OLLAMA_HOST: str = Field("http://localhost:11434", description="Ollama server host")
    OLLAMA_MODEL: str = Field("gemma3:latest", description="Ollama model name")
    LLM_MODEL_ID: str = Field(
        "prithivMLmods/Pyxidis-Manim-CodeGen-1.7B",
        description="Hugging Face model id for transformers",
    )
    LLM_MODEL_PATH: Optional[str] = None  # Path to GGUF model for llama.cpp (optional)
    HF_TOKEN: Optional[str] = None  # Hugging Face token for private/model downloads
    LLM_HTTP_ENDPOINT: Optional[str] = None  # Optional HTTP endpoint for generation
    LLM_MAX_TOKENS: int = 2048
    LLM_TEMPERATURE: float = 0.2

    # CORS
    CORS_ALLOW_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # pydantic-settings v2 style configuration
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

# Ensure directories exist
Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
Path(settings.WORK_ROOT).mkdir(parents=True, exist_ok=True)
