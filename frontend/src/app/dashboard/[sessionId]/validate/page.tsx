// Path: /frontend/src/app/dashboard/[sessionId]/validate/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { validateConfig } from '@/lib/api';
import { DataConfig, ValidationResult } from '@/types';
import ValidationDiffPanel from '@/components/ValidationDiffPanel';
import { FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import SessionInfo from '@/components/SessionInfo';

export default function ValidatePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  
  const [config, setConfig] = useState<DataConfig>({});
  const [configId, setConfigId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState<boolean>(false);
  const [configLoaded, setConfigLoaded] = useState<boolean>(false);

  // Check if there's a saved config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Load config from localStorage
        const savedConfig = localStorage.getItem(`config_${sessionId}`);
        const savedConfigId = localStorage.getItem(`configId_${sessionId}`);
        
        if (savedConfig && savedConfigId) {
          setConfig(JSON.parse(savedConfig));
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

  const handleValidate = async () => {
    if (!configId) {
      toast.error('Please save your configuration first');
      return;
    }
    
    setValidating(true);
    
    try {
      const result = await validateConfig(sessionId, configId);
      setValidationResult(result);
      
      // Show appropriate toast based on validation result
      if (result.warnings.length === 0) {
        toast.success('Validation passed with no warnings!');
      } else if (result.warnings.some(w => w.includes('drop') || w.includes('fail'))) {
        toast.error(`Validation complete with ${result.warnings.length} critical warnings`);
      } else {
        toast.warn(`Validation complete with ${result.warnings.length} warnings`);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      toast.error('Failed to validate configuration. Please try again.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <SessionInfo sessionId={sessionId} />
      </div>
      
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-xl font-semibold mb-2 md:mb-0">Validation & Dry Run</h2>
          
          <div className="flex gap-2">
            <button
              className="btn-primary flex items-center"
              onClick={handleValidate}
              disabled={validating || !configId}
            >
              {validating ? (
                <>
                  <div className="h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                  Validating...
                </>
              ) : (
                <>
                  <FiCheckCircle className="mr-2" />
                  Run Validation
                </>
              )}
            </button>
          </div>
        </div>

        {!configLoaded ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700 flex items-center">
            <FiAlertTriangle className="text-yellow-600 mr-2" />
            <div>
              <p className="font-medium">Configuration Required</p>
              <p className="text-sm">
                Please go to the Schema tab to configure and save your data transformation rules first.
              </p>
            </div>
          </div>
        ) : (
          <ValidationDiffPanel 
            validationResult={validationResult} 
            isLoading={validating} 
          />
        )}
      </div>
    </div>
  );
}