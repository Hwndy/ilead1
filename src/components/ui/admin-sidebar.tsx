import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  GraduationCap,
  ChevronDown,
  Globe,
  CreditCard,
  Library,
  Bell,
  CreditCard as IdCard,
  ClipboardList,
  Heart,
  ScanLine,
} from "lucide-react";
import { BarChart3, Bus, Package, Briefcase, ServerCog, BedDouble } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type NavLeaf = { title: string; tab: string; subtab?: string };
export type NavItem = {
  id: string;
  title: string;
  icon: any;
  tab: string;
  subtab?: string;
  children?: NavLeaf[];
};
export type NavSection = { label: string; items: NavItem[] };

/** Grouped admin navigation. Every entry keeps its original ?tab=&subtab= URL. */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { id: "overview", title: "Dashboard", icon: LayoutDashboard, tab: "overview" },
    ],
  },
  {
    label: "Admissions",
    items: [
      { id: "admissions", title: "Admissions", icon: GraduationCap, tab: "admissions", subtab: "applications" },
    ],
  },
  {
    label: "Academics",
    items: [
      { id: "students", title: "Students", icon: Users, tab: "academic", subtab: "students" },
      {
        id: "curriculum",
        title: "Classes & Subjects",
        icon: BookOpen,
        tab: "academic",
        children: [
          { title: "Classes", tab: "academic", subtab: "classes" },
          { title: "Subjects", tab: "academic", subtab: "subjects" },
          { title: "Timetable", tab: "academic", subtab: "timetable" },
        ],
      },
      {
        id: "exams",
        title: "Exams",
        icon: ClipboardList,
        tab: "academic",
        children: [
          { title: "Exam Management", tab: "academic", subtab: "exams" },
          { title: "Question Bank", tab: "academic", subtab: "questions" },
          { title: "Live Monitor", tab: "system", subtab: "monitor-logs" },
        ],
      },
      {
        id: "results",
        title: "Results & Reports",
        icon: BarChart3,
        tab: "results-mgmt",
        children: [
          { title: "Student Results", tab: "academic", subtab: "results" },
          { title: "Enter Scores", tab: "results-mgmt", subtab: "enter-scores" },
          { title: "Broadsheet", tab: "results-mgmt", subtab: "broadsheet" },
          { title: "Report Cards", tab: "academic", subtab: "report-cards" },
          { title: "Bulk Report Cards", tab: "results-mgmt", subtab: "bulk-reports" },
          { title: "Promotion", tab: "results-mgmt", subtab: "promotion" },
          { title: "Past Students", tab: "results-mgmt", subtab: "past-students" },
          { title: "Automation", tab: "results-mgmt", subtab: "automation" },
        ],
      },
    ],
  },
  {
    label: "People",
    items: [
      { id: "users", title: "Users", icon: Users, tab: "users" },
      {
        id: "parents",
        title: "Parents",
        icon: Heart,
        tab: "parents",
        children: [
          { title: "Parents", tab: "parents", subtab: "list" },
          { title: "Child Links", tab: "parents", subtab: "links" },
          { title: "Messages", tab: "parents", subtab: "messages" },
          { title: "Announcements", tab: "parents", subtab: "announcements" },
        ],
      },
      {
        id: "hr",
        title: "HR",
        icon: Briefcase,
        tab: "hr",
        children: [
          { title: "Staff Directory", tab: "hr", subtab: "staff" },
          { title: "Staff Attendance", tab: "hr", subtab: "staff-attendance" },
          { title: "Leave Requests", tab: "hr", subtab: "leave" },
          { title: "Payroll", tab: "hr", subtab: "payroll" },
          { title: "Careers", tab: "hr", subtab: "careers" },
        ],
      },
      {
        id: "attendance",
        title: "Attendance",
        icon: ScanLine,
        tab: "attendance-reports",
        children: [
          { title: "Reports", tab: "attendance-reports" },
          { title: "Scan Station", tab: "attendance-scan" },
        ],
      },
      {
        id: "id-cards",
        title: "ID Cards",
        icon: IdCard,
        tab: "id-cards",
        children: [
          { title: "Student ID Cards", tab: "id-cards", subtab: "students" },
          { title: "Staff ID Cards", tab: "id-cards", subtab: "staff" },
        ],
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        id: "finance",
        title: "Finance",
        icon: CreditCard,
        tab: "fees",
        children: [
          { title: "Fees & Income", tab: "fees", subtab: "fees" },
          { title: "Expenses", tab: "fees", subtab: "expenses" },
          { title: "Other Revenue", tab: "fees", subtab: "revenue" },
          { title: "Payroll", tab: "fees", subtab: "payroll" },
          { title: "Reports", tab: "fees", subtab: "reports" },
        ],
      },
      { id: "library", title: "Library", icon: Library, tab: "library" },
      { id: "transport", title: "Transport", icon: Bus, tab: "transport" },
      {
        id: "hostel",
        title: "Hostel",
        icon: BedDouble,
        tab: "hostel",
        children: [
          { title: "Hostels & Rooms", tab: "hostel", subtab: "hostels" },
          { title: "Allocations", tab: "hostel", subtab: "allocations" },
          { title: "Roll Call", tab: "hostel", subtab: "rollcall" },
          { title: "Exeat Passes", tab: "hostel", subtab: "passes" },
          { title: "Inspections", tab: "hostel", subtab: "inspections" },
          { title: "Wardens", tab: "hostel", subtab: "wardens" },
        ],
      },
      { id: "assets", title: "Assets", icon: Package, tab: "assets" },
      {
        id: "communications",
        title: "Communications",
        icon: Bell,
        tab: "notifications",
        children: [
          { title: "Bulk Notifications", tab: "notifications" },
          { title: "Announcements", tab: "announcements" },
          { title: "Email Logs", tab: "system", subtab: "email-logs" },
        ],
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        id: "website",
        title: "Website",
        icon: Globe,
        tab: "website",
        children: [
          { title: "News & Articles", tab: "website", subtab: "news" },
          { title: "Gallery", tab: "website", subtab: "gallery" },
          { title: "Testimonials", tab: "website", subtab: "testimonials" },
          { title: "School Info", tab: "website", subtab: "school-info" },
          { title: "Site Settings", tab: "website", subtab: "site-settings" },
        ],
      },
      { id: "settings", title: "Settings", icon: Settings, tab: "settings" },
      {
        id: "system",
        title: "System",
        icon: ServerCog,
        tab: "system",
        children: [
          { title: "Email Logs", tab: "system", subtab: "email-logs" },
          { title: "Live Monitor", tab: "system", subtab: "monitor-logs" },
          { title: "All Results", tab: "system", subtab: "results-modal" },
        ],
      },
    ],
  },
];

