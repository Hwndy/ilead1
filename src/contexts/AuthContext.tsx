import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_PROJECT_REF } from '@/integrations/supabase/client';
import { User, AuthState, LoginCredentials } from '@/types/auth';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  mustChangePassword: boolean;
  setMustChangePassword: (v: boolean) => void;
  register: (userData: { 
    email: string; 
    password: string; 
    fullName: string; 
    role?: string;
    classId?: string;
    classIds?: string[];
    subjectIds?: string[];
    phone?: string;
  }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Sprint E: idle timeout  auto sign-out after 30 min of inactivity.
  useEffect(() => {
    if (!session) return;
    const IDLE_MS = 30 * 60 * 1000;
    let timer: number | undefined;
    const bump = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        supabase.auth.signOut().catch(() => {});
      }, IDLE_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    bump();
    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [session]);

  useEffect(() => {
    let mounted = true;

    // Safety net: never leave the app stuck on a full-screen spinner.
    const failsafe = window.setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 8000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        
        if (!mounted) return;
        
        setSession(session);
        
        if (session?.user) {
          // Fetch user profile and role from database asynchronously
          setTimeout(async () => {
            if (!mounted) return;
            
            try {
              console.log('🔍 Fetching profile and role for user:', session.user.id);
              
              // Fetch profile from profiles table
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .maybeSingle();
              
              if (!mounted) return;
              
              if (profileError) {
                console.error('❌ Profile fetch error:', profileError);
              } else {
                console.log('✅ Profile fetched:', profile);
              }
              
              // Fetch role from user_roles table (tolerate duplicates)
              const { data: roleRows, error: roleError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .limit(5);
              const roleData = roleRows?.[0] ?? null;
              
              if (!mounted) return;
              
              if (roleError) {
                console.error('❌ Role fetch error:', roleError);
              } else {
                console.log('✅ Role fetched:', roleData);
              }
              
               if (roleError || !roleData?.role) {
                 console.error('Account setup is incomplete: no role is assigned');
                 setUser(null);
                 return;
               }

               const userRole = roleData.role;
              console.log('📝 Final role assigned:', userRole);
              
              setMustChangePassword(Boolean((profile as any)?.must_change_password));

              // Create user object
              const userObject = {
                id: session.user.id,
                email: session.user.email!,
                name: profile?.full_name || session.user.email!,
                role: userRole as 'admin' | 'teacher' | 'student' | 'parent',
                createdAt: profile?.created_at || new Date().toISOString(),
              };
              
              console.log('👤 User object created:', userObject);
              setUser(userObject);
              
            } catch (error) {
              console.error('❌ Auth state change error:', error);
              if (mounted) setUser(null);
            } finally {
              if (mounted) setIsLoading(false);
            }
          }, 0);
        } else {
          setUser(null);
          setMustChangePassword(false);
          setIsLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      if (!session) {
        setIsLoading(false);
      }
      // If there's a session, the onAuthStateChange will handle it
    });

    return () => {
      mounted = false;
      window.clearTimeout(failsafe);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    console.log('Login attempt for:', credentials.email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      console.log('Login error:', error.message);
      setIsLoading(false);
      throw new Error(error.message);
    }

    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .limit(5);
    if (roleError || !roles?.[0]?.role) {
      await supabase.auth.signOut();
      setIsLoading(false);
      throw new Error('Your account setup is incomplete. Please contact the school administrator.');
    }

    // Sprint E: force password change on first login for admin-provisioned accounts.
    const { data: prof } = await supabase
      .from('profiles')
      .select('must_change_password')
      .eq('user_id', data.user.id)
      .maybeSingle();
    setMustChangePassword(Boolean(prof?.must_change_password));

    console.log('Login successful, waiting for auth state change...');
    setIsLoading(false);
  };

  const register = async (userData: {
    email: string;
    password: string;
    fullName: string;
    role?: string;
    classId?: string;
    classIds?: string[];
    subjectIds?: string[];
    phone?: string;
  }) => {
    setIsLoading(true);
    
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: userData.fullName,
          role: userData.role || 'student',
          class_id: userData.classId,
          subject_ids: userData.subjectIds,
          phone: userData.phone,
        }
      }
    });

    if (error) {
      setIsLoading(false);
      throw new Error(error.message);
    }

    // Handle class and subject assignments after user creation
    if (data.user && userData.role === 'student' && userData.classId) {
      try {
        await supabase.from('class_assignments').insert({
          student_id: data.user.id,
          class_id: userData.classId
        });
      } catch (assignmentError) {
        console.error('Error assigning class:', assignmentError);
      }
    }

    if (data.user && userData.role === 'teacher') {
      try {
        console.log('🎓 Creating teacher account:', {
          email: userData.email,
          subjects: userData.subjectIds?.length || 0,
          classes: userData.classIds?.length || 0
        });

        // Create subject assignments for EACH combination of subject and class
        if (userData.subjectIds?.length && userData.classIds?.length) {
          const subjectAssignments = [];
          
          // For each class the teacher is assigned to
          for (const classId of userData.classIds) {
            // Create an assignment for each subject they teach to that class
            for (const subjectId of userData.subjectIds) {
              subjectAssignments.push({
                user_id: data.user.id,
                subject_id: subjectId,
                class_id: classId
              });
            }
          }
          
          console.log('✅ Subject assignments to create:', subjectAssignments.length);
          await supabase.from('subject_assignments').insert(subjectAssignments);
        }
        
        // Handle teacher class assignments using RPC function to bypass RLS
        if (userData.classIds?.length) {
          console.log('✅ Creating class assignments via RPC:', userData.classIds.length);
          
          const { error: classError } = await supabase
            .rpc('create_teacher_class_assignments', {
              p_teacher_id: data.user!.id,
              p_class_ids: userData.classIds
            });
            
          if (classError) {
            console.error('❌ Class assignment error:', classError);
            throw classError;
          }
          
          console.log('✅ Class assignments created successfully');
        }
      } catch (assignmentError) {
        console.error('❌ Error assigning subjects/classes:', assignmentError);
      }
    }
    if (data.user && userData.role === 'parent') {
      const { data: parentRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .eq('role', 'parent')
        .maybeSingle();
      if (roleError || !parentRole) {
        setIsLoading(false);
        throw new Error('Your parent profile could not be prepared. Please contact the school administrator.');
      }
    }
    setIsLoading(false);
  };

  const logout = async () => {
    try {
      console.log('Logout attempt...');
      
      // Clear localStorage items that might persist session data
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem(`sb-${SUPABASE_PROJECT_REF}-auth-token`);

      
      // Check if we have a session before attempting logout
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('No active session found, clearing state');
        setUser(null);
        setSession(null);
        return;
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.log('Logout error:', error.message);
      }
      
      // Always clear state after logout attempt
      setUser(null);
      setSession(null);
      setMustChangePassword(false);
      
      console.log('Logout successful, state cleared');
    } catch (error: any) {
      console.log('Logout error:', error.message);
      // Always clear state on error to prevent stuck state
      setUser(null);
      setSession(null);
      setMustChangePassword(false);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const value: AuthContextType = {
    user,
    token: session?.access_token || null,
    isAuthenticated: !!session && !!user,
    isLoading,
    login,
    logout,
    register,
    resetPassword,
    mustChangePassword,
    setMustChangePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};