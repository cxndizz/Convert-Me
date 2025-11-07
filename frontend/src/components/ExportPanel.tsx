'use client';

import { useState } from 'react';
import { toast } from 'react-toastify';
import { exportData } from '@/lib/api';
import { ExportFormat } from '@/types';
import { 
  FiDownload, 
  FiFileText, 
  FiFileImage,
  FiFileOutput,
  FiFileCode
} from 'react-icons/fi';

interface ExportPanelProps {
  sessionId: string;
  configId: string;
}

export default function ExportPanel({ 
  sessionId, 
  configId 
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      await exportData(sessionId, configId, selectedFormat);
      toast.success(`Exporting as ${selectedFormat.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-4 flex items-center">
        <FiDownload className="mr-2" />
        Export Data
      </h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Export Format
        </label>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            className={`border rounded-md p-3 cursor-pointer text-center ${
              selectedFormat === 'csv' 
                ? 'bg-primary-50 border-primary-500 text-primary-700' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedFormat('csv')}
          >
            <FiFileText className="mx-auto text-2xl mb-1" />
            <div className="font-medium">CSV</div>
          </div>
          
          <div
            className={`border rounded-md p-3 cursor-pointer text-center ${
              selectedFormat === 'xlsx' 
                ? 'bg-primary-50 border-primary-500 text-primary-700' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedFormat('xlsx')}
          >
            <FiFileOutput className="mx-auto text-2xl mb-1" />
            <div className="font-medium">XLSX</div>
          </div>
          
          <div
            className={`border rounded-md p-3 cursor-pointer text-center ${
              selectedFormat === 'parquet' 
                ? 'bg-primary-50 border-primary-500 text-primary-700' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedFormat('parquet')}
          >
            <FiFileImage className="mx-auto text-2xl mb-1" />
            <div className="font-medium">Parquet</div>
          </div>
          
          <div
            className={`border rounded-md p-3 cursor-pointer text-center ${
              selectedFormat === 'jsonl' 
                ? 'bg-primary-50 border-primary-500 text-primary-700' 
                : 'hover:bg-gray-50'
            }`}
            onClick={() => setSelectedFormat('jsonl')}
          >
            <FiFileCode className="mx-auto text-2xl mb-1" />
            <div className="font-medium">JSONL</div>
          </div>
        </div>
      </div>
      
      <button
        className="btn-primary w-full flex items-center justify-center"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting ? (
          <>
            <div className="h-5 w-5 mr-2 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
            Exporting...
          </>
        ) : (
          <>
            <FiDownload className="mr-2" />
            Download as {selectedFormat.toUpperCase()}
          </>
        )}
      </button>
    </div>
  );
}