/** Which nav item owns a given tab/subtab  used for the header breadcrumb. */
export function findNavLocation(tab: string, subtab?: string | null) {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.children) {
        const leaf = item.children.find(
          (c) => c.tab === tab && (c.subtab ?? null) === (subtab ?? null)
        );
        if (leaf) return { section: section.label, item, leaf };
      }
      if (item.tab === tab && (item.subtab ?? null) === (subtab ?? null)) {
        return { section: section.label, item, leaf: undefined };
      }
    }
  }
  // Fall back to the first item that owns the tab.
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.tab === tab) return { section: section.label, item, leaf: undefined };
    }
  }
  return null;
}

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get("tab") || "overview";
  const currentSubTab = searchParams.get("subtab");
  const navigate = useNavigate();

  const active = findNavLocation(currentTab, currentSubTab);
  const activeItemId = active?.item.id;

  // Only the group containing the current page is expanded.
  const [openGroups, setOpenGroups] = useState<string[]>(activeItemId ? [activeItemId] : []);

  useEffect(() => {
    if (activeItemId) {
      setOpenGroups((prev) => (prev.includes(activeItemId) ? prev : [...prev, activeItemId]));
    }
  }, [activeItemId]);

  const isLeafActive = (leaf: NavLeaf) =>
    currentTab === leaf.tab && (currentSubTab ?? null) === (leaf.subtab ?? null);

  const isItemActive = (item: NavItem) =>
    !item.children &&
    currentTab === item.tab &&
    (currentSubTab ?? null) === (item.subtab ?? null);

  const go = (tab: string, subtab?: string) => {
    navigate(subtab ? `/admin?tab=${tab}&subtab=${subtab}` : `/admin?tab=${tab}`);
  };

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const activeClasses =
    "bg-sidebar-accent text-sidebar-accent-foreground font-medium border-l-2 border-primary rounded-l-none";

  return (
    <Sidebar collapsible="icon" className={collapsed ? "w-14" : "w-64"}>
      <SidebarContent className="gap-0">
        <TooltipProvider>
          {NAV_SECTIONS.map((section) => (
            <SidebarGroup key={section.label} className="py-1">
              {!collapsed && (
                <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) =>
                    item.children ? (
                      <Collapsible
                        key={item.id}
                        open={!collapsed && openGroups.includes(item.id)}
                        onOpenChange={() => !collapsed && toggleGroup(item.id)}
                      >
                        <SidebarMenuItem>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton
                                  size="sm"
                                  className={activeItemId === item.id ? "font-medium" : ""}
                                  onClick={() => {
                                    if (collapsed) {
                                      const first = item.children![0];
                                      go(first.tab, first.subtab);
                                    }
                                  }}
                                >
                                  <item.icon className="h-4 w-4 shrink-0" />
                                  {!collapsed && (
                                    <>
                                      <span className="truncate">{item.title}</span>
                                      <ChevronDown
                                        className={`ml-auto h-3.5 w-3.5 transition-transform ${
                                          openGroups.includes(item.id) ? "rotate-180" : ""
                                        }`}
                                      />
                                    </>
                                  )}
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                            </TooltipTrigger>
                            {collapsed && (
                              <TooltipContent side="right">
                                <p>{item.title}</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                          {!collapsed && (
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {item.children.map((leaf) => (
                                  <SidebarMenuSubItem key={`${leaf.tab}-${leaf.subtab ?? ""}-${leaf.title}`}>
                                    <SidebarMenuSubButton
                                      size="sm"
                                      onClick={() => go(leaf.tab, leaf.subtab)}
                                      className={isLeafActive(leaf) ? activeClasses : ""}
                                    >
                                      <span className="truncate">{leaf.title}</span>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                ))}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          )}
                        </SidebarMenuItem>
                      </Collapsible>
                    ) : (
                      <SidebarMenuItem key={item.id}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              size="sm"
                              onClick={() => go(item.tab, item.subtab)}
                              className={isItemActive(item) ? activeClasses : ""}
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              {!collapsed && <span className="truncate">{item.title}</span>}
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          {collapsed && (
                            <TooltipContent side="right">
                              <p>{item.title}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </SidebarMenuItem>
                    )
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </TooltipProvider>
      </SidebarContent>
    </Sidebar>
  );
}