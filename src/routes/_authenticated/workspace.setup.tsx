import { defineRoute, useNavigate } from "@/lib/router-compat";
import { useState } from "react";
import { useQuery, useMutation } from "@/lib/react-data-client";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Check } from "lucide-react";

export const Route = defineRoute("/_authenticated/workspace/setup")({
  head: () => ({ meta: [{ title: "Workspace Setup — DigiCRM AI" }] }),
  component: WorkspaceSetupWizard,
});

type Step = 1 | 2 | 3 | 4 | 5;

type TemplateCard = {
  key: string; label: string; description: string;
  category?: string; is_default: boolean; status: string;
};

type PipelineStage = { name: string; counts_as_won: boolean; order: number };
type ModuleItem = { key: string; label: string; enabled: boolean };
type FieldItem = { key: string; label: string; enabled: boolean };

type TemplateGraph = {
  template_key: string; label: string; description: string;
  location_types: string[];
  pipeline_stages: PipelineStage[];
  modules: ModuleItem[];
  fields: FieldItem[];
  automations: ModuleItem[];
  ai_agents: ModuleItem[];
  defaults: Record<string, any>;
};

function WorkspaceSetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);

  // ─── Step 1 state ─────────────────────────────────────
  const [description, setDescription] = useState("");
  const [createNew, setCreateNew] = useState(false);

  // ─── Step 2 state ─────────────────────────────────────
  const [templateKey, setTemplateKey] = useState<string>("");

  // ─── Step 3 state ─────────────────────────────────────
  const [locationType, setLocationType] = useState<string>("single");

  // ─── Step 4 state (populated from template graph) ─────
  const [graph, setGraph] = useState<TemplateGraph | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [automations, setAutomations] = useState<ModuleItem[]>([]);
  const [aiAgents, setAiAgents] = useState<ModuleItem[]>([]);
  const [defaults, setDefaults] = useState<Record<string, any>>({});
  const [sampleDeals, setSampleDeals] = useState(true);

  // ─── Step 1: describe ─────────────────────────────────
  const describeMutation = useMutation({
    mutationFn: () =>
      apiFetch<{
        matched_template: string;
        matched_industry: string;
        location_type: string;
      }>("/api/v1/workspace/describe", {
        method: "POST",
        body: JSON.stringify({ text: description, create_new: createNew }),
      }),
    onSuccess: (res) => {
      setTemplateKey(res.matched_template);
      setLocationType(res.location_type || "single");
      setStep(2);
    },
  });

  // ─── Step 2: list templates ───────────────────────────
  const { data: templates = [] } = useQuery({
    queryKey: ["workspace-templates"],
    queryFn: () => apiFetch<TemplateCard[]>("/api/v1/workspace/templates"),
    enabled: step === 2,
  });

  // ─── Step 4: load chosen template graph ───────────────
  const { isLoading: graphLoading } = useQuery({
    queryKey: ["workspace-template", templateKey],
    queryFn: async () => {
      const g = await apiFetch<TemplateGraph>(`/api/v1/workspace/templates/${templateKey}`);
      setGraph(g);
      setPipelineStages(g.pipeline_stages);
      setModules(g.modules);
      setFields(g.fields);
      setAutomations(g.automations);
      setAiAgents(g.ai_agents);
      setDefaults(g.defaults);
      return g;
    },
    enabled: !!templateKey && step >= 4,
  });

  // ─── Step 5: create ───────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/workspace/create", {
        method: "POST",
        body: JSON.stringify({
          template_key: templateKey,
          location_type: locationType,
          pipeline_stages: pipelineStages,
          modules: Object.fromEntries(modules.map((m) => [m.key, m.enabled])),
          fields: fields.filter((f) => f.enabled).map((f) => f.key),
          automations: automations.filter((a) => a.enabled).map((a) => a.key),
          ai_agents: aiAgents.filter((a) => a.enabled).map((a) => a.key),
          defaults,
          description,
          sample_deals: sampleDeals,
          create_new_tenant: createNew,
        }),
      }),
    onSuccess: () => {
      navigate({ to: "/workspace" });
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6" /> AI CRM that configures itself
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick your industry — pipeline, fields, dashboard, workflows, WhatsApp
          journeys, AI agents and reports are created for you.
        </p>
      </header>

      <Stepper step={step} />

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <Step1
              description={description}
              setDescription={setDescription}
              createNew={createNew}
              setCreateNew={setCreateNew}
              onConfigure={() => describeMutation.mutate()}
              onManual={() => setStep(2)}
              isPending={describeMutation.isPending}
            />
          )}

          {step === 2 && (
            <Step2
              templates={templates}
              templateKey={templateKey}
              setTemplateKey={setTemplateKey}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <Step3
              locationType={locationType}
              setLocationType={setLocationType}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}

          {step === 4 && graphLoading && (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
              Loading template…
            </p>
          )}

          {step === 4 && !graphLoading && (
            <Step4
              pipelineStages={pipelineStages}
              setPipelineStages={setPipelineStages}
              modules={modules}
              setModules={setModules}
              fields={fields}
              setFields={setFields}
              automations={automations}
              setAutomations={setAutomations}
              aiAgents={aiAgents}
              setAiAgents={setAiAgents}
              defaults={defaults}
              setDefaults={setDefaults}
              onBack={() => setStep(3)}
              onNext={() => setStep(5)}
            />
          )}

          {step === 5 && (
            <Step5
              graph={graph}
              pipelineStages={pipelineStages}
              modules={modules}
              fields={fields}
              automations={automations}
              aiAgents={aiAgents}
              sampleDeals={sampleDeals}
              setSampleDeals={setSampleDeals}
              onBack={() => setStep(4)}
              onCreate={() => createMutation.mutate()}
              isPending={createMutation.isPending}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Stepper ─────────────────────────────────────────────── */
function Stepper({ step }: { step: Step }) {
  const steps = [
    "1. Your business",
    "2. Industry & type",
    "3. Locations",
    "4. Customise",
    "5. Preview & create",
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <span
            key={label}
            className={`px-3 py-1 rounded-md text-xs font-medium ${
              active
                ? "bg-primary text-primary-foreground"
                : done
                ? "bg-secondary text-foreground"
                : "bg-secondary/40 text-muted-foreground"
            }`}
          >
            {done ? "✓ " : ""}
            {label}
          </span>
        );
      })}
    </div>
  );
}

