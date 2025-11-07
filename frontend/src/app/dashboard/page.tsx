'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { generateProfile } from '@/lib/api';
import { DataProfile } from '@/types';
import { 
  formatPercentage, 
  getSeverityLevel,
  getSeverityColor
} from '@/lib/utils';
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';

export default function DashboardOverview() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  
  const [profile, setProfile] = useState<DataProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await generateProfile(sessionId);
        setProfile(data);
      } catch (error) {
        console.error('Failed to fetch data profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-r-transparent"></div>
        <p className="mt-4 text-gray-600">Analyzing data...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card p-6 text-center text-red-600">
        <p>Failed to load data profile. Please try again.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Column Analysis</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header px-6 py-3">Column Name</th>
                <th className="table-header px-6 py-3">Inferred Type</th>
                <th className="table-header px-6 py-3">NULL %</th>
                <th className="table-header px-6 py-3">Distinct %</th>
                <th className="table-header px-6 py-3">Sample Values</th>
                <th className="table-header px-6 py-3">Issues</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {profile.columns_profile.map((column) => {
                const nullSeverity = getSeverityLevel(column.null_pct);
                const nullClass = getSeverityColor(nullSeverity);
                
                return (
                  <tr key={column.name} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{column.name}</td>
                    <td className="table-cell">{column.inferred_type}</td>
                    <td className="table-cell">
                      <span className={`px-2 py-1 rounded-full text-xs ${nullClass}`}>
                        {formatPercentage(column.null_pct)}
                      </span>
                    </td>
                    <td className="table-cell">{formatPercentage(column.distinct_pct)}</td>
                    <td className="table-cell">
                      <div className="max-w-xs truncate">
                        {column.samples.slice(0, 3).map((sample, i) => (
                          <span key={i} className="mr-1">
                            {sample !== null ? String(sample) : 'NULL'}
                            {i < 2 && column.samples.length > i + 1 ? ', ' : ''}
                          </span>
                        ))}
                        {column.samples.length > 3 && '...'}
                      </div>
                    </td>
                    <td className="table-cell">
                      {column.issues && column.issues.length > 0 ? (
                        <div className="flex items-center text-red-600">
                          <FiAlertTriangle className="mr-1" />
                          <span>{column.issues.length}</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-green-600">
                          <FiCheckCircle className="mr-1" />
                          <span>None</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Data Quality Insights</h2>
        
        <div className="space-y-4">
          {/* Empty values analysis */}
          <div>
            <h3 className="font-medium text-gray-800 mb-2 flex items-center">
              <FiInfo className="mr-2 text-primary-500" />
              Empty Values
            </h3>
            <div className="pl-6">
              {profile.columns_profile.some(col => col.null_pct > 0) ? (
                <ul className="list-disc pl-5">
                  {profile.columns_profile
                    .filter(col => col.null_pct > 5) // Only show columns with >5% nulls
                    .sort((a, b) => b.null_pct - a.null_pct) // Sort by highest null % first
                    .slice(0, 5) // Show top 5 only
                    .map(col => (
                      <li key={col.name} className="mb-1">
                        <span className="font-medium">{col.name}</span>: 
                        <span className={`ml-2 ${getSeverityColor(getSeverityLevel(col.null_pct))}`}>
                          {formatPercentage(col.null_pct)} empty
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-green-600 flex items-center">
                  <FiCheckCircle className="mr-2" />
                  No significant empty values found!
                </p>
              )}
            </div>
          </div>
          
          {/* Type recommendations */}
          <div>
            <h3 className="font-medium text-gray-800 mb-2 flex items-center">
              <FiInfo className="mr-2 text-primary-500" />
              Type Recommendations
            </h3>
            <div className="pl-6">
              <ul className="list-disc pl-5">
                {profile.columns_profile.map(col => (
                  <li key={col.name} className="mb-1">
                    <span className="font-medium">{col.name}</span>: Recommended type 
                    <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                      {col.inferred_type}
                    </span>
                  </li>
                )).slice(0, 5)}
                {profile.columns_profile.length > 5 && (
                  <li className="text-gray-500 italic">
                    ... and {profile.columns_profile.length - 5} more columns
                  </li>
                )}
              </ul>
            </div>
          </div>
          
          {/* Issues found */}
          <div>
            <h3 className="font-medium text-gray-800 mb-2 flex items-center">
              <FiAlertTriangle className="mr-2 text-yellow-500" />
              Potential Issues
            </h3>
            <div className="pl-6">
              {profile.columns_profile.some(col => col.issues && col.issues.length > 0) ? (
                <ul className="list-disc pl-5">
                  {profile.columns_profile
                    .filter(col => col.issues && col.issues.length > 0)
                    .map(col => (
                      <li key={col.name} className="mb-1">
                        <span className="font-medium">{col.name}</span>: 
                        <span className="ml-2 text-red-600">
                          {col.issues!.join(', ')}
                        </span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-green-600 flex items-center">
                  <FiCheckCircle className="mr-2" />
                  No significant issues detected!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}