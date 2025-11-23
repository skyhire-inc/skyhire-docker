# Python analyzer service
FROM python:3.11-slim-bookworm

# System dependencies for OCR, OpenCV, PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libice6 \
    libjpeg62-turbo \
    zlib1g \
    libfreetype6 \
    libopenblas0 \
    ca-certificates \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy project requirements and code
COPY requirements.txt ./
COPY main.py ./
COPY src/ ./src/
COPY models/ ./models/

# Upgrade pip and install torch CPU first to satisfy easyocr
RUN python -m pip install --no-cache-dir --upgrade pip && \
    python -m pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu torch torchvision torchaudio && \
    python -m pip install --no-cache-dir -r requirements.txt && \
    python -m pip install --no-cache-dir fastapi uvicorn

# Create IO folders
RUN mkdir -p /app/input /app/output /app/logs

# Copy analyzer API server
COPY python-service/server.py ./server.py

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
