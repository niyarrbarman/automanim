import re
from typing import Optional

CODE_BLOCK_RE = re.compile(r"```(?:python)?\n(.*?)```", re.DOTALL)
SCENE_CLASS_RE = re.compile(r"class\s+(\w+)\s*\(\s*Scene\s*\)")


def sanitize_code(output: str) -> str:
    if output is None:
        return "-1"
    text = output.strip()
    if text == "-1":
        return "-1"
    m = CODE_BLOCK_RE.search(text)
    if m:
        text = m.group(1)
    # Remove any leading shebang or prompt lines
    lines = [ln for ln in text.splitlines() if not ln.strip().startswith(("# %%", ">>>"))]
    text = "\n".join(lines).strip()
    return normalize_manim_apis(text)


def extract_scene_class(code: str) -> Optional[str]:
    m = SCENE_CLASS_RE.search(code)
    return m.group(1) if m else None


def normalize_manim_apis(code: str) -> str:
    """Fix or replace a few commonly hallucinated Manim APIs for v0.19.x.

    - TransformFromMask(a,b) -> Transform(a,b)
    Add more mappings here as needed.
    """
    replacements = {
        "TransformFromMask(": "Transform(",
    }
    out = code
    for bad, good in replacements.items():
        out = out.replace(bad, good)
    return out
