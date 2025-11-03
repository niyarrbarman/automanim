FROM python:3.11-slim

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps for manim
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libcairo2 \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-extra \
    texlive-science \
    texlive-fonts-recommended \
    texlive-luatex \
    pkg-config \
    libcairo2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
