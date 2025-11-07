import os
import uuid
import chardet
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Any
from pathlib import Path
from data_profiler import DataProfiler
import csv

from models import SessionManager, SessionResponse, FileUploadResponse

app = FastAPI(
    title="DataMap API",
    description="Backend API for DataMap ETL Tool",
    version="1.0.0"
)

# ตั้งค่า environment variables
TEMP_PATH = os.getenv("TEMP_PATH", "/data/tmp")
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "200"))
SESSION_TTL_MINUTES = int(os.getenv("SESSION_TTL_MINUTES", "60"))
ALLOWED_EXT = os.getenv("ALLOWED_EXT", ".csv,.xls,.xlsx,.txt,.sql").split(",")

# CORS Middleware
allowed_origins = os.getenv("CORS_ORIGIN", "http://localhost:7001,http://localhost:7000,http://frontend:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# สร้าง session manager
session_manager = SessionManager(temp_path=TEMP_PATH, ttl_minutes=SESSION_TTL_MINUTES)

# Dependency สำหรับตรวจสอบ session
def validate_session(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found or expired")
    return session

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "backend"}

@app.post("/api/v1/sessions", response_model=SessionResponse)
async def create_session():
    """สร้าง session ใหม่"""
    session_id = session_manager.create_session()
    return SessionResponse(
        session_id=session_id,
        ttl_s=SESSION_TTL_MINUTES * 60
    )

@app.post("/api/v1/sessions/{session_id}/files", response_model=FileUploadResponse)
async def upload_file(
    session_id: str,
    file: UploadFile = File(...),
    session: Dict[str, Any] = Depends(validate_session)
):
    """อัปโหลดไฟล์ไปยัง session"""
    # ตรวจสอบนามสกุลไฟล์
    filename = file.filename
    file_extension = os.path.splitext(filename)[1].lower()
    
    if file_extension not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"File type {file_extension} not allowed. Allowed types: {ALLOWED_EXT}")
    
    # สร้าง file_id และตำแหน่งไฟล์
    file_id = str(uuid.uuid4())
    file_path = os.path.join(session["temp_path"], f"{file_id}{file_extension}")
    
    # อ่านและบันทึกไฟล์
    content = await file.read()
    
    # ตรวจสอบขนาดไฟล์
    file_size_mb = len(content) / (1024 * 1024)
    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {file_size_mb:.2f} MB. Maximum allowed size: {MAX_FILE_SIZE_MB} MB"
        )
    
    # ตรวจสอบ encoding
    encoding_result = chardet.detect(content[:min(len(content), 10000)])  # ตรวจสอบเฉพาะส่วนต้นของไฟล์
    encoding = encoding_result["encoding"]
    
    # บันทึกไฟล์
    with open(file_path, "wb") as f:
        f.write(content)
    
    # ตรวจสอบ delimiter และ header ถ้าเป็น CSV
    metadata = {
        "encoding": encoding,
        "detected_delimiter": None,
        "header_detected": None
    }
    
    if file_extension == ".csv" or file_extension == ".txt":
        try:
            # ทดลองอ่านบรรทัดแรก ๆ ของไฟล์เพื่อตรวจสอบ delimiter
            with open(file_path, "r", encoding=encoding, errors="replace") as f:
                sample = f.read(1024)  # อ่านตัวอย่างเล็กน้อย
                
                # ตรวจสอบ delimiter ด้วยการนับจำนวนเครื่องหมายแต่ละประเภท
                delimiters = [",", ";", "\t", "|"]
                counts = {d: sample.count(d) for d in delimiters}
                if max(counts.values()) > 0:
                    metadata["detected_delimiter"] = max(counts, key=counts.get)
                
                # ตรวจสอบ header
                if metadata["detected_delimiter"]:
                    f.seek(0)  # กลับไปที่ต้นไฟล์
                    first_line = f.readline().strip()
                    # ถ้ามี delimiter มากกว่า 1 และไม่มีตัวเลขในบรรทัดแรก อาจเป็น header
                    header_detected = (
                        first_line.count(metadata["detected_delimiter"]) > 0 and 
                        not any(c.isdigit() for c in first_line)
                    )
                    metadata["header_detected"] = header_detected
        except Exception as e:
            # ถ้าเกิดข้อผิดพลาดในการตรวจสอบ ให้เก็บค่าเดิม
            print(f"Error detecting CSV properties: {e}")
    
    # เพิ่มข้อมูลไฟล์ใน session
    session_manager.add_file_to_session(
        session_id=session_id,
        file_id=file_id,
        filename=filename,
        file_path=file_path,
        file_size=len(content),
        metadata=metadata
    )
    
    # คืนค่าข้อมูลไฟล์
    return FileUploadResponse(
        session_id=session_id,
        file_id=file_id,
        original_filename=filename,
        size_bytes=len(content),
        detected_delimiter=metadata["detected_delimiter"],
        encoding=metadata["encoding"],
        header_detected=metadata["header_detected"]
    )

