import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, LayoutDashboard, BookOpen, Users, FileText, ClipboardCheck, Calculator, Calendar, ClipboardList, NotebookPen, Library, Trophy, Clock, TrendingUp, MessageSquare, Settings, CreditCard } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { useIsMobile } from '@/hooks/use-mobile';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { NavSidebar, NavSection } from './NavSidebar';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
}) => {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();

  const getNavSections = (): NavSection[] => {
    switch (user?.role) {
      case 'teacher':
        return [
          {
            label: "Overview",
            items: [{ title: "Dashboard", icon: LayoutDashboard, tab: "exams" }]
          },
          {
            label: "Academics",
            items: [
              { title: "Students", icon: Users, tab: "students-list" },
              { title: "Student Results", icon: Trophy, tab: "results" },
              { title: "Timetable", icon: Calendar, tab: "timetable" },
              { title: "Attendance", icon: ClipboardCheck, tab: "attendance" },
            ]
          },
          {
            label: "Management",
            items: [
              { title: "Results Management", icon: Calculator, tab: "results-mgmt" },
              { title: "Assignments", icon: FileText, tab: "assignments-mgr" },
              { title: "Lesson Notes", icon: NotebookPen, tab: "lesson-notes" },
            ]
          },
          {
            label: "Personal",
            items: [
              { title: "Leave Requests", icon: Clock, tab: "leave" },
              { title: "My Profile", icon: Settings, tab: "profile" },
            ]
          }
        ];
      case 'student':
        return [
          {
            label: "Academics",
            items: [
              { title: "Exams", icon: BookOpen, tab: "exams" },
              { title: "Timetable", icon: Calendar, tab: "timetable" },
              { title: "Library", icon: Library, tab: "library" },
            ]
          },
          {
            label: "Learning",
            items: [
              { title: "Assignments", icon: FileText, tab: "assignments" },
              { title: "Lesson Notes", icon: NotebookPen, tab: "notes" },
            ]
          },
          {
            label: "Progress",
            items: [
              { title: "Report Cards", icon: Trophy, tab: "report-cards" },
            ]
          }
        ];
      case 'parent':
        return [
          {
            label: "Overview",
            items: [{ title: "Dashboard", icon: LayoutDashboard, tab: "overview" }]
          },
          {
            label: "Academics",
            items: [
              { title: "Academics", icon: BookOpen, tab: "academics" },
              { title: "Assignments", icon: FileText, tab: "assignments" },
              { title: "Lesson Notes", icon: NotebookPen, tab: "notes" },
              { title: "Report Cards", icon: Trophy, tab: "report-cards" },
            ]
          },
          {
            label: "Welfare",
            items: [
              { title: "Attendance", icon: ClipboardCheck, tab: "attendance" },
              { title: "Fees", icon: CreditCard, tab: "fees" },
              { title: "Calendar", icon: Calendar, tab: "calendar" },
            ]
          },
          {
            label: "Personal",
            items: [
              { title: "Messages", icon: MessageSquare, tab: "messages" },
              { title: "Settings", icon: Settings, tab: "settings" },
            ]
          }
        ];
      default:
        return [];
    }
  };

  const basePath = `/${user?.role}`;
  const sections = getNavSections();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <NavSidebar sections={sections} role={user?.role || ''} basePath={basePath} />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="flex h-20 items-center justify-between gap-3 px-4 lg:px-8">
              <div className="flex items-center gap-3 min-w-0">
                <SidebarTrigger />
                <Logo size="sm" showText={false} className="hidden sm:flex shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground truncate">
                    {user?.role} Portal
                  </p>
                  <h1 className="text-lg font-semibold leading-tight truncate">{title}</h1>
                </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                {!isMobile && (
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium text-foreground">{user?.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user?.role} {user?.class && `• ${user.class}`}
                    </p>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto bg-background p-4 lg:p-8">
            <div className="mx-auto max-w-[1600px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
