import { defineRoute, Link } from "@/lib/router-compat";
import { useQuery } from "@/lib/react-data-client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { brandApi } from "@/lib/brand.api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORMS, inr } from "@/lib/creator";
import { toast } from "sonner";

export const Route = defineRoute("/_authenticated/brand/campaigns")({
  head: () => ({ meta: [{ title: "Post a Campaign | Brand Portal" }, { name: "description", content: "Post an open campaign and review creator applications." }] }),
  component: BrandCampaigns,
});

const EMPTY = { title: "", brief: "", budget: "", platform: "", category: "", min_followers: "", deadline: "" };

function BrandCampaigns() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["brand", "my-campaigns"], queryFn: () => brandApi.myCampaigns() });
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await brandApi.createCampaign({ title: f.title, brief: f.brief, budget: f.budget ? Number(f.budget) : null, platform: f.platform, category: f.category, min_followers: Number(f.min_followers) || 0, deadline: f.deadline });
      toast.success("Campaign posted — creators can now apply"); setF(EMPTY); refetch();
    } catch (err) { toast.error((err as Error).message); } finally { setBusy(false); }
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); refetch(); } catch (e) { toast.error((e as Error).message); } };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card className="h-fit">
        <CardHeader><CardTitle className="text-base">New open campaign</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div><Label>Title *</Label><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><Label>Brief</Label><Textarea rows={4} value={f.brief} onChange={(e) => setF({ ...f, brief: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Budget (₹)</Label><Input type="number" min={0} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} /></div>
              <div><Label>Deadline</Label><Input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></div>
              <div><Label>Platform</Label><select className="w-full border rounded-md h-9 px-2 bg-background text-sm" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}><option value="">Any</option>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div><Label>Min followers</Label><Input type="number" min={0} value={f.min_followers} onChange={(e) => setF({ ...f, min_followers: e.target.value })} /></div>
            </div>
            <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Beauty, Tech, Food…" /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Post campaign</Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {!isLoading && !data?.campaigns.length && <p className="text-muted-foreground">You haven't posted any campaigns yet.</p>}
        {(data?.campaigns ?? []).map((c) => {
          const apps = (data?.applications ?? []).filter((a) => a.campaign_id === c.id);
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2 flex-row items-center gap-2 space-y-0">
                <CardTitle className="text-base flex-1">{c.title}</CardTitle>
                <Badge variant={c.status === "Open" ? "default" : "outline"}>{c.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => act(() => brandApi.setCampaignStatus({ id: c.id, status: c.status === "Open" ? "Closed" : "Open" }), "Updated")}>{c.status === "Open" ? "Close" : "Reopen"}</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{c.budget != null ? inr(Number(c.budget)) : "No budget set"} · {apps.length} application(s)</p>
                {apps.map((a) => {
                  const p = a.creator_profiles;
                  return (
                    <div key={a.id} className="border rounded-md p-3 text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <b className="flex-1">{p?.display_name}</b>
                        <span className="text-xs text-muted-foreground">{p?.followers?.toLocaleString()} followers · {Number(p?.engagement_rate ?? 0).toFixed(1)}%</span>
                        {a.quote != null && <Badge variant="outline">{inr(Number(a.quote))}</Badge>}
                        <Badge>{a.status}</Badge>
                      </div>
                      <p className="whitespace-pre-wrap">{a.pitch}</p>
                      <div className="flex flex-wrap gap-2">
                        {p?.handle && <Button size="sm" variant="ghost" asChild><a href={`/kit/${p.handle}`} target="_blank" rel="noreferrer">Media kit</a></Button>}
                        {a.status !== "Accepted" && <Button size="sm" onClick={() => act(() => brandApi.decideApplication({ id: a.id, decision: "Accepted" }), "Accepted")}>Accept</Button>}
                        {a.status === "Applied" && <Button size="sm" variant="outline" onClick={() => act(() => brandApi.decideApplication({ id: a.id, decision: "Shortlisted" }), "Shortlisted")}>Shortlist</Button>}
                        {a.status !== "Declined" && a.status !== "Accepted" && <Button size="sm" variant="ghost" onClick={() => act(() => brandApi.decideApplication({ id: a.id, decision: "Declined" }), "Declined")}>Decline</Button>}
                        {a.deal_id && a.status === "Accepted" && <Button size="sm" variant="outline" asChild><Link to="/brand/campaign/$id" params={{ id: a.deal_id }}>Open campaign</Link></Button>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}