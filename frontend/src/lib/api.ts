// API client สำหรับติดต่อกับ backend

// Base URL สำหรับเรียก API
const API_BASE_URL = '/api/v1';

// ข้อมูลตอบกลับจากการสร้าง session
export interface SessionResponse {
  session_id: string;
  ttl_s: number;
}

// ข้อมูลตอบกลับจากการอัปโหลดไฟล์
export interface FileUploadResponse {
  session_id: string;
  file_id: string;
  original_filename: string;
  size_bytes: number;
  detected_delimiter?: string;
  encoding?: string;
  header_detected?: boolean;
}

// ข้อมูล session
export interface SessionInfo {
  session_id: string;
  created_at: string;
  last_access: string;
  files: Array<{
    file_id: string;
    original_filename: string;
    size_bytes: number;
    uploaded_at: string;
    encoding?: string;
    detected_delimiter?: string;
    header_detected?: boolean;
  }>;
  ttl_s: number;
}

// Function สร้าง session ใหม่
export async function createSession(): Promise<SessionResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.statusText}`);
  }
  
  return await response.json();
}

// Function อัปโหลดไฟล์
export async function uploadFile(sessionId: string, file: File): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/files`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to upload file: ${errorData.detail || response.statusText}`);
  }
  
  return await response.json();
}

// Function ดูข้อมูล session
export async function getSessionInfo(sessionId: string): Promise<SessionInfo> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get session info: ${response.statusText}`);
  }
  
  return await response.json();
}

// Function ลบ session
export async function deleteSession(sessionId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete session: ${response.statusText}`);
  }
  
  return await response.json();
}


// เพิ่ม interface สำหรับ profile response
export interface ColumnProfile {
  name: string;
  inferred_type: string;
  null_count: number;
  null_pct: number;
  distinct_count: number;
  distinct_pct: number;
  sample_values: any[];
  issues: string[];
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  std_dev?: number;
  avg_length?: number;
  max_length?: number;
}

export interface ProfileResponse {
  row_count: number;
  column_count: number;
  file_name: string;
  file_extension: string;
  encoding: string;
  delimiter?: string;
  header_detected?: boolean;
  columns_profile: ColumnProfile[];
}

// เพิ่มฟังก์ชันนี้ต่อจากฟังก์ชันอื่น ๆ ใน api.ts
export async function generateProfile(
  sessionId: string,
  fileId?: string,
  maxSampleRows: number = 10000
): Promise<ProfileResponse> {
  let url = `${API_BASE_URL}/sessions/${sessionId}/profile`;
  
  // ถ้ามี fileId ให้เพิ่มเป็น query parameter
  if (fileId) {
    url += `?file_id=${fileId}`;
  }
  
  if (maxSampleRows !== 10000) {
    url += `${fileId ? '&' : '?'}max_sample_rows=${maxSampleRows}`;
  }
  
  const response = await fetch(url, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(`Failed to generate profile: ${errorData.detail || response.statusText}`);
  }
  
  return await response.json();
}