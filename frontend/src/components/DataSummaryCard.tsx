'use client';

import { DataProfile } from '@/types';
import { formatPercentage } from '@/lib/utils';
import { FiInfo, FiAlertTriangle, FiDatabase, FiColumns } from 'react-icons/fi';

interface DataSummaryCardProps {
  profile: DataProfile;
}

export default function DataSummaryCard({ profile }: DataSummaryCardProps) {
  // Calculate summary stats
  const highestNullColumn = profile.columns_profile.reduce(
    (prev, curr) => (curr.null_pct > prev.null_pct ? curr : prev),
    { name: 'None', null_pct: 0 } as any
  );

  const columnsWithIssues = profile.columns_profile.filter(col => 
    col.issues && col.issues.length > 0
  ).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Row Count */}
      <div className="card flex items-center p-4">
        <div className="rounded-full bg-blue-100 p-3 mr-4">
          <FiDatabase className="text-blue-600 text-xl" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Rows</h3>
          <p className="text-2xl font-semibold">{profile.rows.toLocaleString()}</p>
        </div>
      </div>

      {/* Column Count */}
      <div className="card flex items-center p-4">
        <div className="rounded-full bg-green-100 p-3 mr-4">
          <FiColumns className="text-green-600 text-xl" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Columns</h3>
          <p className="text-2xl font-semibold">{profile.columns.toLocaleString()}</p>
        </div>
      </div>

      {/* Highest NULL % */}
      <div className="card flex items-center p-4">
        <div className="rounded-full bg-yellow-100 p-3 mr-4">
          <FiInfo className="text-yellow-600 text-xl" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Highest NULL %</h3>
          <p className="text-2xl font-semibold">{formatPercentage(highestNullColumn.null_pct)}</p>
          <p className="text-xs text-gray-500">Column: {highestNullColumn.name}</p>
        </div>
      </div>

      {/* Columns with Issues */}
      <div className="card flex items-center p-4">
        <div className="rounded-full bg-red-100 p-3 mr-4">
          <FiAlertTriangle className="text-red-600 text-xl" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-500">Columns with Issues</h3>
          <p className="text-2xl font-semibold">{columnsWithIssues}</p>
          <p className="text-xs text-gray-500">
            {columnsWithIssues > 0 
              ? 'Requires attention' 
              : 'No issues detected'}
          </p>
        </div>
      </div>
    </div>
  );
}