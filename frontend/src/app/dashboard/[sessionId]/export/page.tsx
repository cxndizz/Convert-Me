// Path: /frontend/src/app/dashboard/[sessionId]/export/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { FiAlertTriangle, FiCheck } from 'react-icons/fi';
import ExportPanel from '@/components/ExportPanel';
import SqlGenerator from '@/components/SqlGenerator';
import SessionInfo from '@/components/SessionInfo';

export default function ExportPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  
  const [configId, setConfigId] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState<boolean>(false);

  // Check if there's a saved config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Load configId from localStorage
        const savedConfigId = localStorage.getItem(`configId_${sessionId}`);
        
        if (savedConfigId) {
          setConfigId(savedConfigId);
          setConfigLoaded(true);
        } else {
          toast.info('Please save your configuration in the Schema tab first');
          setConfigLoaded(false);
        }
      } catch (error) {
        console.error('Error loading config:', error);
      }
    };

    loadConfig();
  }, [sessionId]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <SessionInfo sessionId={sessionId} />
      </div>
      
      {!configLoaded ? (
        <div className="card p-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-yellow-700 flex items-center">
            <FiAlertTriangle className="text-yellow-600 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium">Configuration Required</p>
              <p className="text-sm">
                Please go to the Schema tab to configure and save your data transformation rules first.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-700 flex items-center mb-6">
          <FiCheck className="text-green-600 mr-2 flex-shrink-0" />
          <div>
            <p className="font-medium">Configuration Loaded</p>
            <p className="text-sm">
              Using config ID: <span className="font-mono">{configId}</span>
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {configLoaded && configId && (
          <>
            <ExportPanel sessionId={sessionId} configId={configId} />
            
            <SqlGenerator 
              sessionId={sessionId} 
              configId={configId} 
              tableName="transformed_data"
            />
          </>
        )}
      </div>

      <div className="card p-4 bg-gray-50">
        <h3 className="text-lg font-medium mb-2">Important Notes</h3>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          <li>
            <span className="font-medium">No permanent storage:</span> All files and configurations 
            are temporary and will be deleted when your session expires.
          </li>
          <li>
            <span className="font-medium">Session duration:</span> Your data will be available for 60 minutes 
            from the time of upload or last activity.
          </li>
          <li>
            <span className="font-medium">Download all outputs:</span> Make sure to download your exported files 
            and SQL statements before closing this page.
          </li>
        </ul>
      </div>
    </div>
  );
}