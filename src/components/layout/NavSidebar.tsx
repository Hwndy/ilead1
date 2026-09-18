import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";

export interface NavItem {
  title: string;
  icon: LucideIcon;
  tab: string;
  subtab?: string;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavSidebarProps {
  sections: NavSection[];
  role: string;
  basePath: string;
}

export function NavSidebar({ sections, role, basePath }: NavSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentTab = searchParams.get("tab") || sections[0]?.items[0]?.tab;
  const currentSubTab = searchParams.get("subtab");
  const navigate = useNavigate();

  const go = (tab: string, subtab?: string) => {
    const url = subtab ? `${basePath}?tab=${tab}&subtab=${subtab}` : `${basePath}?tab=${tab}`;
    navigate(url);
  };

  const isItemActive = (item: NavItem) =>
    currentTab === item.tab && (item.subtab ? currentSubTab === item.subtab : true);

  const activeClasses =
    "bg-sidebar-accent text-sidebar-accent-foreground font-semibold border-l-2 border-sidebar-primary rounded-l-none";

  return (
    <Sidebar collapsible="icon" className={cn("border-r border-sidebar-border", collapsed ? "w-14" : "w-64")}>
      <div className="flex h-20 items-center border-b border-sidebar-border px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <Logo size="sm" showText={!collapsed} className="[&_span:first-child]:text-sidebar-primary [&_span:last-child]:text-sidebar-foreground/60" />
      </div>
      <SidebarContent className="bg-sidebar">
        <TooltipProvider>
          {sections.map((section) => (
            <SidebarGroup key={section.label} className="py-2">
              {!collapsed && (
                <SidebarGroupLabel className="px-4 text-[10px] font-bold uppercase text-sidebar-foreground/45">
                  {section.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            size="lg"
                            onClick={() => go(item.tab, item.subtab)}
                            className={cn(
                              "w-full justify-start gap-3 px-4 transition-all duration-200",
                              isItemActive(item) ? activeClasses : "hover:bg-sidebar-accent/50 text-sidebar-foreground/70"
                            )}
                          >
                            <item.icon className={cn("h-5 w-5 shrink-0", isItemActive(item) ? "text-sidebar-primary" : "")} />
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
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </TooltipProvider>
      </SidebarContent>
    </Sidebar>
  );
}
