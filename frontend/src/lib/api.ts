// Path: /frontend/src/lib/api.ts

import axios from 'axios';

import { 
  Session, 
  FileInfo, 
  DataProfile, 
  DataConfig, 
  ValidationResult,
  SqlOptions,
  ExportFormat
} from '../types';

// Base API URL จาก env variable หรือค่าเริ่มต้น
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7002';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Session API functions
export const createSession = async (): Promise<Session> => {
  const response = await api.post('/sessions');
  return response.data;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await api.delete(`/sessions/${sessionId}`);
};

// File API functions
export const uploadFile = async (
  sessionId: string, 
  file: File, 
  options?: { 
    delimiter?: string; 
    encoding?: string; 
    hasHeader?: boolean 
  }
): Promise<FileInfo> => {
  const formData = new FormData();
  formData.append('file', file);
  
  if (options) {
    if (options.delimiter) formData.append('delimiter', options.delimiter);
    if (options.encoding) formData.append('encoding', options.encoding);
    if (options.hasHeader !== undefined) formData.append('has_header', String(options.hasHeader));
  }
  
  const response = await api.post(`/sessions/${sessionId}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

export const generateProfile = async (sessionId: string): Promise<DataProfile> => {
  const response = await api.post(`/sessions/${sessionId}/profile`);
  return response.data;
};

export const getDataPreview = async (
  sessionId: string, 
  offset: number = 0, 
  limit: number = 100,
  configId?: string
): Promise<{data: any[], total: number, offset: number, limit: number}> => {
  const params: any = { offset, limit };
  if (configId) params.apply_config_id = configId;
  
  const response = await api.get(`/sessions/${sessionId}/preview`, { params });
  return response.data;
};

// Configuration API functions
export const saveConfig = async (sessionId: string, config: DataConfig): Promise<{ config_id: string }> => {
  const response = await api.post(`/sessions/${sessionId}/configs`, config);
  return response.data;
};

export const validateConfig = async (sessionId: string, configId: string): Promise<ValidationResult> => {
  const response = await api.post(`/sessions/${sessionId}/validate`, { config_id: configId });
  return response.data;
};

// Export API functions
export const exportData = async (
  sessionId: string, 
  configId: string, 
  format: ExportFormat
): Promise<void> => {
  // Create a blob URL and trigger download
  window.location.href = `${API_BASE_URL}/api/v1/sessions/${sessionId}/export?config_id=${configId}&format=${format}`;
};

export const generateSql = async (
  sessionId: string, 
  configId: string, 
  options: SqlOptions
): Promise<string> => {
  const response = await api.post(`/sessions/${sessionId}/sql`, {
    config_id: configId,
    ...options,
  });
  return response.data.sql;
};

// Health check
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await api.get('/health');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};