import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center bg-white rounded-2xl p-8 shadow-2xl">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
          <Cpu size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Registration Disabled</h2>
        <p className="text-sm text-gray-600 mb-4">
          Public registration is disabled. Only single-user administrative sign-in is allowed.
        </p>
        <p className="text-xs text-blue-600 font-medium">Redirecting to login...</p>
      </div>
    </div>
  );
};
