/**
 * Analytics360 — funnel, source, team and lost-reason analytics.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getAnalytics } from "@/lib/realestate.functions";
import { cr } from "@/lib/re-data";

export const Route = createFileRoute("/_authenticated/realestate/analytics")({
  head: () => ({ meta: [{ title: "Analytics360 | Real Estate CRM" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["re-analytics"],
    queryFn: getAnalytics,
  });

  if (isLoading || !data) {
    return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  }

  const k = data.kpis;
  const kpis: [string, string | number][] = [
    ["Total leads", k.total_leads],
    ["New today", k.new_today],
    ["Hot leads", k.hot_leads],
    ["Site visits done", k.site_visits_done],
    ["Bookings", k.bookings],
    ["Booking value", cr(k.booking_value)],
    ["Collected", cr(k.collected)],
    ["Outstanding", cr(k.outstanding)],
    ["Lead → visit", k.lead_to_visit_pct != null ? `${k.lead_to_visit_pct}%` : "—"],
    ["Visit → booking", k.visit_to_booking_pct != null ? `${k.visit_to_booking_pct}%` : "—"],
    ["Booking → registration", k.booking_to_registration_pct != null ? `${k.booking_to_registration_pct}%` : "—"],
    ["Avg deal value", cr(k.avg_deal_value)],
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        {kpis.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="text-lg font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Lead funnel</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.funnel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Lost reasons</CardTitle></CardHeader>
          <CardContent className="h-64">
            {!data.lost_reasons.length ? (
              <div className="text-sm text-muted-foreground">No lost leads recorded</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={data.lost_reasons} layout="vertical">
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="reason" width={120} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Source performance</CardTitle>
          <CardDescription>Leads, visits, bookings and revenue by acquisition source.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Visits</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.source_performance.map((s: any) => (
                <TableRow key={s.source}>
                  <TableCell>{s.source}</TableCell>
                  <TableCell>{s.leads}</TableCell>
                  <TableCell>{s.visits}</TableCell>
                  <TableCell>{s.bookings}</TableCell>
                  <TableCell>{cr(s.revenue)}</TableCell>
                </TableRow>
              ))}
              {!data.source_performance.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No data yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Team scorecard</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Contact rate</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Bookings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.team_performance.map((t: any) => (
                <TableRow key={t.team}>
                  <TableCell>{t.team}</TableCell>
                  <TableCell>{t.leads}</TableCell>
                  <TableCell>{t.leads ? `${Math.round((t.contacted / t.leads) * 100)}%` : "—"}</TableCell>
                  <TableCell>{t.overdue}</TableCell>
                  <TableCell>{t.bookings}</TableCell>
                </TableRow>
              ))}
              {!data.team_performance.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    No data yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}