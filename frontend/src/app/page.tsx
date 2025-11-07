'use client';

import FileUpload from '@/components/FileUpload';

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Data Transformation Tool
        </h1>
        <p className="text-lg text-gray-600">
          Upload your data files, transform them, and export to your desired format
        </p>
      </div>
      
      <FileUpload />
      
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="text-center p-4">
            <div className="bg-blue-100 text-blue-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              1
            </div>
            <h3 className="text-lg font-medium mb-2">Upload</h3>
            <p className="text-gray-600">
              Upload your CSV, Excel, TXT, or SQL files for processing
            </p>
          </div>
        </div>
        
        <div className="card">
          <div className="text-center p-4">
            <div className="bg-green-100 text-green-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              2
            </div>
            <h3 className="text-lg font-medium mb-2">Transform</h3>
            <p className="text-gray-600">
              Set data types, validate, clean, and standardize your data
            </p>
          </div>
        </div>
        
        <div className="card">
          <div className="text-center p-4">
            <div className="bg-purple-100 text-purple-600 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
              3
            </div>
            <h3 className="text-lg font-medium mb-2">Export</h3>
            <p className="text-gray-600">
              Export as CSV, Excel, Parquet, or generate SQL statements
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}