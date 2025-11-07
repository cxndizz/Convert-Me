'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSessionInfo, generateProfile, SessionInfo, ProfileResponse } from '@/lib/api';
import DataProfileSummary from '@/components/DataProfileSummary';

// Component แยกที่ใช้ useSearchParams
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session') || '';
  
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ดึงข้อมูลเซสชันและสร้างโปรไฟล์
  useEffect(() => {
    // ถ้าไม่มี sessionId ใน URL ให้ลองดึงจาก localStorage
    const storedSessionId = !sessionId ? localStorage.getItem('datamap_session_id') : null;
    
    if (!sessionId && !storedSessionId) {
      // ถ้าไม่พบ sessionId ให้กลับไปหน้า Upload
      router.push('/upload');
      return;
    }

    const activeSessionId = sessionId || storedSessionId!;

    // ดึงข้อมูล session
    async function fetchSessionInfo() {
      setLoading(true);
      try {
        const info = await getSessionInfo(activeSessionId);
        setSessionInfo(info);
        
        // ถ้ายังไม่มีไฟล์ใน session ให้กลับไปหน้า Upload
        if (info.files.length === 0) {
          router.push('/upload');
          return;
        }

        // ดึงข้อมูลโปรไฟล์
        await fetchProfile(activeSessionId, info.files[info.files.length - 1].file_id);
      } catch (err) {
        console.error(err);
        setError('Failed to load session information. The session may have expired.');
      } finally {
        setLoading(false);
      }
    }

    fetchSessionInfo();
  }, [sessionId, router]);

  // ฟังก์ชันดึงข้อมูลโปรไฟล์
  const fetchProfile = async (sessionId: string, fileId: string) => {
    setProfileLoading(true);
    try {
      const profileData = await generateProfile(sessionId, fileId);
      setProfile(profileData);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to generate data profile: ${err.message}`);
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4">Loading session data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 text-red-700 p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p>{error}</p>
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => router.push('/upload')}
          >
            Go to Upload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Data Dashboard</h1>
      
      {sessionInfo && (
        <div className="mb-6">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Session Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500">Session ID</p>
                <p className="font-mono">{sessionInfo.session_id}</p>
              </div>
              <div>
                <p className="text-gray-500">Expires in</p>
                <p>{Math.floor(sessionInfo.ttl_s / 60)} minutes</p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Uploaded Files</h2>
            {sessionInfo.files.map((file) => (
              <div key={file.file_id} className="border-b border-gray-200 py-4 last:border-0">
                <h3 className="font-semibold">{file.original_filename}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div>
                    <p className="text-gray-500 text-sm">Size</p>
                    <p>{(file.size_bytes / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Encoding</p>
                    <p>{file.encoding || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Delimiter</p>
                    <p>{file.detected_delimiter || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-sm">Header</p>
                    <p>{file.header_detected !== undefined ? (file.header_detected ? 'Yes' : 'No') : 'Unknown'}</p>
                  </div>
                </div>
                {sessionInfo.files.length > 1 && (
                  <button 
                    className="mt-2 text-blue-600 text-sm hover:underline"
                    onClick={() => fetchProfile(sessionInfo.session_id, file.file_id)}
                  >
                    View profile for this file
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {profileLoading ? (
            <div className="bg-white shadow rounded-lg p-6 flex items-center justify-center" style={{minHeight: '300px'}}>
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4">Generating data profile...</p>
                <p className="text-sm text-gray-500 mt-2">This might take a moment for large files.</p>
              </div>
            </div>
          ) : profile ? (
            <DataProfileSummary profile={profile} />
          ) : (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="mt-4 text-xl font-medium">No profile generated yet</h2>
                <p className="mt-2 text-gray-500">Click the button below to generate a data profile for your file.</p>
                <button 
                  className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  onClick={() => fetchProfile(sessionInfo.session_id, sessionInfo.files[sessionInfo.files.length - 1].file_id)}
                >
                  Generate Profile
                </button>
              </div>
            </div>
          )}
          
          <div className="mt-6 flex space-x-4">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => router.push('/upload')}
            >
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// หน้าหลักที่ครอบ DashboardContent ด้วย Suspense
export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4">Loading dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}