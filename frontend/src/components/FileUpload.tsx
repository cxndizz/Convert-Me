'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';
import { FiUpload, FiFile, FiX } from 'react-icons/fi';
import { createSession, uploadFile } from '@/lib/api';
import { formatFileSize } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const ALLOWED_EXTENSIONS = ['.csv', '.txt', '.xls', '.xlsx', '.sql'];
const MAX_FILE_SIZE_MB = 500; // 500MB

export default function FileUpload() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadOptions, setUploadOptions] = useState({
    encoding: 'utf-8',
    delimiter: '',
    hasHeader: true,
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    
    if (!selectedFile) return;
    
    // Check file size
    if (selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB`);
      return;
    }
    
    // Check file extension
    const fileExt = `.${selectedFile.name.split('.').pop()?.toLowerCase()}`;
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      toast.error(`Unsupported file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }
    
    setFile(selectedFile);
    
    // Auto-detect delimiter based on file extension
    if (fileExt === '.csv') {
      setUploadOptions(prev => ({ ...prev, delimiter: ',' }));
    } else if (fileExt === '.txt') {
      setUploadOptions(prev => ({ ...prev, delimiter: '\\t' }));
    }
  }, []);
  
  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
  };
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: false,
  });
  
  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      // Create a new session
      const session = await createSession();
      setUploadProgress(30);
      
      // Upload the file to the session
      const fileInfo = await uploadFile(session.session_id, file, uploadOptions);
      setUploadProgress(90);
      
      // Navigate to dashboard with the session ID
      router.push(`/dashboard/${session.session_id}`);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file. Please try again.');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };
  
  const updateOption = (key: keyof typeof uploadOptions, value: any) => {
    setUploadOptions(prev => ({ ...prev, [key]: value }));
  };
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="card">
        <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
          Upload Your Data File
        </h2>
        
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-primary-400 bg-primary-50' 
              : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          
          {file ? (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div className="flex items-center">
                <FiFile className="text-primary-500 mr-3 text-xl" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={(e) => { 
                  e.stopPropagation();
                  removeFile();
                }}
                className="p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-200"
              >
                <FiX />
              </button>
            </div>
          ) : (
            <div>
              <FiUpload className="mx-auto text-4xl text-gray-400 mb-3" />
              <p className="text-lg font-medium">Drag & drop your file here</p>
              <p className="text-gray-500 mt-1">or click to browse</p>
              <p className="mt-3 text-sm text-gray-500">
                Supported formats: CSV, TXT, XLS, XLSX, SQL (Max: {MAX_FILE_SIZE_MB}MB)
              </p>
            </div>
          )}
        </div>
        
        {file && (
          <>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Encoding
                </label>
                <select
                  className="input-field"
                  value={uploadOptions.encoding}
                  onChange={(e) => updateOption('encoding', e.target.value)}
                >
                  <option value="utf-8">UTF-8</option>
                  <option value="latin1">Latin-1</option>
                  <option value="ascii">ASCII</option>
                  <option value="utf-16">UTF-16</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delimiter (CSV/TXT)
                </label>
                <select
                  className="input-field"
                  value={uploadOptions.delimiter}
                  onChange={(e) => updateOption('delimiter', e.target.value)}
                >
                  <option value="">Auto-detect</option>
                  <option value=",">Comma (,)</option>
                  <option value="\\t">Tab (\\t)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={uploadOptions.hasHeader}
                    onChange={(e) => updateOption('hasHeader', e.target.checked)}
                    className="h-4 w-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">File has header row</span>
                </label>
              </div>
            </div>
            
            {isUploading ? (
              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-center text-sm text-gray-600 mt-2">Uploading... {uploadProgress}%</p>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleUpload}
                  className="btn-primary"
                >
                  Upload & Analyze
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}