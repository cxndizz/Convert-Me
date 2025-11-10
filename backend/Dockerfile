FROM python:3.11-slim

WORKDIR /app

# Copy requirements.txt first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Create temp directory
RUN mkdir -p /data/tmp

# Expose port 7002
EXPOSE 7002

# Run uvicorn with the correct path to main.py
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7002"]