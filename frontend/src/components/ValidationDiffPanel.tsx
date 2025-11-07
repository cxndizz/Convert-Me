'use client';

import { useState } from 'react';
import { ValidationResult } from '@/types';
import { FiAlertTriangle, FiCheck, FiX } from 'react-icons/fi';
import { safeStringify } from '@/lib/utils';

interface ValidationDiffPanelProps {
  validationResult: ValidationResult | null;
  isLoading: boolean;
}

export default function ValidationDiffPanel({ 
  validationResult, 
  isLoading 
}: ValidationDiffPanelProps) {
  if (isLoading) {
    return (
      <div className="card flex justify-center items-center p-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-r-transparent"></div>
        <p className="ml-3 text-gray-600">Running validation...</p>
      </div>
    );
  }

  if (!validationResult) {
    return (
      <div className="card p-6 text-center text-gray-500">
        <p>Run validation to see results</p>
      </div>
    );
  }

  // Determine severity based on warnings
  const hasSevereWarnings = validationResult.warnings.some(
    w => w.includes('drop') || w.includes('fail')
  );

  const severityClass = hasSevereWarnings
    ? 'bg-red-50 border-red-200 text-red-800'
    : validationResult.warnings.length > 0
      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
      : 'bg-green-50 border-green-200 text-green-800';

  return (
    <div className="mb-6">
      <div className={`p-4 rounded-md border ${severityClass} mb-4`}>
        <div className="flex items-center mb-2">
          {hasSevereWarnings ? (
            <FiAlertTriangle className="text-red-600 mr-2" />
          ) : validationResult.warnings.length > 0 ? (
            <FiAlertTriangle className="text-yellow-600 mr-2" />
          ) : (
            <FiCheck className="text-green-600 mr-2" />
          )}
          <h3 className="font-medium">
            Validation Summary: {validationResult.rows_affected.toLocaleString()} rows affected
          </h3>
        </div>

        {validationResult.warnings.length > 0 && (
          <div className="mb-2">
            <h4 className="font-medium text-sm mb-1">Warnings:</h4>
            <ul className="list-disc list-inside text-sm">
              {validationResult.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {validationResult.diff_sample.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium mb-4">Sample Changes</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header px-6 py-3">Column</th>
                  <th className="table-header px-6 py-3">Before</th>
                  <th className="table-header px-6 py-3">After</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {validationResult.diff_sample.map((diff, index) => {
                  // Find columns that changed
                  const changedColumns = Object.keys(diff.before).filter(
                    col => safeStringify(diff.before[col]) !== safeStringify(diff.after[col])
                  );

                  return changedColumns.map(column => (
                    <tr key={`${index}-${column}`} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{column}</td>
                      <td className="table-cell">
                        <div className="bg-red-50 p-1 rounded text-red-700">
                          {safeStringify(diff.before[column])}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="bg-green-50 p-1 rounded text-green-700">
                          {safeStringify(diff.after[column])}
                        </div>
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}