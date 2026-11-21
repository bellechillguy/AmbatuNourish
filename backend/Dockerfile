FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir -r /dev/stdin <<'REQUIREMENTS'
gunicorn==27.0.1
tzdata==2025.2
REQUIREMENTS
RUN groupadd --system nourish && useradd --system --gid nourish nourish && install -d -o nourish -g nourish /data
COPY nourish/ /app/nourish/
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NOURISH_DATA_DIR=/data
USER nourish
EXPOSE 8080
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "--timeout", "20", "--log-config-json", "/app/nourish/logging.json", "nourish.api:create_app()"]
