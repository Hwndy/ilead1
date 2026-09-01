import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SchoolInfoEditor } from '@/components/admin/CMS/SchoolInfoEditor';
import { SiteSettingsEditor } from '@/components/admin/CMS/SiteSettingsEditor';
import { StaffAttendance } from '@/components/admin/StaffAttendance';
import { GradingScaleEditor } from '@/components/admin/GradingScaleEditor';
import { AdmissionSettingsEditor } from '@/components/admin/AdmissionSettingsEditor';
import { School, Globe, Users, GraduationCap, Receipt } from 'lucide-react';

/**
 * Admin Settings hub  brings school profile, website settings and staff HR-facing
 * config into one place so admins don't need to hunt around the sidebar.
 */
export const SettingsHub: React.FC = () => {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">School profile, website branding and operational defaults.</p>
      <Tabs defaultValue="school" className="space-y-4">
        <TabsList>
          <TabsTrigger value="school">School Info</TabsTrigger>
          <TabsTrigger value="site">Website</TabsTrigger>
          <TabsTrigger value="staff-attendance">Staff Attendance</TabsTrigger>
          <TabsTrigger value="grading">Grading Scale</TabsTrigger>
          <TabsTrigger value="admissions">Admissions</TabsTrigger>
        </TabsList>
        <TabsContent value="school"><SchoolInfoEditor /></TabsContent>
        <TabsContent value="site"><SiteSettingsEditor /></TabsContent>
        <TabsContent value="staff-attendance"><StaffAttendance /></TabsContent>
        <TabsContent value="grading"><GradingScaleEditor /></TabsContent>
        <TabsContent value="admissions"><AdmissionSettingsEditor /></TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsHub;