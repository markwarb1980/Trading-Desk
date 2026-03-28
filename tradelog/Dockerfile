FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Create data directory for SQLite
RUN mkdir -p /data

# Use /data/tradelog.db so it can be mounted as a persistent volume
ENV DATABASE_URL=sqlite:////data/tradelog.db

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
