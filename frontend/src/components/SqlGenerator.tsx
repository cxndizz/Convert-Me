'use client';

import { useState } from 'react';
import { generateSql } from '@/lib/api';
import { FiCopy, FiDownload, FiCode, FiDatabase, FiSave } from 'react-icons/fi';
import { toast } from 'react-toastify';

interface SqlGeneratorProps {
  sessionId: string;
  configId: string;
  tableName?: string;
}

export default function SqlGenerator({ 
  sessionId, 
  configId, 
  tableName = 'transformed_data' 
}: SqlGeneratorProps) {
  const [sql, setSql] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sqlType, setSqlType] = useState<'ddl' | 'dml' | 'ctas'>('ddl');
  const [customTableName, setCustomTableName] = useState<string>(tableName);

  const handleGenerateSql = async () => {
    setIsLoading(true);
    
    try {
      const generatedSql = await generateSql(sessionId, configId, {
        dialect: 'postgres',
        type: sqlType,
        table_name: customTableName,
      });
      
      setSql(generatedSql);
    } catch (error) {
      console.error('Failed to generate SQL:', error);
      toast.error('Failed to generate SQL. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    toast.success('SQL copied to clipboard');
  };

  const handleDownload = () => {
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${customTableName}_${sqlType}.sql`;
    document.body.appendChild(a);
    a.click();
    
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="card">
      <h3 className="text-lg font-medium mb-4 flex items-center">
        <FiCode className="mr-2" />
        SQL Generator
      </h3>
      
      <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SQL Type
          </label>
          <select
            className="input-field"
            value={sqlType}
            onChange={(e) => setSqlType(e.target.value as 'ddl' | 'dml' | 'ctas')}
          >
            <option value="ddl">CREATE TABLE (DDL)</option>
            <option value="dml">INSERT Statements (DML)</option>
            <option value="ctas">CREATE TABLE AS SELECT (CTAS)</option>
          </select>
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Table Name
          </label>
          <input
            type="text"
            className="input-field"
            value={customTableName}
            onChange={(e) => setCustomTableName(e.target.value)}
            placeholder="Enter table name"
          />
        </div>
      </div>

      <div className="mb-4">
        <button
          className="btn-primary flex items-center"
          onClick={handleGenerateSql}
          disabled={isLoading}
        >
          <FiDatabase className="mr-2" />
          Generate SQL
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Generating SQL...</p>
        </div>
      ) : sql ? (
        <div>
          <div className="flex justify-end space-x-2 mb-2">
            <button
              className="btn-secondary flex items-center py-1 px-3 text-sm"
              onClick={handleCopy}
            >
              <FiCopy className="mr-1" />
              Copy
            </button>
            <button
              className="btn-secondary flex items-center py-1 px-3 text-sm"
              onClick={handleDownload}
            >
              <FiDownload className="mr-1" />
              Download SQL
            </button>
          </div>
          
          <div className="bg-gray-800 text-gray-100 p-4 rounded-md overflow-x-auto">
            <pre className="whitespace-pre-wrap">{sql}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}