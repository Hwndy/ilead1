import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChildrenOverview } from '@/components/parent/ChildrenOverview';
import { ParentAcademics } from '@/components/parent/ParentAcademics';
import { ParentAttendance } from '@/components/parent/ParentAttendance';
import { ParentFees } from '@/components/parent/ParentFees';
import { ParentAssignments } from '@/components/parent/ParentAssignments';
import { ParentLessonNotes } from '@/components/parent/ParentLessonNotes';
import { CommunicationHub } from '@/components/parent/CommunicationHub';
import { ParentMessagesInbox } from '@/components/parent/ParentMessagesInbox';
import { AcademicCalendar } from '@/components/parent/AcademicCalendar';
import { ParentReportCards } from '@/components/parent/ParentReportCards';
import { ParentProfileSettings } from '@/components/parent/ParentProfileSettings';
import { ChildProvider, useChildren } from '@/contexts/ChildContext';
import { ChildSelector } from '@/components/parent/ChildSelector';
import { useAuth } from '@/contexts/AuthContext';

const ParentDashboardInner: React.FC = () => {
  const { user } = useAuth();
  const { children, selectedChild } = useChildren();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'overview';

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <ChildrenOverview />;
      case 'academics': return <ParentAcademics />;
      case 'assignments': return <ParentAssignments />;
      case 'notes': return <ParentLessonNotes />;
      case 'report-cards': return <ParentReportCards onViewResults={() => {}} />;
      case 'attendance': return <ParentAttendance />;
      case 'fees': return <ParentFees />;
      case 'messages':
        return (
          <div className="space-y-6">
            <ParentMessagesInbox />
            <CommunicationHub />
          </div>
        );
      case 'calendar': return <AcademicCalendar />;
      case 'settings': return <ParentProfileSettings />;
      default: return <ChildrenOverview />;
    }
  };

  return (
    <DashboardLayout title="Parent Portal">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Parent Portal</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name}. {selectedChild ? `Viewing ${selectedChild.full_name}${selectedChild.class_name ? ` • ${selectedChild.class_name}` : ''}` : 'Link your child to get started.'}
            </p>
          </div>
          {children.length > 0 && <ChildSelector />}
        </div>

        <div className="bg-card rounded-xl border shadow-sm p-6">
          {renderContent()}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const ParentDashboard: React.FC = () => (
  <ChildProvider>
    <ParentDashboardInner />
  </ChildProvider>
);
