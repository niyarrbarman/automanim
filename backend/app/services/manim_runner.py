import asyncio
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Tuple
import sys

from ..core.config import settings
from ..models.schemas import VideoSettings
from ..utils.code_utils import extract_scene_class

DEFAULT_REQS = """
from manim import *

"""

class ManimRunner:
    def __init__(self) -> None:
        self.media_root = Path(settings.MEDIA_ROOT)
        self.work_root = Path(settings.WORK_ROOT)
        self.media_root.mkdir(parents=True, exist_ok=True)
        self.work_root.mkdir(parents=True, exist_ok=True)

    async def render(
        self,
        session_id: str,
        code: str,
        scene_class: Optional[str] = None,
        video_settings: Optional[VideoSettings] = None,
        preview: bool = True,
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        work_dir = self.work_root / session_id
        work_dir.mkdir(parents=True, exist_ok=True)
        script_path = work_dir / "scene.py"

        # Ensure imports present
        if "from manim import" not in code:
            code = DEFAULT_REQS + code

        script_path.write_text(code)

        if not scene_class:
            scene_class = extract_scene_class(code) or "GeneratedScene"

        # Determine output paths
        out_name = "preview.mp4" if preview else "output.mp4"
        out_dir = self.media_root / session_id
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / out_name

        # Map quality
        quality_map = {
            "low": "l",
            "medium": "m",
            "high": "h",
            "ultra": "k",
        }
        q = quality_map.get((video_settings.quality if video_settings else "low").lower(), "l")
        width = video_settings.resolution_width if video_settings else 854
        height = video_settings.resolution_height if video_settings else 480
        fps = video_settings.fps if video_settings else 30


        # Prefer system 'manim' binary; fallback to 'python -m manim' if not on PATH
        manim_bin = shutil.which("manim")
        base_cmd = ["manim"] if manim_bin else [sys.executable, "-m", "manim"]

        cmd = base_cmd + [
            "-q", q,
            "--fps", str(fps),
            "--format", "mp4",
            "--custom_folders",
            "--media_dir", str(out_dir),
            "--disable_caching",
            str(script_path),
            scene_class,
            "-o", out_path.name,
        ]

        # Manim CLI uses resolutions by quality presets; to enforce WxH we can set pixel_height/width via cfg file
        cfg_path = work_dir / "manim.cfg"
        cfg = f"""
[CLI]
pixel_height = {height}
pixel_width = {width}
frame_rate = {fps}
""".strip()
        cfg_path.write_text(cfg)
        env_vars = {"MANIM_CONFIG_FILE": str(cfg_path)}

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=str(work_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env={**os.environ, **env_vars},
            )
            stdout, _ = await proc.communicate()
            log = stdout.decode()
            if proc.returncode != 0:
                return False, None, log
            # Return URL path
            rel = out_path.relative_to(self.media_root)
            return True, f"/media/{rel}", log
        except FileNotFoundError:
            return False, None, "manim not found. Please install manim in the backend environment (or ensure 'python -m manim' works)."
        except Exception as e:
            return False, None, str(e)
