from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import subprocess
import asyncio
from ..core.config import settings

router = APIRouter(tags=["models"])

# Available models
AVAILABLE_MODELS = [
    "gpt-oss:120b-cloud",
    "gemini-3-flash-preview:cloud",
    "qwen3-coder:480b-cloud",
    "qwen3-next:80b-cloud",
    "gemma3:27b-cloud",
    "glm-4.7:cloud",
    "ministral-3:14b-cloud",
]

class ModelChangeRequest(BaseModel):
    model: str

class ModelResponse(BaseModel):
    current_model: str
    available_models: List[str]

@router.get("/models", response_model=ModelResponse)
async def get_models():
    """Get current model and available models"""
    return ModelResponse(
        current_model=settings.OLLAMA_MODEL,
        available_models=AVAILABLE_MODELS
    )

@router.post("/models/select")
async def select_model(request: ModelChangeRequest):
    """Select and pull model if needed"""
    if request.model not in AVAILABLE_MODELS:
        raise HTTPException(status_code=400, detail="Invalid model")
    
    # Check if model exists
    try:
        result = subprocess.run(
            ["ollama", "list"],
            capture_output=True,
            text=True,
            timeout=10
        )
        model_exists = request.model in result.stdout
    except Exception:
        model_exists = False
    
    # Pull model if it doesn't exist
    if not model_exists:
        try:
            # Run pull in background
            process = await asyncio.create_subprocess_exec(
                "ollama", "pull", request.model,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Wait for pull to complete
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to pull model: {stderr.decode()}"
                )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Error pulling model: {str(e)}"
            )
    
    # Update settings
    settings.OLLAMA_MODEL = request.model
    
    # Reinitialize LLM service with new model
    from ..services.llm import llm_service
    llm_service._ollama_model = request.model
    llm_service._model_id = request.model
    
    return {
        "status": "success",
        "model": request.model,
        "pulled": not model_exists
    }