/* ─── Step 1 ──────────────────────────────────────────────── */
function Step1(props: any) {
  const { description, setDescription, createNew, setCreateNew, onConfigure, onManual, isPending } = props;
  const canSubmit = description.trim().length >= 3 && !isPending;
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Describe your business</h2>
      <p className="text-sm text-muted-foreground">
        e.g. "I run a 3-location dental clinic in Pune" — or skip and choose
        from the list.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={createNew}
          onChange={(e) => setCreateNew(e.target.checked)}
        />
        Create a new workspace (otherwise current tenant switches)
      </label>
      <textarea
        className="w-full min-h-27.5 rounded-md border bg-background px-3 py-2 text-sm"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="I'm a 3-location dental clinic…"
      />
      <div className="flex gap-2">
        <Button onClick={onConfigure} disabled={!canSubmit}>
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Configure with AI
        </Button>
        <Button variant="outline" onClick={onManual}>Choose manually</Button>
      </div>
    </div>
  );
}

/* ─── Step 2 ──────────────────────────────────────────────── */
function Step2(props: any) {
  const { templates, templateKey, setTemplateKey, onBack, onNext } = props;
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Select your industry</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {templates.map((t: any) => {
          const selected = templateKey === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTemplateKey(t.key)}
              className={`text-left p-4 rounded-lg border transition-colors ${
                selected ? "border-primary bg-primary/5" : "hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{t.label}</span>
                {t.is_default && (
                  <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">Default</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {t.description}
              </p>
              <p className="text-xs text-primary mt-2">ⓘ Preview</p>
            </button>
          );
        })}
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button onClick={onNext} disabled={!templateKey}>Continue →</Button>
      </div>
    </div>
  );
}

/* ─── Step 3 ──────────────────────────────────────────────── */
function Step3(props: any) {
  const { locationType, setLocationType, onBack, onNext } = props;
  const options = [
    { key: "single", label: "Single location", sub: "Business → Team → Customers" },
    { key: "multi", label: "Multi-location", sub: "Head office → Locations → Teams → Customers" },
    { key: "franchise", label: "Franchise", sub: "Brand → Franchisees → Locations → Teams, with royalty" },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">How many locations?</h2>
      <p className="text-sm text-muted-foreground">
        The same engine runs 1 location or 1,000 franchise outlets.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => setLocationType(o.key)}
            className={`text-left p-4 rounded-lg border transition-colors ${
              locationType === o.key ? "border-primary bg-primary/5" : "hover:border-primary/50"
            }`}
          >
            <div className="font-medium text-sm">{o.label}</div>
            <p className="text-xs text-muted-foreground mt-1">{o.sub}</p>
          </button>
        ))}
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button onClick={onNext}>Continue →</Button>
      </div>
    </div>
  );
}

/* ─── Step 4 ──────────────────────────────────────────────── */
function Step4(props: any) {
  const {
    pipelineStages, setPipelineStages,
    modules, setModules,
    fields, setFields,
    automations, setAutomations,
    aiAgents, setAiAgents,
    defaults, setDefaults,
    onBack, onNext,
  } = props;

  const toggle = <T extends { enabled: boolean }>(arr: T[], setArr: (a: T[]) => void, idx: number) => {
    const copy = [...arr];
    copy[idx] = { ...copy[idx], enabled: !copy[idx].enabled };
    setArr(copy);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold">Customise before creating</h2>
      <p className="text-sm text-muted-foreground">
        Switch modules on or off, rename stages and set your defaults. You can
        change all of this later too.
      </p>

      {/* Pipeline stages */}
      <section>
        <h3 className="text-sm font-medium mb-2">Pipeline stages</h3>
        <div className="space-y-2">
          {pipelineStages.map((s: PipelineStage, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
              <Input
                value={s.name}
                onChange={(e) => {
                  const copy = [...pipelineStages];
                  copy[i] = { ...copy[i], name: e.target.value };
                  setPipelineStages(copy);
                }}
                className="flex-1"
              />
              <label className="text-xs flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={s.counts_as_won}
                  onChange={(e) => {
                    const copy = [...pipelineStages];
                    copy[i] = { ...copy[i], counts_as_won: e.target.checked };
                    setPipelineStages(copy);
                  }}
                />
                Counts as won
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section>
        <h3 className="text-sm font-medium mb-2">Modules</h3>
        <div className="grid grid-cols-2 gap-2">
          {modules.map((m: ModuleItem, i: number) => (
            <label key={m.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={m.enabled}
                onChange={() => toggle(modules, setModules, i)}
              />
              {m.label}
            </label>
          ))}
        </div>
      </section>

      {/* Fields / Automations / Agents — same pattern */}
      <div className="grid gap-6 md:grid-cols-3">
        <FieldGroup title="Fields" items={fields} onToggle={(i) => toggle(fields, setFields, i)} />
        <FieldGroup title="Automations" items={automations} onToggle={(i) => toggle(automations, setAutomations, i)} />
        <FieldGroup title="AI agents" items={aiAgents} onToggle={(i) => toggle(aiAgents, setAiAgents, i)} />
      </div>

      {/* Defaults */}
      <section>
        <h3 className="text-sm font-medium mb-2">Defaults</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(defaults).map(([k, v]) => (
            <div key={k}>
              <Label className="text-xs capitalize">{k.replace(/_/g, " ")}</Label>
              <Input
                value={String(v ?? "")}
                onChange={(e) => setDefaults({ ...defaults, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button onClick={onNext}>Continue →</Button>
      </div>
    </div>
  );
}

function FieldGroup({
  title, items, onToggle,
}: { title: string; items: ModuleItem[]; onToggle: (i: number) => void }) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={it.enabled}
              onChange={() => onToggle(i)}
            />
            {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Step 5 ──────────────────────────────────────────────── */
function Step5(props: any) {
  const {
    graph, pipelineStages, modules, fields, automations, aiAgents,
    sampleDeals, setSampleDeals, onBack, onCreate, isPending,
  } = props;

  const enabledModules = modules.filter((m: ModuleItem) => m.enabled);
  const enabledFields = fields.filter((f: FieldItem) => f.enabled);
  const enabledAutomations = automations.filter((a: ModuleItem) => a.enabled);
  const enabledAgents = aiAgents.filter((a: ModuleItem) => a.enabled);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">
        Preview: this is exactly what will be created
      </h2>
      <p className="text-sm text-muted-foreground">
        {graph?.label} · B2B sales · {enabledModules.length} modules
      </p>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {enabledModules.map((m: ModuleItem) => (
            <span key={m.key} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 text-sm">
        <div>
          <div className="font-medium mb-1">Fields</div>
          <ul className="space-y-0.5 text-muted-foreground">
            {enabledFields.map((f: FieldItem) => <li key={f.key}>✓ {f.label}</li>)}
          </ul>
        </div>
        <div>
          <div className="font-medium mb-1">Automations</div>
          <ul className="space-y-0.5 text-muted-foreground">
            {enabledAutomations.map((a: ModuleItem) => <li key={a.key}>✓ {a.label}</li>)}
          </ul>
        </div>
        <div>
          <div className="font-medium mb-1">AI agents</div>
          <ul className="space-y-0.5 text-muted-foreground">
            {enabledAgents.map((a: ModuleItem) => <li key={a.key}>✓ {a.label}</li>)}
          </ul>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sampleDeals}
          onChange={(e) => setSampleDeals(e.target.checked)}
        />
        Add 12 sample deals so the dashboard isn't empty
      </label>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>← Back</Button>
        <Button onClick={onCreate} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Create my {graph?.label ?? "workspace"}
        </Button>
      </div>
    </div>
  );
}