import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useIndustryAccess, groupForRoute, isCrmRoute } from "@/lib/industry-access";
import { ALL_CRMS, useActiveIndustry } from "@/lib/active-industry";
import { Link, useRouterState } from "@/lib/router-compat";

import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, Building2, UserCircle, KanbanSquare, CheckSquare,
  Calendar, Video, BarChart3, Sparkles, FileText, Zap, Bell, Settings, ScrollText,
  Landmark, Home, Laptop, Package, Stethoscope, GraduationCap, ShieldCheck, Car, Plane, Factory,
  Rocket, LifeBuoy, Radio, Crown, Layers, Inbox, TrendingUp, Activity, Wallet, HandCoins,
  Clock, IndianRupee, CreditCard, BookOpen, Store, Palette, ShoppingBag,Target, MapPin, Network,Handshake,
  ArrowRight, ChevronDown, CalendarClock,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  managerUp?: boolean;
  industries?: string[];
  children?: NavItem[]; // sub tabs (nested under the item)
};

// Admin / Manager / Executive ke liye accordion group
type NavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const primary: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Follow-ups", url: "/followups", icon: Clock },
  { title: "Contacts", url: "/contacts", icon: UserCircle },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Meetings", url: "/meetings", icon: Video },
];

const support: NavItem[] = [
  { title: "Tickets", url: "/tickets", icon: LifeBuoy },
  { title: "Inbound Leads", url: "/inbound", icon: Radio, adminOnly: true },
  { title: "Lead Sources", url: "/lead-sources", icon: TrendingUp },
  { title: "DigiVerify", url: "/digiverify", icon: ShieldCheck },
];

const industries: NavItem[] = [
  { title: "Industry Packs", url: "/packs", icon: Layers },
  { title: "Fintech DSA", url: "/fintech", icon: Landmark },
  { title: "Real Estate", url: "/realestate", icon: Home },
  { title: "Sales App (mobile)", url: "/m", icon: Home },
  { title: "Service Company", url: "/it", icon: Laptop },
  { title: "Product Sales", url: "/productsales", icon: Package },
  { title: "Creator CRM", url: "/creator", icon: Sparkles },
  { title: "Distribution OS", url: "/distribution", icon: Store },
  { title: "Restaurant OS", url: "/restaurant", icon: Store, industries: ["restaurant"] },
  { title: "Coaching CRM", url: "/coaching", icon: GraduationCap, industries: ["coaching"] },
  { title: "Education", url: "/industry/education", icon: GraduationCap },
  { title: "Healthcare", url: "/industry/healthcare-clinics", icon: Stethoscope },
  { title: "Insurance", url: "/industry/insurance", icon: ShieldCheck },
  { title: "Automotive", url: "/industry/automotive", icon: Car },
  { title: "Travel", url: "/industry/travel", icon: Plane },
  { title: "Manufacturing", url: "/industry/manufacturing", icon: Factory },
];

// Ye items kisi ek group ke nahi hain (shared tools) — SuperAdmin ko
// kisi bhi group select karne par bhi dikhte rehte hain, aur
// inpar click karne se switcher change nahi hota.
const SHARED_ROUTES = new Set<string>(["/packs", "/digiverify", "/m"]);

const industrySubNav: Record<string, NavItem[]> = {
  // Key = route prefix (jo industry array mein url hai)
  "/it": [
    { title: "Service Dashboard", url: "/it", icon: LayoutDashboard },
    { title: "Projects", url: "/it/projects", icon: KanbanSquare },
    { title: "Tickets & Tasks", url: "/it/tickets", icon: CheckSquare },
    { title: "Pipeline", url: "/it/pipeline", icon: TrendingUp },
  ],
  "/realestate": [
    { title: "Real Estate Dashboard", url: "/realestate", icon: LayoutDashboard },
    { title: "Lead360", url: "/realestate/leads", icon: Users },
    { title: "Projects & Inventory", url: "/realestate/projects", icon: Building2 },
    { title: "MatchAI", url: "/realestate/match", icon: Target },
    { title: "Site Visits", url: "/realestate/visits", icon: MapPin },
    { title: "Pipeline", url: "/realestate/pipeline", icon: KanbanSquare },
    { title: "Deals & Payments", url: "/realestate/deals", icon: Handshake },
    { title: "Partners & Routing", url: "/realestate/partners", icon: Network },
    { title: "AI Copilot", url: "/realestate/copilot", icon: Sparkles },
    { title: "Analytics", url: "/realestate/analytics", icon: BarChart3 },
    { title: "Clients & KYC", url: "/realestate/clients", icon: UserCircle },
    { title: "Listings", url: "/realestate/properties", icon: Home },
  ],
};

