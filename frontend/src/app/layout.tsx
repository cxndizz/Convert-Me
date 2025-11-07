import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Data Transform App',
  description: 'Upload, transform, and export data files with ease',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastContainer position="top-right" autoClose={5000} />
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="text-xl font-semibold text-primary-600">Data Transform App</h1>
              <div>
                {/* Session info could go here */}
              </div>
            </div>
          </header>
          <main className="container mx-auto px-4 py-6">
            {children}
          </main>
          <footer className="bg-white shadow-inner py-4">
            <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} Data Transform App
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}