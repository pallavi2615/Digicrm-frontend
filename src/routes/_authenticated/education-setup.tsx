import { defineRoute, useNavigate } from "@/lib/router-compat";
import { useState } from "react";
import { useMutation, useQueryClient } from "@/lib/react-data-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { GraduationCap, Loader2, Sparkles, Check, School, Plane } from "lucide-react";
import { toast } from "sonner";
import { getTemplate } from "@/lib/workspace-templates";
import { educationApi, type EducationPlan, type Kind } from "@/lib/education.api";

export const Route = defineRoute("/_authenticated/education-setup")({
  head: () => ({
    meta: [
      { title: "Education AI Setup | DigiCRM AI" },
      { name: "description", content: "Answer a few questions and AI builds your coaching, college or consultant CRM: pipeline, forms, dashboards and programs." },
      { property: "og:title", content: "Education AI Setup | DigiCRM AI" },
      { property: "og:description", content: "Self-configuring CRM for coaching institutes, colleges and education consultants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EducationSetup,
});

const TYPES: { k: Kind; label: string; hint: string; icon: any }[] = [
  { k: "coaching", label: "Coaching institute", hint: "NEET, JEE, UPSC, tuition…", icon: GraduationCap },
  { k: "education", label: "College / University", hint: "UG, PG, diploma admissions", icon: School },
  { k: "study_abroad", label: "Education consultant", hint: "Study abroad, admissions", icon: Plane },
  { k: "school", label: "School", hint: "K-12 admissions", icon: School },
  { k: "edtech", label: "EdTech", hint: "Online courses", icon: Sparkles },
  { k: "skill_training", label: "Skill / Training", hint: "Vocational, placement", icon: GraduationCap },
];

function EducationSetup() {
  const nav = useNavigate(); const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("coaching");
  const [a, setA] = useState({ name: "", city: "", branches: 1, programs: "", mode: "Offline", feeRange: "", notes: "" });
  const [plan, setPlan] = useState<EducationPlan | null>(null);
  const [sample, setSample] = useState(true);
  const tpl = getTemplate(kind)!;

  const ask = useMutation({
    mutationFn: () => educationApi.setup({ businessType: kind, ...a }),
    onSuccess: setPlan, onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!plan) throw new Error("Build your CRM with AI first.");
      await educationApi.apply({
        setupId: plan.setupId,
        businessType: kind,
        name: a.name.trim() || tpl.name,
        notes: a.notes,
        sample: kind !== "coaching" && sample,
        plan,
      });
      return kind;
    },
    onSuccess: async () => { await qc.invalidateQueries(); toast.success("Your education CRM is ready"); nav({ to: "/" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const extraKeys = new Set((plan?.extraFields ?? []).map((f) => f.key));

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="h-6 w-6 text-primary" />Education AI Setup</h1>
        <p className="text-sm text-muted-foreground">Tell us about your institute. AI creates your admission pipeline, enquiry form, dashboard, programs, branches and batches.</p>
      </div>

      <Card><CardHeader><CardTitle className="text-base">1. What kind of institute are you?</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <button key={t.k} onClick={() => { setKind(t.k); setPlan(null); }} className={`rounded-lg border p-3 text-left transition-colors ${kind === t.k ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
              <t.icon className="mb-1 h-4 w-4 text-primary" /><p className="text-sm font-medium">{t.label}</p><p className="text-xs text-muted-foreground">{t.hint}</p>
            </button>))}
        </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base">2. A few details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Institute name</Label><Input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="e.g. Vidya NEET Academy" /></div>
          <div><Label>City</Label><Input value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} placeholder="e.g. Kota" /></div>
          <div><Label>Number of branches</Label><Input type="number" min={1} max={50} value={a.branches} onChange={(e) => setA({ ...a, branches: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} /></div>
          <div><Label>Teaching mode</Label><div className="flex gap-1">{["Offline", "Online", "Hybrid"].map((m) => <Button key={m} size="sm" type="button" variant={a.mode === m ? "default" : "outline"} onClick={() => setA({ ...a, mode: m })}>{m}</Button>)}</div></div>
          <div className="sm:col-span-2"><Label>{kind === "study_abroad" ? "Countries & services" : "Courses / programs you offer"}</Label><Textarea rows={2} value={a.programs} onChange={(e) => setA({ ...a, programs: e.target.value })} placeholder={kind === "study_abroad" ? "UK, Canada masters; IELTS coaching; visa filing" : kind === "education" ? "BBA, MBA, B.Tech CSE, B.Com" : "NEET 2-year, NEET dropper, Class 11 foundation"} /></div>
          <div><Label>Typical fee range</Label><Input value={a.feeRange} onChange={(e) => setA({ ...a, feeRange: e.target.value })} placeholder="₹60,000 – ₹1,50,000" /></div>
          <div><Label>Anything else?</Label><Input value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} placeholder="Scholarship test every month…" /></div>
          <Button className="sm:col-span-2" onClick={() => ask.mutate()} disabled={ask.isPending || !a.programs.trim()}>{ask.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Build my CRM with AI</Button>
        </CardContent></Card>

      {plan && (
        <Card><CardHeader><CardTitle className="text-base">3. Review what AI built</CardTitle><CardDescription>{plan.summary || `${tpl.name} · ${plan.subtype}`}</CardDescription></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Section title={`Admission pipeline (${tpl.stages.length} stages)`}>{tpl.stages.map((s) => <Badge key={s} variant={tpl.wonStages.includes(s) ? "default" : "secondary"}>{s}</Badge>)}</Section>
            <Section title="Enquiry form fields">{[...tpl.fields, ...plan.extraFields].map((f) => <Badge key={f.key} variant={extraKeys.has(f.key) ? "default" : "outline"}>{f.label}{extraKeys.has(f.key) ? " · new" : ""}</Badge>)}</Section>
            <Section title="Dashboard">{tpl.dashboard.map((k) => <Badge key={k.label} variant="outline">{k.label}</Badge>)}</Section>
            <Section title="AI agents">{tpl.agents.map((g) => <Badge key={g.key} variant="outline">{g.label}</Badge>)}</Section>
            {plan.courses.length > 0 && <div><p className="mb-1 font-medium">Programs</p><div className="grid gap-1 sm:grid-cols-2">{plan.courses.map((c, i) => (
              <div key={i} className="flex items-center gap-2 rounded border p-2"><span className="flex-1">{c.name}<span className="block text-xs text-muted-foreground">{c.mode} · {c.duration_months} months</span></span>
                <Input className="h-8 w-28" type="number" value={c.fee} onChange={(e) => { const cs = [...plan.courses]; cs[i] = { ...c, fee: Number(e.target.value) || 0 }; setPlan({ ...plan, courses: cs }); }} /></div>))}</div></div>}
            <Section title="Branches">{plan.branches.map((b, i) => <Badge key={i} variant="secondary">{b.name} · {b.city}</Badge>)}</Section>
            {plan.batches.length > 0 && <Section title="Batches">{plan.batches.map((b, i) => <Badge key={i} variant="outline">{b.name}{b.timing ? ` · ${b.timing}` : ""}</Badge>)}</Section>}
            {kind !== "coaching" && <div className="flex items-center gap-2"><Switch id="s" checked={sample} onCheckedChange={setSample} /><Label htmlFor="s">Add sample enquiries so I can try it</Label></div>}
            <Button className="w-full" onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Create my {tpl.name}</Button>
          </CardContent></Card>)}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-1 font-medium">{title}</p><div className="flex flex-wrap gap-1">{children}</div></div>;
}