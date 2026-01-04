## automanim

chat to make manim vids. preview. save. that’s it.

demo: assets/demo.mp4

<video src="./assets/demo.mp4" controls width="1920"></video>

## why?
writing manim code is hard. llms are good at it. i wanted a tool where i can just say "make a red circle" and it happens. and then "move it right". preserving context is key.

## prereqs
- python 3.9 (manim hates 3.10+ sometimes)
- node.js & npm
- ollama (running locally or remote)
- system deps for manim (ffmpeg, pango, libcairo2)

## installation

1. clone repo.
```bash
git clone https://github.com/niyarrbarman/automanim
cd automanim
```

2. setup.
run the helper script. it handles venv (pip, conda, or uv) and installs npm dependencies.
```bash
chmod +x setup.sh run.sh
./setup.sh
```

## running

start everything. launches backend (8000) and frontend (3000).
```bash
./run.sh
```
then open `http://localhost:3000`.

## features

### chat & iterate
- **context aware**: knows what you built last. "make it blue" works.
- **smart handling**: sanitizes code. uses correct latex syntax (MathTex vs Tex).

### scene history
- **tree structure**: don't like the new change? go back to parent node and try again.
- **branching**: explore different variations from the same point.
- **actions**: edit prompts. delete mistakes. retry generations.

### workspace
- **multi-tab**: work on 'calculus.py' and 'algebra.py' at the same time.
- **auto-save**: localstorage keeps your work safe.
- **code editor**: syntax highlighting. auto-wrap. copy/download code.

### models
- **pluggable**: built for ollama.
- **auto-pull**: select a model in dropdown. if missing, it pulls automatically.
- **defaults**: supported models include:
  - `gpt-oss:120b-cloud` (default)
  - `gemini-3-flash-preview:cloud`
  - `qwen3-coder:480b-cloud`
  - `qwen3-next:80b-cloud`
  - `gemma3:27b-cloud`
  - `glm-4.7:cloud`
  - `ministral-3:14b-cloud`

## configuration

frontend uses `.env.local` (created by setup.sh).
backend uses standard env vars.

backend options:
- `LLM_PROVIDER`: ollama (default)
- `OLLAMA_HOST`: default `http://localhost:11434`
- `OLLAMA_MODEL`: default `gpt-oss:120b-cloud` (change via ui or env)

## troubleshooting
- **manim crash?** usually missing system libs. install `libcairo2-dev libpango1.0-dev ffmpeg`.
- **video not playing?** browser cache. we use timestamps to bust it, but try hard refresh (ctrl+shift+r).
- **model timeout?** first run might be slow if pulling massive models. check terminal output.

## license
mit. do whatever.

## todo / known bugs
- **preview sync**: sometimes video preview doesn't update immediately when switching between projects. (hard refresh fixes it).
- **local models**: currently UI only lists cloud models. need to fetch local `ollama list`.