# Path: /backend/app/api/routes.py

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from app.models.models import (
    SessionResponse, FileUploadResponse, DataConfig, 
    ValidationResult, SqlOptions
)
from app.services.session_manager import session_manager
from app.services.file_service import file_service
from app.services.profile_service import profile_service
from app.services.transform_service import transform_service
from app.services.sql_service import sql_service

router = APIRouter()

@router.post("/sessions", response_model=SessionResponse)
async def create_session():
    """สร้าง session ใหม่"""
    session_id = session_manager.create_session()
    return SessionResponse(
        session_id=session_id,
        ttl_s=session_manager.ttl_minutes * 60
    )

@router.post("/sessions/{session_id}/files", response_model=FileUploadResponse)
async def upload_file(
    session_id: str,
    file: UploadFile = File(...),
    session = Depends(session_manager.validate_session)
):
    """อัปโหลดไฟล์ไปยัง session"""
    file_info, detection = await file_service.save_uploaded_file(
        file=file,
        session_id=session_id
    )
    
    return FileUploadResponse(
        session_id=session_id,
        file_id=file_info.file_id,
        original_filename=file_info.filename,
        size_bytes=file_info.size,
        detected_delimiter=detection.get('delimiter'),
        encoding=detection.get('encoding'),
        header_detected=detection.get('header_detected')
    )

@router.post("/sessions/{session_id}/profile")
async def generate_profile(
    session_id: str,
    file_id: Optional[str] = None,
    max_sample_rows: int = 10000,
    session = Depends(session_manager.validate_session)
):
    """สร้างโปรไฟล์ข้อมูลสำหรับไฟล์ในเซสชัน"""
    profile_results = await profile_service.generate_profile(
        session_id=session_id,
        file_id=file_id,
        max_sample_rows=max_sample_rows
    )
    
    return profile_results

@router.get("/sessions/{session_id}/preview")
async def get_data_preview(
    session_id: str,
    offset: int = 0,
    limit: int = 100,
    config_id: Optional[str] = None,
    session = Depends(session_manager.validate_session)
):
    """ดึงข้อมูลตัวอย่างจากไฟล์"""
    preview_results = await profile_service.get_data_preview(
        session_id=session_id,
        offset=offset,
        limit=limit,
        config_id=config_id
    )
    
    return preview_results

@router.post("/sessions/{session_id}/configs")
async def save_config(
    session_id: str,
    config: Dict[str, Any],
    session = Depends(session_manager.validate_session)
):
    """บันทึกการตั้งค่าการแปลงข้อมูล"""
    config_id = transform_service.save_config(
        session_id=session_id,
        config=config
    )
    
    return {"config_id": config_id}

@router.post("/sessions/{session_id}/validate", response_model=ValidationResult)
async def validate_config(
    session_id: str,
    request: Dict[str, str],
    session = Depends(session_manager.validate_session)
):
    """ทดสอบการแปลงข้อมูลและแสดงผลลัพธ์"""
    config_id = request.get("config_id")
    if not config_id:
        raise HTTPException(status_code=400, detail="config_id is required")
    
    validation_result = await transform_service.validate_config(
        session_id=session_id,
        config_id=config_id
    )
    
    return validation_result

@router.get("/sessions/{session_id}/export")
async def export_data(
    session_id: str,
    config_id: str,
    format: str = "csv",
    session = Depends(session_manager.validate_session)
):
    """ส่งออกข้อมูลในรูปแบบต่าง ๆ"""
    if format not in ["csv", "xlsx", "parquet", "jsonl"]:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")
    
    # Get generator and content type
    generator, content_type, filename = await transform_service.export_data(
        session_id=session_id,
        config_id=config_id,
        format=format
    )
    
    # Create streaming response
    return StreamingResponse(
        generator,
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/sessions/{session_id}/sql")
async def generate_sql(
    session_id: str,
    options: SqlOptions,
    session = Depends(session_manager.validate_session)
):
    """สร้างคำสั่ง SQL สำหรับข้อมูล"""
    sql = await sql_service.generate_sql(
        session_id=session_id,
        config_id=options.config_id,
        dialect=options.dialect,
        sql_type=options.type,
        table_name=options.table_name
    )
    
    return {"sql": sql}

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    session = Depends(session_manager.validate_session)
):
    """ลบ session และไฟล์ที่เกี่ยวข้อง"""
    success = session_manager.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete session")
    return {"status": "success", "message": f"Session {session_id} deleted"}