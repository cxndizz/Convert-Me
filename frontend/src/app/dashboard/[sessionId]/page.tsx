// Path: /frontend/src/app/dashboard/[sessionId]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Tab } from '@headlessui/react';
import { generateProfile } from '@/lib/api';
import { DataProfile } from '@/types';
import DataSummaryCard from '@/components/DataSummaryCard';
import SessionInfo from '@/components/SessionInfo';
import DataTable from '@/components/DataTable';
import { toast } from 'react-toastify';

import { FiActivity, FiGrid, FiEdit, FiCheckCircle, FiDownload } from 'react-icons/fi';

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  
  const [profile, setProfile] = useState<DataProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);

  // Tab categories
  const tabs = [
    { name: 'Overview', icon: <FiActivity className="mr-2" /> },
    { name: 'Preview', icon: <FiGrid className="mr-2" /> },
    { name: 'Schema & Rules', icon: <FiEdit className="mr-2" /> },
    { name: 'Validate', icon: <FiCheckCircle className="mr-2" /> },
    { name: 'Export', icon: <FiDownload className="mr-2" /> },
  ];

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await generateProfile(sessionId);
        setProfile(data);
      } catch (error) {
        console.error('Failed to fetch data profile:', error);
        toast.error('Failed to load data profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <SessionInfo sessionId={sessionId} />
        </div>
        <div className="card p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Analyzing your data...</p>
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
          <p>Failed to load data profile. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <SessionInfo sessionId={sessionId} />
      </div>

      <DataSummaryCard profile={profile} />

      <div className="mb-6">
        <div className="bg-gray-100 rounded-lg p-1">
          <div className="grid grid-cols-5 gap-1">
            {tabs.map((tab, index) => (
              <button
                key={tab.name}
                className={`py-2 px-4 rounded-lg flex items-center justify-center font-medium text-sm ${
                  selectedTab === index
                    ? 'bg-white shadow text-primary-600'
                    : 'text-gray-600 hover:bg-white/50 hover:text-primary-500'
                }`}
                onClick={() => setSelectedTab(index)}
              >
                {tab.icon}
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card mb-6">
        {selectedTab === 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Column Analysis</h2>
            {/* Overview Content - Column Analysis Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NULL %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distinct %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sample Values</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {profile.columns_profile.map((column) => (
                    <tr key={column.name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium">{column.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{column.inferred_type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{column.null_pct.toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap">{column.distinct_pct.toFixed(1)}%</td>
                      <td className="px-6 py-4 max-w-xs truncate">
                        {column.samples.slice(0, 3).map((sample, i) => (
                          <span key={i} className="mr-1">
                            {sample !== null ? String(sample) : 'NULL'}
                            {i < 2 && column.samples.length > i + 1 ? ', ' : ''}
                          </span>
                        ))}
                        {column.samples.length > 3 && '...'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {column.issues && column.issues.length > 0 ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            {column.issues.length} issues
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedTab === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Data Preview</h2>
            {/* Data Preview - DataTable Component */}
            <DataTable 
              sessionId={sessionId} 
              columns={profile.columns_profile.map(col => col.name)} 
            />
          </div>
        )}

        {selectedTab === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Schema & Transformation Rules</h2>
            {/* Redirect to Schema page */}
            {(() => {
              router.push(`/dashboard/${sessionId}/schema`);
              return (
                <div className="p-8 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-r-transparent"></div>
                  <p className="mt-4 text-gray-600">Loading schema editor...</p>
                </div>
              );
            })()}
          </div>
        )}

        {selectedTab === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Validation & Dry Run</h2>
            {/* Redirect to Validate page */}
            {(() => {
              router.push(`/dashboard/${sessionId}/validate`);
              return (
                <div className="p-8 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-r-transparent"></div>
                  <p className="mt-4 text-gray-600">Loading validation tool...</p>
                </div>
              );
            })()}
          </div>
        )}

        {selectedTab === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Export & Generate SQL</h2>
            {/* Redirect to Export page */}
            {(() => {
              router.push(`/dashboard/${sessionId}/export`);
              return (
                <div className="p-8 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-r-transparent"></div>
                  <p className="mt-4 text-gray-600">Loading export options...</p>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}