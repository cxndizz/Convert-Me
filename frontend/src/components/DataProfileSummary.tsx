import { useState } from 'react';
import { ProfileResponse, ColumnProfile } from '@/lib/api';

interface DataProfileSummaryProps {
  profile: ProfileResponse;
}

export default function DataProfileSummary({ profile }: DataProfileSummaryProps) {
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  
  // เรียงลำดับคอลัมน์ที่มีปัญหาขึ้นมาก่อน
  const sortedColumns = [...profile.columns_profile].sort((a, b) => 
    (b.issues.length - a.issues.length) || (b.null_pct - a.null_pct)
  );
  
  const toggleColumn = (columnName: string) => {
    if (expandedColumn === columnName) {
      setExpandedColumn(null);
    } else {
      setExpandedColumn(columnName);
    }
  };
  
  // ฟังก์ชันแปลง data type เป็นข้อความที่อ่านง่าย
  const formatDataType = (type: string) => {
    switch (type) {
      case 'INTEGER': return 'Integer';
      case 'FLOAT': return 'Float';
      case 'BOOLEAN': return 'Boolean';
      case 'DATE': return 'Date';
      case 'TIMESTAMP': return 'Timestamp';
      case 'STRING': return 'String';
      default: return type;
    }
  };
  
  // ฟังก์ชันแสดงข้อความสำหรับปัญหาที่พบ
  const getIssueDescription = (issue: string) => {
    switch (issue) {
      case 'high_null_percentage': return 'High null percentage (>20%)';
      case 'high_cardinality': return 'High cardinality (might be an ID column)';
      case 'low_cardinality': return 'Low cardinality (might be categorical)';
      case 'high_variance': return 'High variance in data';
      case 'possible_outliers': return 'Contains possible outliers';
      case 'mixed_numeric_formats': return 'Mixed numeric formats';
      case 'mixed_date_formats': return 'Mixed date formats';
      default: return issue;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Overview summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Profile Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm text-gray-500">Rows</h3>
            <p className="text-2xl font-bold">{profile.row_count.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm text-gray-500">Columns</h3>
            <p className="text-2xl font-bold">{profile.column_count}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm text-gray-500">File Type</h3>
            <p className="text-xl font-bold">{profile.file_extension.toUpperCase().replace('.', '')}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-sm text-gray-500">Encoding</h3>
            <p className="text-xl font-bold">{profile.encoding}</p>
          </div>
        </div>
        
        {/* Additional file info */}
        <div className="mt-4 text-sm text-gray-600">
          <p><span className="font-semibold">File name:</span> {profile.file_name}</p>
          {profile.delimiter && (
            <p><span className="font-semibold">Delimiter:</span> {profile.delimiter === '\t' ? 'Tab' : profile.delimiter}</p>
          )}
          {profile.header_detected !== undefined && (
            <p><span className="font-semibold">Header detected:</span> {profile.header_detected ? 'Yes' : 'No'}</p>
          )}
        </div>
      </div>
      
      {/* Issues summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Data Quality Summary</h2>
        
        {/* Count columns with issues */}
        {(() => {
          const columnsWithIssues = profile.columns_profile.filter(c => c.issues.length > 0);
          const columnsWithNulls = profile.columns_profile.filter(c => c.null_count > 0);
          
          return (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className={`p-4 rounded-lg ${columnsWithIssues.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <h3 className="text-sm text-gray-500">Columns with Issues</h3>
                <p className="text-2xl font-bold">{columnsWithIssues.length} / {profile.column_count}</p>
              </div>
              <div className={`p-4 rounded-lg ${columnsWithNulls.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                <h3 className="text-sm text-gray-500">Columns with Nulls</h3>
                <p className="text-2xl font-bold">{columnsWithNulls.length} / {profile.column_count}</p>
              </div>
            </div>
          );
        })()}
        
        {/* Top issues */}
        <div>
          <h3 className="font-medium mb-2">Columns with most issues:</h3>
          <ul className="space-y-2">
            {sortedColumns.filter(col => col.issues.length > 0).slice(0, 3).map(col => (
              <li key={col.name} className="bg-red-50 p-3 rounded">
                <div className="flex justify-between">
                  <span className="font-medium">{col.name}</span>
                  <span className="text-gray-500 text-sm">{col.issues.length} issues</span>
                </div>
                <ul className="mt-1 text-sm text-red-700">
                  {col.issues.map(issue => (
                    <li key={issue}>• {getIssueDescription(issue)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          
          {sortedColumns.filter(col => col.issues.length > 0).length === 0 && (
            <p className="text-green-600">No issues detected!</p>
          )}
        </div>
      </div>
      
      {/* Columns detail */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Column Details</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nulls</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distinct</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {profile.columns_profile.map(column => (
                <>
                  <tr key={column.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{column.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatDataType(column.inferred_type)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="mr-2">{column.null_pct.toFixed(1)}%</div>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${column.null_pct > 20 ? 'bg-red-500' : 'bg-blue-500'}`} 
                            style={{ width: `${Math.min(100, column.null_pct)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="mr-2">{column.distinct_pct.toFixed(1)}%</div>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-green-500" 
                            style={{ width: `${Math.min(100, column.distinct_pct)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {column.issues.length > 0 ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          {column.issues.length} issues
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                      <button 
                        onClick={() => toggleColumn(column.name)} 
                        className="hover:underline"
                      >
                        {expandedColumn === column.name ? 'Collapse' : 'Expand'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded view */}
                  {expandedColumn === column.name && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Statistics */}
                          <div>
                            <h4 className="font-medium mb-2">Statistics</h4>
                            <div className="space-y-1 text-sm">
                              {column.min !== undefined && (
                                <p><span className="font-medium">Min:</span> {column.min}</p>
                              )}
                              {column.max !== undefined && (
                                <p><span className="font-medium">Max:</span> {column.max}</p>
                              )}
                              {column.mean !== undefined && (
                                <p><span className="font-medium">Mean:</span> {column.mean.toFixed(2)}</p>
                              )}
                              {column.median !== undefined && (
                                <p><span className="font-medium">Median:</span> {column.median.toFixed(2)}</p>
                              )}
                              {column.std_dev !== undefined && (
                                <p><span className="font-medium">Std. Dev:</span> {column.std_dev.toFixed(2)}</p>
                              )}
                              {column.avg_length !== undefined && (
                                <p><span className="font-medium">Avg. Length:</span> {column.avg_length.toFixed(1)} chars</p>
                              )}
                              {column.max_length !== undefined && (
                                <p><span className="font-medium">Max Length:</span> {column.max_length} chars</p>
                              )}
                            </div>
                          </div>
                          
                          {/* Sample values */}
                          <div>
                            <h4 className="font-medium mb-2">Sample Values</h4>
                            <div className="flex flex-wrap gap-2">
                              {column.sample_values.map((value, index) => (
                                <div key={index} className="bg-white border px-2 py-1 rounded text-sm">
                                  {value === null ? '<NULL>' : String(value)}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Issues */}
                          {column.issues.length > 0 && (
                            <div className="md:col-span-2 mt-2">
                              <h4 className="font-medium mb-2 text-red-700">Issues</h4>
                              <ul className="space-y-1 text-sm">
                                {column.issues.map(issue => (
                                  <li key={issue} className="text-red-700">
                                    • {getIssueDescription(issue)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}