const insights: NavItem[] = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "AI Assistant", url: "/ai", icon: Sparkles },
  { title: "Proposals", url: "/proposals", icon: FileText },
  { title: "Automation", url: "/automation", icon: Zap, adminOnly: true },
];

const system: NavItem[] = [
  { title: "Industry Workspace", url: "/workspace", icon: Layers },
  { title: "My Workspace", url: "/tenant-dashboard", icon: Layers },
  { title: "Wallet", url: "/wallet", icon: Wallet },  
  { title: "Portal Desk", url: "/tenant-portal", icon: Layers },
  { title: "Billing", url: "/tenant-billing", icon: Wallet, managerUp: true },
  { title: "Cash Flow Tracker", url: "/cashflow", icon: IndianRupee, managerUp: true },
  { title: "Payments & Ledger", url: "/payments", icon: CreditCard, managerUp: true },
  { title: "Payout Accounts", url: "/payout-accounts", icon: HandCoins, managerUp: true },
  { title: "Partner Payouts", url: "/partner", icon: HandCoins },
  { title: "Education AI", url: "/education-setup", icon: GraduationCap, industries: ["education", "coaching"] },
  { title: "DigiPortal", url: "/portal", icon: Layers, industries: ["education", "coaching", "creator"] },
  { title: "Buyer Portal", url: "/buyer", icon: ShoppingBag,industries: ["property"] },
  // { title: "Student Portal", url: "/student-portal", icon: Home, industries: ["education", "coaching"] },
  { title: "Brand Portal", url: "/brand", icon: Palette, industries: ["creator"] },
  { title: "Agency Desk", url: "/agency/desk", icon: LifeBuoy, superAdminOnly: true },
  { title: "Agency Portal", url: "/agency/portal", icon: FileText, superAdminOnly: true },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Feature Matrix", url: "/feature-matrix", icon: ShieldCheck, adminOnly: true },
  { title: "Settings", url: "/settings", icon: Settings },
];

const adminOnly: NavItem[] = [
  { title: "Webhook Retries", url: "/webhook-dead-letter", icon: Inbox },
  { title: "Webhook Settings", url: "/webhook-settings", icon: Settings },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText },
  { title: "Landing Analytics", url: "/landing-analytics", icon: Activity },
  { title: "Conversions", url: "/landing-conversions", icon: TrendingUp },
  { title: "Affiliates", url: "/affiliates", icon: Users },
  { title: "Payout History", url: "/payout-history", icon: Wallet },
  { title: "Pack Settings", url: "/settings-pack", icon: Settings },
  { title: "Teams and Invites", url: "/team", icon: Users},
  { title: "New Workspace", url: "/onboarding", icon: Layers },
];

const superAdminOnly: NavItem[] = [
  { title: "Super Admin", url: "/admin", icon: Crown },
  { title: "Tenants", url: "/settings-tenants", icon: Layers },
  { title: "Industry Pack CMS", url: "/admin-packs", icon: Layers },
  { title: "Template Builder", url: "/admin-templates", icon: Layers },
  { title: "Plans & Features", url: "/settings-plans", icon: Crown },
  { title: "Content (CMS)", url: "/settings-cms", icon: FileText },
];

