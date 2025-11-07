from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid
import os
import shutil
from pathlib import Path
import threading
import time

# Models
class SessionResponse(BaseModel):
    session_id: str
    ttl_s: int

class FileUploadResponse(BaseModel):
    session_id: str
    file_id: str
    original_filename: str
    size_bytes: int
    detected_delimiter: Optional[str] = None
    encoding: Optional[str] = None
    header_detected: Optional[bool] = None

# Session Manager
class SessionManager:
    def __init__(self, temp_path: str, ttl_minutes: int = 60):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.temp_path = temp_path
        self.ttl_minutes = ttl_minutes
        self.lock = threading.Lock()
        
        # ตรวจสอบและสร้างโฟลเดอร์ temp ถ้าไม่มี
        os.makedirs(temp_path, exist_ok=True)
        
        # เริ่ม thread สำหรับ garbage collection
        self.gc_thread = threading.Thread(target=self._gc_worker, daemon=True)
        self.gc_thread.start()
    
    def create_session(self) -> str:
        """สร้าง session ใหม่และคืนค่า session_id"""
        session_id = str(uuid.uuid4())
        session_dir = os.path.join(self.temp_path, session_id)
        
        # สร้างโฟลเดอร์สำหรับ session
        os.makedirs(session_dir, exist_ok=True)
        
        now = datetime.now()
        with self.lock:
            self.sessions[session_id] = {
                "created_at": now,
                "last_access": now,
                "files": [],
                "temp_path": session_dir
            }
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """ดึงข้อมูล session และอัปเดต last_access"""
        with self.lock:
            if session_id not in self.sessions:
                return None
            
            # อัปเดต last_access
            self.sessions[session_id]["last_access"] = datetime.now()
            return self.sessions[session_id]
    
    def add_file_to_session(self, session_id: str, file_id: str, filename: str, file_path: str, 
                           file_size: int, metadata: Optional[Dict[str, Any]] = None) -> None:
        """เพิ่มข้อมูลไฟล์ใน session"""
        with self.lock:
            if session_id not in self.sessions:
                raise ValueError(f"Session {session_id} not found")
            
            file_info = {
                "file_id": file_id,
                "original_filename": filename,
                "file_path": file_path,
                "size_bytes": file_size,
                "uploaded_at": datetime.now(),
            }
            
            if metadata:
                file_info.update(metadata)
            
            self.sessions[session_id]["files"].append(file_info)
    
    def delete_session(self, session_id: str) -> bool:
        """ลบ session และไฟล์ที่เกี่ยวข้อง"""
        with self.lock:
            if session_id not in self.sessions:
                return False
            
            session_dir = self.sessions[session_id]["temp_path"]
            
            # ลบข้อมูล session จาก dictionary
            del self.sessions[session_id]
        
        # ลบไฟล์ทั้งหมดใน session directory
        try:
            shutil.rmtree(session_dir)
        except Exception as e:
            print(f"Error deleting session directory {session_dir}: {e}")
        
        return True
    
    def _gc_worker(self):
        """Worker สำหรับเช็คและลบ session ที่หมดอายุ"""
        while True:
            try:
                self._cleanup_expired_sessions()
            except Exception as e:
                print(f"Error in GC worker: {e}")
            
            # ตรวจสอบทุก 10 นาที (600 วินาที)
            time.sleep(600)
    
    def _cleanup_expired_sessions(self):
        """ลบ session ที่หมดอายุ"""
        now = datetime.now()
        expired_sessions = []
        
        # หา sessions ที่หมดอายุ
        with self.lock:
            for session_id, session in self.sessions.items():
                last_access = session["last_access"]
                # ถ้า last_access + ttl < now แสดงว่าหมดอายุ
                ttl_seconds = self.ttl_minutes * 60
                if (now - last_access).total_seconds() > ttl_seconds:
                    expired_sessions.append(session_id)
        
        # ลบ sessions ที่หมดอายุ
        for session_id in expired_sessions:
            print(f"Deleting expired session {session_id}")
            self.delete_session(session_id)