@app.delete("/api/v1/sessions/{session_id}")
async def delete_session(
    session_id: str,
    session: Dict[str, Any] = Depends(validate_session)
):
    """ลบ session และไฟล์ที่เกี่ยวข้อง"""
    success = session_manager.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete session")
    return {"status": "success", "message": f"Session {session_id} deleted"}

@app.get("/api/v1/sessions/{session_id}")
async def get_session_info(
    session_id: str,
    session: Dict[str, Any] = Depends(validate_session)
):
    """ดูข้อมูล session ปัจจุบัน"""
    # สร้าง response ที่ปลอดภัย (ไม่เปิดเผย path จริง)
    safe_session = {
        "session_id": session_id,
        "created_at": session["created_at"].isoformat(),
        "last_access": session["last_access"].isoformat(),
        "files": [
            {
                "file_id": f["file_id"],
                "original_filename": f["original_filename"],
                "size_bytes": f["size_bytes"],
                "uploaded_at": f["uploaded_at"].isoformat(),
                # เพิ่ม metadata ถ้ามี
                "encoding": f.get("encoding"),
                "detected_delimiter": f.get("detected_delimiter"),
                "header_detected": f.get("header_detected")
            }
            for f in session["files"]
        ],
        "ttl_s": SESSION_TTL_MINUTES * 60
    }
    
    return safe_session

# เพิ่ม API endpoint ใหม่ต่อจาก endpoints ที่มีอยู่แล้ว
@app.post("/api/v1/sessions/{session_id}/profile")
async def generate_profile(
    session_id: str,
    file_id: Optional[str] = None,
    max_sample_rows: int = 10000,
    session: Dict[str, Any] = Depends(validate_session)
):
    """สร้างโปรไฟล์ข้อมูลสำหรับไฟล์ในเซสชัน"""
    # ตรวจสอบว่ามีไฟล์ในเซสชันหรือไม่
    if not session["files"]:
        raise HTTPException(status_code=400, detail="No files in session")
    
    # เลือกไฟล์ที่จะวิเคราะห์
    target_file = None
    
    if file_id:
        # ถ้าระบุ file_id มา ให้หาไฟล์นั้น
        target_file = next((f for f in session["files"] if f["file_id"] == file_id), None)
        if not target_file:
            raise HTTPException(status_code=404, detail=f"File {file_id} not found in session")
    else:
        # ถ้าไม่ได้ระบุ file_id ให้ใช้ไฟล์ล่าสุด
        target_file = session["files"][-1]
    
    # สร้าง data profiler และวิเคราะห์ข้อมูล
    profiler = DataProfiler(
        file_path=target_file["file_path"],
        file_info={
            "encoding": target_file.get("encoding"),
            "detected_delimiter": target_file.get("detected_delimiter"),
            "header_detected": target_file.get("header_detected")
        }
    )
    
    # ทำการวิเคราะห์ข้อมูล
    profile_results = profiler.profile(max_sample_rows=max_sample_rows)
    
    # ตรวจสอบข้อผิดพลาด
    if "error" in profile_results:
        raise HTTPException(status_code=500, detail=profile_results["error"])
    
    # บันทึกผลการวิเคราะห์ลงในข้อมูลไฟล์
    with session_manager.lock:
        for i, f in enumerate(session["files"]):
            if f["file_id"] == target_file["file_id"]:
                session["files"][i]["profile"] = profile_results
                break
    
    return profile_results