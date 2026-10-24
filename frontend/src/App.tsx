import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { Cpu, LayoutDashboard, LogIn, LogOut } from 'lucide-react';
import { BlueprintEditor } from './components/editor/BlueprintEditor';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Dashboard } from './pages/Dashboard';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

const Navbar = () => {
  const { isAuthenticated, logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
      <Link to="/dashboard" className="flex items-center gap-2 font-bold text-blue-700 text-lg">
        <Cpu size={22} className="text-blue-600" />
        CivilBlueprint AI
      </Link>
      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors"
            >
              <LayoutDashboard size={16} /> Dashboard
            </Link>
            <span className="text-gray-300 text-sm">|</span>
            <span className="text-sm text-gray-500 hidden sm:block">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors ml-1"
            >
              <LogOut size={16} /> Logout
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-md transition-colors"
          >
            <LogIn size={16} /> Sign In
          </Link>
        )}
      </div>
    </nav>
  );
};


const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
          <Navbar />
          <div className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/blueprints/:id/editor" element={<ProtectedRoute><BlueprintEditor /></ProtectedRoute>} />
            </Routes>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
