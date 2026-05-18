FROM python:3.12-slim AS backend

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy API requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy API source
COPY app/ ./app/

# Copy CLI source (shared modules)
COPY ../thunder-subtitle-py/src/ ./thunder_subtitle_py_src/

# Set Python path to find CLI modules
ENV PYTHONPATH="/app/thunder_subtitle_py_src:$PYTHONPATH"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]