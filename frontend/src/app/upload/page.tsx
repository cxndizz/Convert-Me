'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSession, uploadFile, SessionResponse, FileUploadResponse } from '@/lib/api';

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<FileUploadResponse | null>(null);

  // สร้าง session เมื่อโหลดหน้า
  useEffect(() => {
    async function initSession() {
      try {
        const newSession = await createSession();
        setSession(newSession);
        // บันทึก session ID ไว้ใน localStorage เพื่อใช้ในหน้าอื่น
        localStorage.setItem('datamap_session_id', newSession.session_id);
      } catch (err) {
        setError('Failed to initialize session. Please try again.');
        console.error(err);
      }
    }
    
    initSession();
  }, []);

  // จัดการการเลือกไฟล์
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  }, []);

  // จัดการการอัปโหลดไฟล์
  const handleUpload = useCallback(async () => {
    if (!file || !session) {
      setError('Please select a file first');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await uploadFile(session.session_id, file);
      setUploadResult(result);
      
      // นำทางไปหน้า Dashboard
      router.push(`/dashboard?session=${session.session_id}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  }, [file, session, router]);

  // คำนวณเวลาหมดอายุ
  const getExpiryTime = () => {
    if (!session) return '';
    
    const expiryDate = new Date();
    expiryDate.setSeconds(expiryDate.getSeconds() + session.ttl_s);
    return expiryDate.toLocaleTimeString();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Upload Data File</h1>
      
      {session && (
        <div className="mb-4 text-sm text-gray-500">
          Session ID: {session.session_id} (expires at {getExpiryTime()})
        </div>
      )}
      
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center mb-6">
        <input
          type="file"
          id="file-upload"
          onChange={handleFileChange}
          className="hidden"
          accept=".csv,.txt,.xls,.xlsx,.sql"
        />
        
        <label
          htmlFor="file-upload"
          className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block mb-4"
        >
          Select File
        </label>
        
        {file && (
          <div className="mt-4">
            <p className="font-semibold">{file.name}</p>
            <p className="text-sm text-gray-600">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
        )}
        
        <p className="mt-2 text-gray-500 text-sm">
          Supported formats: CSV, TXT, Excel (XLS/XLSX), SQL
        </p>
      </div>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error}
        </div>
      )}
      
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className={`w-full py-3 rounded-lg font-semibold ${
          !file || loading
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {loading ? 'Uploading...' : 'Upload File'}
      </button>
      
      {uploadResult && (
        <div className="mt-6 bg-green-100 text-green-800 p-4 rounded">
          <h3 className="font-bold">File Uploaded Successfully!</h3>
          <p>File ID: {uploadResult.file_id}</p>
          <p>Detected encoding: {uploadResult.encoding || 'Unknown'}</p>
          {uploadResult.detected_delimiter && (
            <p>Detected delimiter: {uploadResult.detected_delimiter === '\t' ? 'Tab' : uploadResult.detected_delimiter}</p>
          )}
          {uploadResult.header_detected !== undefined && (
            <p>Header detected: {uploadResult.header_detected ? 'Yes' : 'No'}</p>
          )}
        </div>
      )}
    </div>
  );
}