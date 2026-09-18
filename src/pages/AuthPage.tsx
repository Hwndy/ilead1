import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type AuthMode = 'login' | 'register' | 'forgot-password';

export const AuthPage = () => {
  const initialMode = new URLSearchParams(window.location.search).get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [preselectedRole, setPreselectedRole] = useState<'parent' | 'teacher' | 'student' | undefined>();
  const [allowStudentRegistration, setAllowStudentRegistration] = useState(true);
  const { isAuthenticated, user, isLoading, logout } = useAuth();
  
  // Check if user came from portal and needs forced login
  const searchParams = new URLSearchParams(window.location.search);
  const isPortalAccess = searchParams.get('portal') === 'true';
  const requestedRole = searchParams.get('role');
  const urlRole =
    requestedRole === 'parent' || requestedRole === 'teacher' || requestedRole === 'student'
      ? (requestedRole as 'parent' | 'teacher' | 'student')
      : undefined;
  const registerRole = preselectedRole ?? urlRole;

  useEffect(() => {
    // Fetch app settings to check if student registration is allowed
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'allow_student_registration')
        .single();
      
      if (data) {
        setAllowStudentRegistration(data.setting_value === true);
      }
    };

    fetchSettings();
  }, []);

  // Handle portal access - force logout if coming from portal
  React.useEffect(() => {
    if (isPortalAccess && isAuthenticated) {
      logout();
    }
  }, [isPortalAccess, isAuthenticated, logout]);

  // Redirect authenticated users to their dashboard (only if not from portal)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't auto-redirect if user came from portal - force them to login
  if (isAuthenticated && user && !isPortalAccess) {
    switch (user.role) {
      case 'student':
        return <Navigate to="/dashboard" replace />;
      case 'teacher':
        return <Navigate to="/dashboard" replace />;
      case 'admin':
        return <Navigate to="/dashboard" replace />;
      default:
        return <Navigate to="/dashboard" replace />;
    }
  }

  const renderForm = () => {
    switch (mode) {
      case 'login':
        return (
          <>
            <LoginForm 
              onToggleMode={() => setMode('register')}
              onForgotPassword={() => setMode('forgot-password')}
            />
            <div className="mt-4 rounded-lg border bg-card/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Are you a parent? Create an account to follow your children's progress and pay fees.
              </p>
              <button
                type="button"
                className="mt-1 text-sm font-medium text-primary hover:underline"
                onClick={() => {
                  setPreselectedRole('parent');
                  setMode('register');
                }}
              >
                Create a parent account
              </button>
            </div>
          </>
        );
      case 'register':
        return (
          <RegisterForm 
            onToggleMode={() => {
              setPreselectedRole(undefined);
              setMode('login');
            }}
            initialRole={registerRole}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordForm 
            onToggleMode={() => setMode('login')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="brand-arch flex min-h-screen items-center justify-center overflow-hidden bg-primary p-4">
      <div className="relative z-10 w-full max-w-md">
        {isPortalAccess && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <p className="text-sm text-primary text-center">
              Please sign in to access your {requestedRole || 'portal'}
            </p>
          </div>
        )}
        {renderForm()}
      </div>
    </div>
  );
};