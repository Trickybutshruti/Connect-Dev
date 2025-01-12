import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import LandingPage from './pages/LandingPage';
import DeveloperDashboard from './pages/DeveloperDashboard';
import ClientDashboard from './pages/ClientDashboard';
import ProfilePage from './pages/ProfilePage';
import VideoCall from './pages/VideoCall';
import Navbar from './components/Navbar';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(userRole || '')) {
    return <Navigate to={`/${userRole}-dashboard`} replace />;
  }

  return <>{children}</>;
};

// Wrapper component to handle redirections
const AuthRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const location = window.location.pathname;

  useEffect(() => {
    const checkNewUser = async () => {
      if (user && userRole === 'developer' && location !== '/profile') {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().isNewUser) {
          navigate('/profile');
        }
      }
    };

    checkNewUser();
  }, [user, userRole, navigate, location]);

  return <>{children}</>;
};

// Layout component to wrap all pages
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = window.location.pathname;
  const showNavbar = user || location === '/signin' || location === '/signup';

  return (
    <div className="min-h-screen bg-gray-50">
      {showNavbar && <Navbar />}
      <main className="pt-4">{children}</main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AuthRedirect>
          <Layout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route 
                path="/developer-dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['developer']}>
                    <DeveloperDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/client-dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['client']}>
                    <ClientDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute allowedRoles={['developer', 'client']}>
                    <ProfilePage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/video-call/:callId" 
                element={
                  <ProtectedRoute allowedRoles={['developer', 'client']}>
                    <VideoCall />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </Layout>
        </AuthRedirect>
      </AuthProvider>
    </Router>
  );
}

export default App;