// ---------------------------------------------------------------
// Admin / Manager / Executive ke liye fixed group items
// (Role-based hiding filterByRole se hoti hai — adminOnly / managerUp flags)
// ---------------------------------------------------------------
const LEADS_ITEMS: NavItem[] = [
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Contacts", url: "/contacts", icon: UserCircle },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Pipeline", url: "/pipeline", icon: KanbanSquare },
  { title: "Proposals", url: "/proposals", icon: FileText },
  { title: "Lead Sources", url: "/lead-sources", icon: TrendingUp },
];

const ACTIVITY_ITEMS: NavItem[] = [
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Tickets", url: "/tickets", icon: LifeBuoy },
  {
    // Calendar click -> /calendar (Task Calendar) opens by default
    title: "Calendar",
    url: "/calendar",
    icon: Calendar,
    children: [
      { title: "Task Calendar", url: "/calendar", icon: CheckSquare },
      { title: "Schedule Calendar", url: "/schedule-calendar", icon: CalendarClock },
    ],
  },
  { title: "Meetings", url: "/meetings", icon: Video },
];

const REPORT_ITEMS: NavItem[] = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Audit Logs", url: "/audit-logs", icon: ScrollText, adminOnly: true },
];

const AUTOMATION_ITEMS: NavItem[] = [
  { title: "Automation", url: "/automation", icon: Zap, adminOnly: true },
  { title: "AI Assistant", url: "/ai", icon: Sparkles },
  { title: "Webhook Retries", url: "/webhook-dead-letter", icon: Inbox, adminOnly: true },
  { title: "Webhook Settings", url: "/webhook-settings", icon: Settings, adminOnly: true },
];

