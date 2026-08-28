import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PWAProvider } from '@/contexts/PWAContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { SessionMonitor } from '@/components/security/SessionMonitor';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { StudentDashboard } from '@/pages/StudentDashboard';
import { TeacherDashboard } from '@/pages/TeacherDashboard';
import { ParentDashboard } from '@/pages/ParentDashboard';
import { AuthPage } from '@/pages/AuthPage';
import { ExamInstructionsPage } from '@/pages/ExamInstructionsPage';
import { ExamPage } from '@/pages/ExamPage';
import { ExamResultsPage } from '@/pages/ExamResultsPage';
import NotFound from '@/pages/NotFound';
import { WebsiteRouter } from '@/pages/website/WebsiteRouter';
import { TrackApplicationPage } from '@/pages/website/TrackApplicationPage';
import { AcceptOfferPage } from '@/pages/website/AcceptOfferPage';
import { PaymentCallbackPage } from '@/pages/website/PaymentCallbackPage';
import { InstallPage } from '@/pages/InstallPage';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { UpdateAvailable } from '@/components/pwa/UpdateAvailable';
import { FeePaymentCallback } from '@/pages/FeePaymentCallback';
import { ScanStation } from '@/components/attendance/ScanStation';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';

const queryClient = new QueryClient();

// Dashboard Router Component
const DashboardRouter = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Handle undefined role
  if (!user.role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Role Not Found</h1>
          <p className="text-muted-foreground">
            Your account role could not be determined. Please contact support.
          </p>
        </div>
      </div>
    );
  }
  
  switch (user.role) {
    case 'student':
      return <StudentDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'admin':
      return <AdminDashboard />;
    case 'parent':
      return <ParentDashboard />;
    default:
      console.error('Unknown user role:', user.role);
      return <Navigate to="/login" replace />;
  }
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <PWAProvider>
              <BrowserRouter>
                <SessionMonitor>
                  {/* PWA Components */}
                  <OfflineIndicator />
                  <InstallPrompt />
                  <UpdateAvailable />
                  
                  <Routes>
                    {/* Redirect root to dashboard */}
                    <Route path="/" element={<Navigate to="/website" replace />} />
                    
                    {/* Login route */}
                    <Route path="/login" element={<AuthPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route
                      path="/fees/payment-callback"
                      element={<ProtectedRoute allowedRoles={['parent']}><FeePaymentCallback /></ProtectedRoute>}
                    />
                    
                    {/* Install page for PWA */}
                    <Route path="/install" element={<InstallPage />} />

                    {/* QR scan landing — requires teacher/admin login */}
                    <Route
                      path="/scan/:token"
                      element={
                        <ProtectedRoute allowedRoles={['admin','teacher']}>
                          <div className="p-6"><ScanStation /></div>
                        </ProtectedRoute>
                      }
                    />
                    
                    {/* Protected dashboard routes */}
                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <DashboardRouter />
                        </ProtectedRoute>
                      }
                    />
                  
                  {/* Role-specific routes */}
                  <Route
                    path="/student/*"
                    element={
                      <ProtectedRoute allowedRoles={['student']}>
                        <StudentDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/teacher/*"
                    element={
                      <ProtectedRoute allowedRoles={['teacher']}>
                        <TeacherDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/*"
                    element={
                      <ProtectedRoute allowedRoles={['admin']}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Exam route with instructions and results */}
                  <Route
                    path="/exam/instructions/:examId"
                    element={
                      <ProtectedRoute allowedRoles={['student']}>
                        <ExamInstructionsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/exam"
                    element={
                      <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
                        <ExamPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/exam/results/:sessionId"
                    element={
                      <ProtectedRoute allowedRoles={['student']}>
                        <ExamResultsPage />
                      </ProtectedRoute>
                    }
                  />
                  
                  {/* Website routes - publicly accessible */}
                  <Route path="/website/*" element={<WebsiteRouter />} />
                  <Route path="/track-application" element={<TrackApplicationPage />} />
                  <Route path="/accept-offer/:token" element={<AcceptOfferPage />} />
                  <Route path="/payment-callback" element={<PaymentCallbackPage />} />
                  
                  {/* Redirect old super-admin route to dashboard */}
                  <Route path="/super-admin" element={<Navigate to="/dashboard" replace />} />
                  
                  {/* Catch-all route */}
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </SessionMonitor>
              </BrowserRouter>
          </PWAProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
