## automanim

chat to make manim vids. preview. save. that’s it.

demo:

<video src="assets/demo.mp4" controls width="1920"></video>

requirements:
- python 3.9 (manim requires below 3.10)

quickstart:
- backend
```bash
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload
```
- frontend
```bash
cd frontend
npm i
export NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
npm run dev
```

backend options (pick one):
- ollama (default)
	- set envs if you need: `LLM_PROVIDER=ollama`, `OLLAMA_MODEL=llama3.1:8b-instruct-q8_0`, `OLLAMA_HOST=http://localhost:11434`
	- run your local ollama and pull the model first
- transformers (hugging face)
	- set: `LLM_PROVIDER=transformers`, `LLM_MODEL_ID=<repo/name>` and optionally `HF_TOKEN`
	- good when you want a specific hf model and have the hardware