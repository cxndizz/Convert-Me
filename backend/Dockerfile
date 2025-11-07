FROM python:3.11-slim

WORKDIR /app

# คัดลอกเฉพาะ requirements.txt ก่อนเพื่อใช้ Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# คัดลอกไฟล์โปรเจคที่เหลือ
COPY . .

# สร้างโฟลเดอร์ temp ถ้ายังไม่มี
RUN mkdir -p /data/tmp

# เปิดพอร์ต 7002
EXPOSE 7002

# รัน uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7002", "--reload"]