/**
 * Real Estate CRM — dashboard.
 *
 * Shows KPI counters and two charts: listings by status and inventory
 * mix by type.
 */

import { defineRoute } from "@/lib/router-compat";
import { useQuery } from "@/lib/react-data-client";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, Trophy, IndianRupee, MapPin,
  Percent, Ticket, ShieldCheck,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import { getDashboard } from "@/lib/realestate.functions";
import { cr } from "@/lib/re-data";

export const Route = defineRoute("/_authenticated/realestate/")({
  component: RealEstateDashboard,
});

function RealEstateDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["re-dashboard"],
    queryFn: getDashboard,
  });

  if (isLoading || !data) {
    return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  }

  const statusData = Object.entries(data.listings_by_status).map(([name, count]) => ({ name, count }));
  const typeData = Object.entries(data.inventory_by_type).map(([name, value]) => ({ name, value }));

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Building2} label="Active Listings" value={String(data.active_listings)} badge={`${data.total_listings} total`} />
        <Kpi icon={Users} label="Total Clients" value={String(data.total_clients)} badge={`${data.kyc_verified} KYC verified`} />
        <Kpi icon={Trophy} label="Deals Won" value={String(data.deals_won)} badge={`${data.total_deals} deals`} />
        <Kpi icon={IndianRupee} label="GMV Closed" value={cr(data.gmv_closed)} tone="text-emerald-600" />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={MapPin} label="Site Visits" value={String(data.site_visits)} badge="scheduled or beyond" />
        <Kpi icon={Percent} label="Visit → Close" value={`${data.visit_to_close_pct}%`} />
        <Kpi icon={Ticket} label="Avg Ticket Size" value={cr(data.avg_ticket_size)} />
        <Kpi icon={ShieldCheck} label="KYC Verified" value={`${data.kyc_verified_pct}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Listings by Status</CardTitle></CardHeader>
          <CardContent>
            {!statusData.length ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Inventory Mix by Type</CardTitle></CardHeader>
          <CardContent>
            {!typeData.length ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={(e: any) => e.name}>
                    {typeData.map((_, i) => <Cell key={i} fill={`hsl(${(i * 55 + 200) % 360} 68% 55%)`} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground text-center py-16">No data yet</p>;
}

function Kpi({ icon: Icon, label, value, badge, tone }: any) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs text-muted-foreground font-medium flex items-center gap-2">
          <Icon className="h-3 w-3" />{label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${tone ?? ""}`}>{value}</div>
        {badge && <Badge variant="secondary" className="mt-1 text-[10px]">{badge}</Badge>}
      </CardContent>
    </Card>
  );
}