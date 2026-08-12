FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir \
    --index-url https://mirrors.aliyun.com/pypi/simple/ \
    -r requirements.txt

COPY . .

ENV COMICS_DIR=/app/comics \
    PORT=8999

EXPOSE 8999

# Run directly with uvicorn (no reload in prod).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8999}"]
