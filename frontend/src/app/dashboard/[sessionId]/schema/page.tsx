// Path: /frontend/src/app/dashboard/[sessionId]/schema/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'react-toastify';
import { generateProfile, saveConfig } from '@/lib/api';
import { DataProfile, ColumnConfig, DataConfig } from '@/types';
import ColumnConfigPanel from '@/components/ColumnConfigPanel';
import { guessColumnType } from '@/lib/utils';
import { FiDownload, FiUpload, FiSave } from 'react-icons/fi';
import SessionInfo from '@/components/SessionInfo';

export default function SchemaRulesPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  
  const [profile, setProfile] = useState<DataProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [config, setConfig] = useState<DataConfig>({});

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const data = await generateProfile(sessionId);
        setProfile(data);
        
        // Initialize config with defaults based on profile
        const initialConfig: DataConfig = {};
        data.columns_profile.forEach(col => {
          initialConfig[col.name] = {
            type: guessColumnType(col),
            null_tokens: ['NULL', 'null', 'N/A', ''],
            standardize: {
              trim: true,
              case: 'none',
            },
          };
        });
        
        setConfig(initialConfig);
      } catch (error) {
        console.error('Failed to fetch data profile:', error);
        toast.error('Failed to load data profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [sessionId]);

  const handleConfigChange = (columnName: string, columnConfig: ColumnConfig) => {
    setConfig(prev => ({
      ...prev,
      [columnName]: columnConfig,
    }));
  };

  const saveConfiguration = async () => {
    setSaving(true);
    
    try {
      const result = await saveConfig(sessionId, config);
      setConfigId(result.config_id);
      // Store configId in localStorage for other pages to use
      localStorage.setItem(`config_${sessionId}`, JSON.stringify(config));
      localStorage.setItem(`configId_${sessionId}`, result.config_id);
      toast.success('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error('Failed to save configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const downloadConfigAsJson = () => {
    const configData = JSON.stringify(config, null, 2);
    const blob = new Blob([configData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_config_${sessionId.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleConfigUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const uploadedConfig = JSON.parse(e.target?.result as string);
        setConfig(uploadedConfig);
        toast.success('Configuration loaded successfully');
      } catch (error) {
        console.error('Failed to parse JSON config:', error);
        toast.error('Invalid configuration file. Please upload a valid JSON file.');
      }
    };
    
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <SessionInfo sessionId={sessionId} />
        </div>
        <div className="card p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading schema...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <SessionInfo sessionId={sessionId} />
        </div>
        <div className="card p-6 text-center text-red-600">
          <p>Failed to load data schema. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <SessionInfo sessionId={sessionId} />
      </div>
      
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-xl font-semibold mb-2 md:mb-0">Schema & Transformation Rules</h2>
          
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <input 
                type="file" 
                id="config-upload"
                accept=".json"
                className="sr-only" 
                onChange={handleConfigUpload}
              />
              <label 
                htmlFor="config-upload"
                className="btn-secondary flex items-center cursor-pointer"
              >
                <FiUpload className="mr-2" />
                Import Config
              </label>
            </div>
            
            <button
              className="btn-secondary flex items-center"
              onClick={downloadConfigAsJson}
            >
              <FiDownload className="mr-2" />
              Export Config
            </button>
            
            <button
              className="btn-primary flex items-center"
              onClick={saveConfiguration}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <FiSave className="mr-2" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>
        
        {configId && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
            <p className="flex items-center">
              <FiSave className="mr-2" />
              Configuration saved with ID: <span className="font-mono ml-1">{configId}</span>
            </p>
          </div>
        )}

        <div>
          {profile.columns_profile.map((column) => (
            <ColumnConfigPanel
              key={column.name}
              column={column}
              config={config[column.name] || null}
              onConfigChange={handleConfigChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}