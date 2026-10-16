// src/components/dashboard/industries/RealEstateIndustryLayer.tsx
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2, Users, MapPin, Handshake, Home, TrendingUp, ArrowRight, Plus
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Link } from "@tanstack/react-router";

type REDashboardResponse = {
  properties_listed?: number;
  site_visits_this_week?: number;
  deals_closed?: number;
  inventory_available?: number;
  visits_by_status?: Array<{ status: string; count: number }>;
  properties_by_type?: Array<{ type: string; count: number }>;
};

async function fetchREDashboard(): Promise<REDashboardResponse> {
  return apiFetch<REDashboardResponse>("/api/v1/dashboard/industry/realestate");
}

const CHART_COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#6366f1"];

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#06b6d4",
  completed: "#10b981",
  cancelled: "#ef4444",
  pending: "#f59e0b",
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function RealEstateIndustryLayer() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-industry", "realestate"],
    queryFn: fetchREDashboard,
  });

  const kpis = [
    {
      label: "Properties Listed",
      value: data?.properties_listed ?? 0,
      icon: Building2,
      accent: "bg-primary/10 text-primary",
      actionLabel: (data?.properties_listed ?? 0) === 0 ? "Add first property" : undefined,
      actionUrl: "/realestate/properties/new",
    },
    {
      label: "Inventory Available",
      value: data?.inventory_available ?? 0,
      icon: Home,
      accent: "bg-success/10 text-success",
    },
    {
      label: "Site Visits (Week)",
      value: data?.site_visits_this_week ?? 0,
      icon: MapPin,
      accent: "bg-info/10 text-info",
      actionLabel: (data?.site_visits_this_week ?? 0) === 0 ? "Schedule a visit" : undefined,
      actionUrl: "/realestate/visits/new",
    },
    {
      label: "Deals Closed",
      value: data?.deals_closed ?? 0,
      icon: Handshake,
      accent: "bg-warning/10 text-warning",
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    {kpi.label}
                  </p>
                  <p
                    className="text-2xl font-bold mt-1.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {isLoading ? "—" : kpi.value}
                  </p>
                  {kpi.actionLabel && (
                    <Link
                      to={kpi.actionUrl}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      {kpi.actionLabel}
                    </Link>
                  )}
                </div>
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${kpi.accent}`}
                >
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Visits by Status */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Site Visits by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : !data?.visits_by_status?.length ? (
                <EmptyState
                  message="No site visits yet"
                  actionLabel="Schedule your first visit"
                  actionUrl="/realestate/visits/new"
                />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={data.visits_by_status}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="status" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {data.visits_by_status.map((item, i) => (
                        <Cell
                          key={i}
                          fill={STATUS_COLORS[item.status?.toLowerCase()] ?? CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Properties by Type */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Inventory Mix by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {isLoading ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : !data?.properties_by_type?.length ? (
                <EmptyState
                  message="No properties added"
                  actionLabel="Add your first property"
                  actionUrl="/realestate/properties/new"
                />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={data.properties_by_type}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="type" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {data.properties_by_type.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Link to="/realestate/properties">
          <Button variant="outline" size="sm" className="gap-2">
            View Listings <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link to="/realestate/visits">
          <Button variant="outline" size="sm" className="gap-2">
            View Site Visits <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
        <Link to="/realestate/deals">
          <Button variant="outline" size="sm" className="gap-2">
            View Deals <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function EmptyState({
  message,
  actionLabel,
  actionUrl,
}: {
  message: string;
  actionLabel: string;
  actionUrl: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link to={actionUrl} className="mt-2 text-xs text-primary hover:underline">
        {actionLabel} →
      </Link>
    </div>
  );
}