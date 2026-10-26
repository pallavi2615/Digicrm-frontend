import { defineRoute } from "@/lib/router-compat";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@/lib/react-data-client";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useIndustryAccess } from "@/lib/industry-access";
import { INDUSTRY_PACKS } from "@/lib/industry-packs";
import { INDUSTRY_GROUPS } from "@/lib/industry-taxonomy";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Radio, TrendingUp, IndianRupee, Target, Megaphone, Filter, X } from "lucide-react";
import { DETAIL_DIALOG, BTN_PILL, BTN_PRIMARY, DETAIL_INPUT } from "@/components/detail-ui";

export const Route = defineRoute("/_authenticated/lead-sources")({
  head: () => ({
    meta: [
      { title: "Lead Sources, Channels & Campaigns | DigiCRM AI" },
      { name: "description", content: "Track every inbound lead from Google Sheets, Meta Lead Ads and Zapier through its channel, campaign, pipeline stage and revenue." },
      { property: "og:title", content: "Lead Sources | DigiCRM AI" },
      { property: "og:description", content: "Channel and campaign attribution with stage-by-stage conversion and revenue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadSourcesPage,
});

const KINDS = ["manual", "google_sheets", "meta", "zapier", "website", "referral", "affiliate"];
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

interface Channel {
  id: string; name: string; slug: string; kind: string;
  default_group_slug: string | null; default_pack_slug: string | null;
  monthly_cost: number | null; is_active: boolean;
}
interface Campaign {
  id: string; name: string; code: string; channel_id: string | null;
  budget: number | null; is_active: boolean;
}
interface Conversion {
  id: string; channel_id: string | null; campaign_id: string | null;
  industry_group: string | null; stage: string; status: string; revenue: number; occurred_at: string;
}

/* ---------- design tokens (shared with Leads / Dashboard / Pipeline) ---------- */

const PANEL = "rounded-2xl border border-slate-200/70 bg-card shadow-sm dark:border-slate-800";

type Tone = "blue" | "green" | "orange" | "purple";

const TONES: Record<Tone, { card: string; soft: string; solid: string }> = {
  blue: {
    card: "from-blue-50 to-white border-blue-100 dark:from-blue-950 dark:to-slate-950 dark:border-blue-500/40",
    soft: "bg-blue-100 text-blue-600 dark:bg-blue-500/25 dark:text-blue-300",
    solid: "bg-blue-500 text-white",
  },
  green: {
    card: "from-green-50 to-white border-green-100 dark:from-emerald-950 dark:to-slate-950 dark:border-emerald-500/40",
    soft: "bg-green-100 text-green-600 dark:bg-emerald-500/25 dark:text-emerald-300",
    solid: "bg-emerald-500 text-white",
  },
  orange: {
    card: "from-orange-50 to-white border-orange-100 dark:from-orange-950 dark:to-slate-950 dark:border-orange-500/40",
    soft: "bg-orange-100 text-orange-600 dark:bg-orange-500/30 dark:text-orange-300",
    solid: "bg-orange-500 text-white",
  },
  purple: {
    card: "from-violet-50 to-white border-violet-100 dark:from-violet-950 dark:to-slate-950 dark:border-violet-500/40",
    soft: "bg-violet-100 text-violet-600 dark:bg-violet-500/25 dark:text-violet-300",
    solid: "bg-violet-500 text-white",
  },
};

// one colour per channel type
const KIND_COLORS: Record<string, string> = {
  manual: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30",
  google_sheets: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  meta: "bg-blue-100 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30",
  zapier: "bg-orange-100 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30",
  website: "bg-violet-100 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  referral: "bg-sky-100 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  affiliate: "bg-fuchsia-100 text-fuchsia-700 ring-1 ring-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:ring-fuchsia-500/30",
};

// funnel bars cycle through these
const BAR_COLORS = [
  "from-sky-500 to-sky-400", "from-amber-500 to-amber-400", "from-fuchsia-500 to-fuchsia-400",
  "from-indigo-500 to-indigo-400", "from-violet-500 to-violet-400", "from-emerald-500 to-emerald-400",
  "from-rose-500 to-rose-400",
];

const TAB_LIST =
  "grid grid-cols-3 w-full sm:w-auto sm:inline-grid h-auto p-1.5 rounded-2xl bg-muted/60 border border-border/50";
const TAB =
  "rounded-xl px-5 py-2.5 gap-2 text-sm font-medium " +
  "data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-500 " +
  "data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-blue-600/30";

const TABLE_WRAP = "rounded-xl border border-slate-200/70 overflow-hidden dark:border-slate-800";
const HEAD_ROW = "bg-slate-50 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900/60";
const HEAD = "font-medium text-slate-500 dark:text-slate-300";
const ROW = "border-slate-100 transition-colors hover:bg-blue-50/40 dark:border-slate-800/80 dark:hover:bg-slate-800/40";

function SectionIcon({ icon: Icon, tone }: { icon: React.ComponentType<{ className?: string }>; tone: Tone }) {
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone].soft}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function LeadSourcesPage() {
  const { isManager } = useAuth();
  const { unrestricted, groups } = useIndustryAccess();
  const qc = useQueryClient();

  const { data: channels = [] } = useQuery({
    queryKey: ["lead-channels"],
    queryFn: async () => {
      const res = await apiFetch<Channel[]>("/api/v1/lead-sources/channels");
      return Array.isArray(res) ? res : [];
    },
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["lead-campaigns"],
    queryFn: async () => {
      const res = await apiFetch<Campaign[]>("/api/v1/lead-sources/campaigns");
      return Array.isArray(res) ? res : [];
    },
  });
  const { data: conversions = [] } = useQuery({
    queryKey: ["lead-conversions"],
    queryFn: async () => {
      const res = await apiFetch<Conversion[]>("/api/v1/lead-sources/conversions?limit=2000");
      return Array.isArray(res) ? res : [];
    },
  });

  const visible = useMemo(
    () => conversions.filter((c) => unrestricted || !c.industry_group || groups.includes(c.industry_group)),
    [conversions, unrestricted, groups],
  );

  const perChannel = useMemo(() => {
    return channels.map((ch) => {
      const rows = visible.filter((c) => c.channel_id === ch.id);
      const won = rows.filter((r) => r.status === "won");
      const revenue = won.reduce((s, r) => s + Number(r.revenue || 0), 0);
      return {
        channel: ch,
        leads: rows.length,
        won: won.length,
        lost: rows.filter((r) => r.status === "lost").length,
        rate: rows.length ? (won.length / rows.length) * 100 : 0,
        revenue,
      };
    });
  }, [channels, visible]);

  const stageBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const c of visible) {
      const cur = map.get(c.stage) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(c.revenue || 0);
      map.set(c.stage, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [visible]);

  const totals = useMemo(() => {
    const won = visible.filter((c) => c.status === "won");
    return {
      leads: visible.length,
      won: won.length,
      revenue: won.reduce((s, r) => s + Number(r.revenue || 0), 0),
      rate: visible.length ? (won.length / visible.length) * 100 : 0,
    };
  }, [visible]);

  return (
    <div className="space-y-6">
      {/* ================= HEADER ================= */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm dark:border dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <Radio className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Lead Sources</h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {channels.length} channels
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5 max-w-2xl">
              Every inbound lead from Google Sheets, Meta Lead Ads or Zapier, tracked to its channel, campaign, stage and revenue.
            </p>
          </div>
        </div>
        {isManager && <NewChannelDialog onDone={() => qc.invalidateQueries({ queryKey: ["lead-channels"] })} />}
      </div>

      {/* ================= KPI CARDS ================= */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Radio} label="Tracked leads" value={String(totals.leads)} tone="blue" />
        <Kpi icon={Target} label="Converted" value={String(totals.won)} tone="green" solid />
        <Kpi icon={TrendingUp} label="Conversion rate" value={`${totals.rate.toFixed(1)}%`} tone="purple" solid />
        <Kpi icon={IndianRupee} label="Attributed revenue" value={money(totals.revenue)} tone="orange" />
      </div>

      <Tabs defaultValue="channels">
        <TabsList className={TAB_LIST}>
          <TabsTrigger value="channels" className={TAB}><Radio className="h-4 w-4" /> Channels</TabsTrigger>
          <TabsTrigger value="campaigns" className={TAB}><Megaphone className="h-4 w-4" /> Campaigns</TabsTrigger>
          <TabsTrigger value="stages" className={TAB}><Filter className="h-4 w-4" /> Stage funnel</TabsTrigger>
        </TabsList>

        {/* ---------- Channels ---------- */}
        <TabsContent value="channels" className="mt-4">
          <Card className={PANEL}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SectionIcon icon={Radio} tone="blue" />
                <div>
                  <CardTitle className="text-base">Channel performance</CardTitle>
                  <CardDescription>Leads, conversion rate and revenue per acquisition channel.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`${TABLE_WRAP} overflow-x-auto`}>
                <Table>
                  <TableHeader>
                    <TableRow className={HEAD_ROW}>
                      <TableHead className={HEAD}>Channel</TableHead>
                      <TableHead className={HEAD}>Type</TableHead>
                      <TableHead className={HEAD}>Lands in</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Leads</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Won</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Rate</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Revenue</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perChannel.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-muted-foreground text-center py-12">No channels yet.</TableCell></TableRow>
                    )}
                    {perChannel.map((r) => (
                      <TableRow key={r.channel.id} className={ROW}>
                        <TableCell className="font-medium text-slate-800 dark:text-white">{r.channel.name}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${KIND_COLORS[r.channel.kind] ?? KIND_COLORS.manual}`}>
                            {r.channel.kind.replace("_", " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {r.channel.default_pack_slug ? `${r.channel.default_group_slug} / ${r.channel.default_pack_slug}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">{r.leads}</TableCell>
                        <TableCell className="text-right">{r.won}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            {r.rate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-800 dark:text-white">{money(r.revenue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{money(Number(r.channel.monthly_cost ?? 0))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Campaigns ---------- */}
        <TabsContent value="campaigns" className="mt-4">
          <Card className={PANEL}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <SectionIcon icon={Megaphone} tone="purple" />
                <div>
                  <CardTitle className="text-base">Campaigns</CardTitle>
                  <CardDescription>Campaign-level leads, conversions and revenue.</CardDescription>
                </div>
              </div>
              {isManager && (
                <NewCampaignDialog channels={channels} onDone={() => qc.invalidateQueries({ queryKey: ["lead-campaigns"] })} />
              )}
            </CardHeader>
            <CardContent>
              <div className={`${TABLE_WRAP} overflow-x-auto`}>
                <Table>
                  <TableHeader>
                    <TableRow className={HEAD_ROW}>
                      <TableHead className={HEAD}>Campaign</TableHead>
                      <TableHead className={HEAD}>Code</TableHead>
                      <TableHead className={HEAD}>Channel</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Leads</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Won</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Revenue</TableHead>
                      <TableHead className={`${HEAD} text-right`}>Budget</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-muted-foreground text-center py-12">No campaigns yet.</TableCell></TableRow>
                    )}
                    {campaigns.map((c) => {
                      const rows = visible.filter((v) => v.campaign_id === c.id);
                      const won = rows.filter((r) => r.status === "won");
                      return (
                        <TableRow key={c.id} className={ROW}>
                          <TableCell className="font-medium text-slate-800 dark:text-white">{c.name}</TableCell>
                          <TableCell>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-500/20 dark:text-slate-300">
                              {c.code}
                            </span>
                          </TableCell>
                          <TableCell>{channels.find((ch) => ch.id === c.channel_id)?.name ?? "—"}</TableCell>
                          <TableCell className="text-right">{rows.length}</TableCell>
                          <TableCell className="text-right">{won.length}</TableCell>
                          <TableCell className="text-right font-semibold text-slate-800 dark:text-white">{money(won.reduce((s, r) => s + Number(r.revenue || 0), 0))}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{money(Number(c.budget ?? 0))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Stage funnel ---------- */}
        <TabsContent value="stages" className="mt-4">
          <Card className={PANEL}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <SectionIcon icon={Filter} tone="orange" />
                <div>
                  <CardTitle className="text-base">Where inbound leads sit</CardTitle>
                  <CardDescription>Current pipeline stage of every tracked inbound lead.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {stageBreakdown.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300/70 py-10 text-center text-sm text-muted-foreground dark:border-slate-700">
                  No tracked leads yet.
                </div>
              )}
              {stageBreakdown.map(([stage, s], i) => {
                const pct = totals.leads ? (s.count / totals.leads) * 100 : 0;
                return (
                  <div
                    key={stage}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm mb-2">
                      <span className="font-medium capitalize text-slate-800 dark:text-white">{stage.replace(/_/g, " ")}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700">
                          {s.count}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-white">{money(s.revenue)}</span>
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200/70 overflow-hidden dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full bg-linear-to-r ${BAR_COLORS[i % BAR_COLORS.length]}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, tone, solid = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: Tone;
  solid?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className={`flex items-center gap-4 rounded-2xl border bg-linear-to-br p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${t.card}`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${solid ? t.solid : t.soft}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">{label}</div>
        <div className="text-2xl font-bold text-slate-800 dark:text-white truncate">{value}</div>
      </div>
    </div>
  );
}

function NewChannelDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("manual");
  const [group, setGroup] = useState<string>("none");
  const [pack, setPack] = useState<string>("none");
  const [cost, setCost] = useState("0");

  const packOptions = INDUSTRY_PACKS.filter((p) => p.group === group);

  const save = useMutation({
    mutationFn: async () => {
      const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await apiFetch("/api/v1/lead-sources/channels", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug,
          kind,
          default_group_slug: group === "none" ? null : group,
          default_pack_slug: pack === "none" ? null : pack,
          monthly_cost: Number(cost) || 0,
        }),
      });
    },
    onSuccess: () => { toast.success("Channel added"); setOpen(false); setName(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> New channel
        </Button>
      </DialogTrigger>
      <DialogContent className={`${DETAIL_DIALOG} sm:max-w-lg`}>
        <DialogHeader className="px-8 pt-7 pb-4 space-y-0">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Radio className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">New lead channel</DialogTitle>
              <DialogDescription className="mt-1">Add an acquisition channel to track.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-8 py-2 space-y-4">
          <div className="space-y-1.5"><Label>Name</Label><Input className={DETAIL_INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Facebook Lead Ads" /></div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className={DETAIL_INPUT}><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select value={group} onValueChange={(v) => { setGroup(v); setPack("none"); }}>
                <SelectTrigger className={DETAIL_INPUT}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {INDUSTRY_GROUPS.map((g) => <SelectItem key={g.slug} value={g.slug}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pack</Label>
              <Select value={pack} onValueChange={setPack} disabled={group === "none"}>
                <SelectTrigger className={DETAIL_INPUT}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {packOptions.map((p) => <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Monthly cost (₹)</Label><Input className={DETAIL_INPUT} type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
        </div>
        <DialogFooter className="px-8 py-4 mt-4 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-between sm:justify-between">
          <Button variant="outline" className={BTN_PILL} onClick={() => setOpen(false)}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button className={BTN_PRIMARY} onClick={() => save.mutate()} disabled={!name || save.isPending}>Save channel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewCampaignDialog({ channels, onDone }: { channels: Channel[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState<string>(channels[0]?.id ?? "");
  const [budget, setBudget] = useState("0");

  const save = useMutation({
    mutationFn: async () => {
      const code = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await apiFetch("/api/v1/lead-sources/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name, code,
          channel_id: channelId || null,
          budget: Number(budget) || 0,
        }),
      });
    },
    onSuccess: () => { toast.success("Campaign added"); setOpen(false); setName(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 rounded-xl bg-violet-600 text-white shadow-sm hover:bg-violet-700">
          <Plus className="mr-2 h-4 w-4" /> New campaign
        </Button>
      </DialogTrigger>
      <DialogContent className={`${DETAIL_DIALOG} sm:max-w-lg`}>
        <DialogHeader className="px-8 pt-7 pb-4 space-y-0">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500 border border-violet-500/20">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">New campaign</DialogTitle>
              <DialogDescription className="mt-1">Attach a campaign to a channel and set its budget.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-8 py-2 space-y-4">
          <div className="space-y-1.5"><Label>Name</Label><Input className={DETAIL_INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="Diwali Business Loan" /></div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger className={DETAIL_INPUT}><SelectValue placeholder="Select channel" /></SelectTrigger>
              <SelectContent>{channels.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Budget (₹)</Label><Input className={DETAIL_INPUT} type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
        </div>
        <DialogFooter className="px-8 py-4 mt-4 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-between sm:justify-between">
          <Button variant="outline" className={BTN_PILL} onClick={() => setOpen(false)}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button className={BTN_PRIMARY} onClick={() => save.mutate()} disabled={!name || save.isPending}>Save campaign</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}