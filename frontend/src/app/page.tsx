import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-6">DataMap MVP</h1>
        <p className="text-gray-600 mb-8 text-center">
          A tool for transforming and mapping data files without permanent storage
        </p>
        <div className="space-y-4">
          <Link 
            href="/upload" 
            className="w-full block text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg"
          >
            Upload File
          </Link>
          
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h2 className="text-lg font-semibold mb-2">Supported File Types</h2>
            <ul className="text-gray-600 space-y-1 ml-5 list-disc">
              <li>CSV (.csv)</li>
              <li>Text (.txt)</li>
              <li>Excel (.xls, .xlsx)</li>
              <li>SQL (.sql)</li>
            </ul>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
            <p className="font-semibold">Session Information:</p>
            <p className="mt-1">All data is temporary and will be automatically deleted after 60 minutes of inactivity.</p>
          </div>
        </div>
      </div>
    </div>
  );
}