const SETTINGS_ITEMS: NavItem[] = [
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Teams and Invites", url: "/team", icon: Users, adminOnly: true },
  { title: "Billing", url: "/tenant-billing", icon: Wallet, managerUp: true },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Feature Matrix", url: "/feature-matrix", icon: ShieldCheck, adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  // useAuth se ready-made flags — koi manual role calculation nahi
  const { isSuperAdmin, isAdmin, isManager } = useAuth();
  const access = useIndustryAccess();

  // active      = CrmSwitcher mein selected group slug (ya "all")
  // activeGroup = tenant users ka locked group (SuperAdmin ke liye hamesha null)
  const { active, activeGroup, activeName, setActive } = useActiveIndustry();

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  // Accordion: ek time par sirf ek group open (sirf non-SuperAdmin ke liye use hota hai)
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Sub-tab sections (e.g. Calendar): manual open/close override.
  // Route badalne par reset hota hai, tab section apne active state se khulta hai.
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>({});
  useEffect(() => { setSubOpen({}); }, [pathname]);

  // Sidebar se CRM kholne par switcher ko usi group par sync karo.
  // Sirf pathname badalne par chalta hai, taaki switcher ki manual
  // selection se na ladey.
  useEffect(() => {
    if (!isSuperAdmin) return; // tenant users locked hain, switcher unka hai hi nahi

    const match = industries.find((i) => isActive(i.url));
    if (!match || SHARED_ROUTES.has(match.url)) return;

    const group = groupForRoute(match.url);
    if (group && group !== active) setActive(group);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isSuperAdmin]);

  const superAdminFilterGroup =
    isSuperAdmin && active && active !== ALL_CRMS ? active : null;

  const visibleIndustries = industries.filter((i) => {
    if (!access.canUseRoute(i.url)) return false;

    // SuperAdmin
    if (isSuperAdmin) {
      // "All industries" => sab dikhao
      if (!superAdminFilterGroup) return true;
      // Shared tools hamesha dikhao
      if (SHARED_ROUTES.has(i.url)) return true;
      // Warna sirf selected group ke CRMs
      return groupForRoute(i.url) === superAdminFilterGroup;
    }

    // Tenant users: sirf unki active industry ke tabs
    if (!activeGroup) return false;
    return groupForRoute(i.url) === activeGroup;
  });

  const currentIndustry = visibleIndustries.find(
    (i) => pathname === i.url || pathname.startsWith(i.url + "/"),
  );

  const currentSubNav = currentIndustry ? industrySubNav[currentIndustry.url] : undefined;

  const crmItems = visibleIndustries.filter((i) => isCrmRoute(i.url));
  const singleTenantCrm = !isSuperAdmin && crmItems.length === 1 ? crmItems[0] : undefined;

  const industryLabel = isSuperAdmin
    ? superAdminFilterGroup && activeName
      ? `${activeName} CRMs`
      : "Industry CRMs"
    : singleTenantCrm
      ? `${singleTenantCrm.title} CRM`
      : "Industry CRMs";

  const filterByRole = (items: NavItem[]): NavItem[] => {
  return items.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.adminOnly) return isAdmin;
    if (item.managerUp) return isManager;
    if (item.industries && item.industries.length > 0) {
      if (isSuperAdmin) return true;
      if (!activeGroup) return false;
      return item.industries.includes(activeGroup);
    }

    return true;
  });
};

  // ---------------------------------------------------------------
  // Admin / Manager / Executive: grouped accordion nav
  // ---------------------------------------------------------------
  const buildTenantGroups = (): NavGroup[] => {
    // Dashboard: Lead Dashboard + har CRM ka apna dashboard (eg. IT Dashboard)
    const dashboardItems: NavItem[] = [
      { title: "Lead Dashboard", url: "/dashboard", icon: LayoutDashboard },
      ...crmItems.map((c) => ({
        title: industrySubNav[c.url]?.[0]?.title ?? `${c.title} Dashboard`,
        url: c.url,
        icon: LayoutDashboard,
      })),
    ];

    // "<Industry> CRM": us CRM ke sub tabs (dashboard upar Dashboard group mein hai)
    const crmGroupItems: NavItem[] = crmItems.flatMap((c) => {
      const sub = industrySubNav[c.url];
      return sub ? sub.filter((s) => s.url !== c.url) : [c];
    });

    const groups: NavGroup[] = [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, items: dashboardItems },
      { key: "leads", label: "Leads", icon: Users, items: LEADS_ITEMS },
      ...(!access.loading && crmGroupItems.length > 0
        ? [{
            key: "crm",
            label: singleTenantCrm
              ? `${singleTenantCrm.title}`
              : activeName
                ? `${activeName}`
                : "Industry",
            icon: Layers,
            items: crmGroupItems,
          }]
        : []),
      { key: "activity", label: "Activity", icon: Activity, items: ACTIVITY_ITEMS },
      { key: "reports", label: "Reports", icon: BarChart3, items: REPORT_ITEMS },
      { key: "automation", label: "Automation", icon: Zap, items: AUTOMATION_ITEMS },
      {
        key: "settings",
        label: "Settings",
        icon: Settings,
        items:
          access.groups.length === 0 && !isAdmin
            ? [{ title: "Choose your industry", url: "/choose-industry", icon: Layers }, ...SETTINGS_ITEMS]
            : SETTINGS_ITEMS,
      },
    ];

    return groups
      .map((g) => ({ ...g, items: filterByRole(g.items) }))
      .filter((g) => g.items.length > 0);
  };

  const tenantGroups = isSuperAdmin ? [] : buildTenantGroups();

  // Sabse specific (longest) matching url hi "active" maana jaayega,
  // taaki /it aur /it/projects dono ek saath highlight na ho.
  const activeUrl = tenantGroups
    .flatMap((g) => g.items.flatMap((i) => [i, ...(i.children ?? [])]))
    .filter((i) => isActive(i.url))
    .sort((a, b) => b.url.length - a.url.length)[0]?.url;

  const activeGroupKey = tenantGroups.find((g) =>
    g.items.some((i) => i.url === activeUrl || i.children?.some((c) => c.url === activeUrl)),
  )?.key;

  // Route badalne par (ya page reload par) us route wala group khud open ho jaaye
  useEffect(() => {
    if (isSuperAdmin) return;
    if (activeGroupKey) setOpenKey(activeGroupKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isSuperAdmin, activeGroupKey]);

  const renderTenantNav = () => (
    <SidebarGroup className="py-1.5">
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {tenantGroups.map((group) => {
            const isOpen = openKey === group.key;
            const hasActive = group.key === activeGroupKey;

            // Collapsed (icon-only) mode: group icon click -> uska pehla tab khulega
            if (collapsed) {
              return (
                <SidebarMenuItem key={group.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={hasActive}
                    tooltip={group.label}
                    className="h-10 gap-3 rounded-lg px-3 text-[14px] font-normal text-slate-300 transition-colors hover:bg-white/10 hover:text-white data-[active=true]:bg-blue-600 data-[active=true]:font-medium data-[active=true]:text-white data-[active=true]:shadow-md data-[active=true]:shadow-blue-900/40 data-[active=true]:hover:bg-blue-600"
                  >
                    <Link to={group.items[0].url}>
                      <group.icon className="h-4.5 w-4.5 shrink-0" />
                      <span>{group.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            return (
              <SidebarMenuItem key={group.key}>
                <SidebarMenuButton
                  onClick={() => setOpenKey(isOpen ? null : group.key)}
                  aria-expanded={isOpen}
                  className={
                    "h-10 w-full justify-between gap-3 rounded-lg px-3 text-[14px] transition-colors hover:bg-white/10 hover:text-white " +
                    (isOpen
                      ? "bg-white/10 font-medium text-white"
                      : hasActive
                        ? "font-medium text-white"
                        : "font-normal text-slate-300")
                  }
                >
                  <span className="flex items-center gap-3">
                    <group.icon className="h-4.5 w-4.5 shrink-0" />
                    <span>{group.label}</span>
                  </span>
                  <ChevronDown
                    className={
                      "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 " +
                      (isOpen ? "rotate-180" : "")
                    }
                  />
                </SidebarMenuButton>

                {/* Smooth expand / collapse */}
                <div
                  className={
                    "grid transition-all duration-200 ease-in-out " +
                    (isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")
                  }
                >
                  <div className="overflow-hidden">
                    <ul className="ml-5 mt-1 mb-1 space-y-0.5 border-l border-white/15 pl-2">
                      {group.items.map((item) => {
                        const hasChildren = !!item.children?.length;
                        const itemActive = hasChildren
                          ? item.children!.some((c) => c.url === activeUrl)
                          : item.url === activeUrl;

                        // Item with sub tabs (e.g. Calendar): parent link opens the first
                        // sub tab, sub tabs are shown while we are inside that section.
                        if (hasChildren) {
                          const expanded = subOpen[item.url] ?? itemActive;
                          return (
                            <li key={item.url}>
                              <Link
                                to={item.url}
                                tabIndex={isOpen ? 0 : -1}
                                aria-expanded={expanded}
                                onClick={(e: { preventDefault: () => void; }) => {
                                  // Already inside this section: click = open/close toggle
                                  if (itemActive) {
                                    e.preventDefault();
                                    setSubOpen((p) => ({ ...p, [item.url]: !expanded }));
                                  }
                                }}
                                className={
                                  "flex h-9 items-center justify-between gap-3 rounded-lg px-3 text-[13.5px] transition-colors " +
                                  (itemActive
                                    ? "bg-white/10 font-medium text-white"
                                    : "font-normal text-slate-300 hover:bg-white/10 hover:text-white")
                                }
                              >
                                <span className="flex items-center gap-3">
                                  <item.icon className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{item.title}</span>
                                </span>
                                <ChevronDown
                                  className={
                                    "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 " +
                                    (expanded ? "rotate-180" : "")
                                  }
                                />
                              </Link>
                              <div
                                className={
                                  "grid transition-all duration-200 ease-in-out " +
                                  (expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")
                                }
                              >
                                <div className="overflow-hidden">
                                  <ul className="ml-4 mt-0.5 mb-1 space-y-0.5 border-l border-white/15 pl-2">
                                    {item.children!.map((child) => {
                                      const childActive = child.url === activeUrl;
                                      return (
                                        <li key={child.url}>
                                          <Link
                                            to={child.url}
                                            tabIndex={isOpen && expanded ? 0 : -1}
                                            className={
                                              "flex h-8 items-center gap-2.5 rounded-lg px-3 text-[13px] transition-colors " +
                                              (childActive
                                                ? "bg-blue-600 font-medium text-white shadow-md shadow-blue-900/40"
                                                : "font-normal text-slate-300 hover:bg-white/10 hover:text-white")
                                            }
                                          >
                                            <child.icon className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">{child.title}</span>
                                          </Link>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li key={item.url}>
                            <Link
                              to={item.url}
                              tabIndex={isOpen ? 0 : -1}
                              className={
                                "flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors " +
                                (itemActive
                                  ? "bg-blue-600 font-medium text-white shadow-md shadow-blue-900/40"
                                  : "font-normal text-slate-300 hover:bg-white/10 hover:text-white")
                              }
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  const renderGroup = (label: string, items: NavItem[]) => {
    const visibleItems = filterByRole(items);
    if (visibleItems.length === 0) return null;

    return (
      <SidebarGroup className="py-1.5">
        {!collapsed && (
          <SidebarGroupLabel className="px-3 text-[12px] font-medium tracking-wide text-slate-400">
            {label}
          </SidebarGroupLabel>
        )}
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {visibleItems.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                  className="h-10 gap-3 rounded-lg px-3 text-[14px] font-normal text-slate-300 transition-colors hover:bg-white/10 hover:text-white data-[active=true]:bg-blue-600 data-[active=true]:font-medium data-[active=true]:text-white data-[active=true]:shadow-md data-[active=true]:shadow-blue-900/40 data-[active=true]:hover:bg-blue-600"
                >
                  <Link to={item.url}>
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      className="**:data-[sidebar=sidebar]:bg-[linear-gradient(180deg,#0b1b45_0%,#07112b_100%)] **:data-[sidebar=sidebar]:text-slate-300 **:data-[sidebar=sidebar]:border-white/10"
    >
      <SidebarHeader className="border-b border-white/10 px-2 py-3">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
            <img src="/logo.png" alt="DigiCRM AI" width={32} height={32} className="h-8 w-8 rounded-lg shrink-0 shadow-elegant" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[17px] font-bold text-white" style={{ fontFamily: "var(--font-display)" }}>DigiCRM AI</span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Enterprise</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2 [scrollbar-color:rgba(255,255,255,0.18)_transparent] scrollbar-thin">
        {isSuperAdmin ? (
          <>
            {/* ===== SuperAdmin: layout bilkul pehle jaisa ===== */}
            {renderGroup("Workspace", primary)}
            {renderGroup("Support", support)}

            {/* Current industry ka sub-nav (Dashboard, Projects, Tickets, Pipeline) */}
            {!access.loading && currentIndustry && currentSubNav && currentSubNav.length > 0 &&
              renderGroup(currentIndustry.title, currentSubNav)}

            {/* Industry list: SuperAdmin ko hamesha */}
            {!access.loading && visibleIndustries.length > 0 &&
              renderGroup(industryLabel, visibleIndustries)}

            {renderGroup("Insights", insights)}
            {isAdmin && renderGroup("Administration", adminOnly)}
            {renderGroup("Super Admin", superAdminOnly)}
            {renderGroup(
              "System",
              access.groups.length === 0 && !isAdmin
                ? [{ title: "Choose your industry", url: "/choose-industry", icon: Layers }, ...system]
                : system,
            )}
          </>
        ) : (
          /* ===== Admin / Manager / Executive: accordion tabs + sub tabs ===== */
          renderTenantNav()
        )}
      </SidebarContent>

      <SidebarFooter>
        {!collapsed && isSuperAdmin && (
          <Link
            to="/settings-cms"
            className="mx-2 mb-3 flex items-center gap-3 rounded-xl p-3 text-white shadow-lg shadow-blue-950/50 ring-1 ring-white/10 transition hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#2f5bff 0%,#7c3aed 100%)" }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Rocket className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Run a campaign</div>
              <div className="truncate text-[11px] text-white/80">Create colorful landing pages</div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-white/90" />
          </Link>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}