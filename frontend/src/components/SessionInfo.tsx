'use client';

import { useState, useEffect } from 'react';
import { deleteSession } from '@/lib/api';
import { FiClock, FiTrash, FiAlertTriangle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';

interface SessionInfoProps {
  sessionId: string;
  ttl?: number; // TTL in seconds
  createdAt?: string;
}

export default function SessionInfo({ 
  sessionId, 
  ttl = 3600, // Default to 1 hour
  createdAt = new Date().toISOString()
}: SessionInfoProps) {
  const router = useRouter();
  const [timeRemaining, setTimeRemaining] = useState<number>(ttl);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  // Calculate time remaining
  useEffect(() => {
    const createdTime = new Date(createdAt).getTime();
    const expiryTime = createdTime + (ttl * 1000);
    
    const calculateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000));
      setTimeRemaining(remaining);
      
      // Warn if less than 5 minutes remaining
      if (remaining === 300) { // 5 minutes
        toast.warn('Session expires in 5 minutes. Please complete your work.', {
          autoClose: false,
        });
      }
      
      // Session expired
      if (remaining === 0) {
        toast.error('Session has expired. Redirecting to home page.', {
          onClose: () => router.push('/'),
        });
      }
    };
    
    calculateRemaining();
    const interval = setInterval(calculateRemaining, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [sessionId, ttl, createdAt, router]);

  const handleClearSession = async () => {
    try {
      await deleteSession(sessionId);
      toast.success('Session cleared successfully');
      router.push('/');
    } catch (error) {
      console.error('Failed to clear session:', error);
      toast.error('Failed to clear session. Please try again.');
    }
  };

  // Format time remaining as HH:MM:SS
  const formatTimeRemaining = () => {
    const hours = Math.floor(timeRemaining / 3600);
    const minutes = Math.floor((timeRemaining % 3600) / 60);
    
    return `${hours}h ${minutes}m`;
  };

  // Determine warning level based on time remaining
  const getTimeClass = () => {
    if (timeRemaining < 300) return 'text-red-600'; // Less than 5 minutes
    if (timeRemaining < 900) return 'text-orange-600'; // Less than 15 minutes
    return 'text-gray-600';
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg text-sm">
      <div className="flex items-center">
        <FiClock className={`mr-2 ${getTimeClass()}`} />
        <span>
          Session ID: <span className="font-mono">{sessionId.substring(0, 8)}...</span> | 
          Expires in: <span className={`font-medium ${getTimeClass()}`}>{formatTimeRemaining()}</span>
        </span>
      </div>

      {showClearConfirm ? (
        <div className="flex items-center space-x-2">
          <FiAlertTriangle className="text-red-500" />
          <span className="text-red-600">Clear session?</span>
          <button
            className="px-2 py-1 bg-red-600 text-white rounded-md text-xs hover:bg-red-700"
            onClick={handleClearSession}
          >
            Yes
          </button>
          <button
            className="px-2 py-1 bg-gray-200 text-gray-800 rounded-md text-xs hover:bg-gray-300"
            onClick={() => setShowClearConfirm(false)}
          >
            No
          </button>
        </div>
      ) : (
        <button
          className="flex items-center text-gray-700 hover:text-red-600 transition-colors"
          onClick={() => setShowClearConfirm(true)}
        >
          <FiTrash className="mr-1" />
          Clear Session
        </button>
      )}
    </div>
  );
}