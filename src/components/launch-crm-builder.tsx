// src/routes/_authenticated/launch-crm.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Globe2, Layers, Rocket, Loader2, Building2, ShieldCheck, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { notifyAuthChanged } from "@/hooks/use-auth";

// ── Static Data (Jo aapke screenshot me tha) ──
const STEPS = ["Business & region", "Industry & template", "Modules", "Your brand", "Team & automation", "Review & launch"];

const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD", phone: "+1", timezones: ["America/Adak", "America/New_York", "America/Los_Angeles"] },
  { code: "IN", name: "India", currency: "INR", phone: "+91", timezones: ["Asia/Kolkata"] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", phone: "+971", timezones: ["Asia/Dubai"] },
];

const TEMPLATES = [
  { slug: "default", name: "Default CRM", group: "professional-services", subtypes: ["B2B", "B2C", "Enterprise"] },
  { slug: "restaurant", name: "Restaurant CRM", group: "commerce", subtypes: ["Fine Dining", "Cafe", "QSR"] },
  { slug: "finance_nbfc", name: "Finance / NBFC CRM", group: "financial-services", subtypes: ["DSA", "NBFC", "Bank"] },
  { slug: "real_estate", name: "Real Estate CRM", group: "property", subtypes: ["Residential", "Commercial", "Rental"] },
];

const MODULES = [
  { key: "crm_core", name: "CRM Core", detail: "Contacts, accounts and custom fields", dependencies: [] as string[] },
  { key: "sales_pipeline", name: "Sales Pipeline", detail: "Opportunities, stages and quotations", dependencies: ["crm_core"] },
  { key: "campaigns", name: "Campaigns & Forms", detail: "Enquiries, lead sources and campaigns", dependencies: ["crm_core"] },
  { key: "whatsapp", name: "WhatsApp & Communications", detail: "Click-to-send drafts, email needs sender setup", dependencies: ["crm_core"] },
  { key: "workflow", name: "Workflow Automation", detail: "Stage actions, approvals and follow-ups", dependencies: ["crm_core", "sales_pipeline"] },
  { key: "ai", name: "AI Agents", detail: "Agent builder, knowledge and guarded tools", dependencies: ["crm_core"] },
  { key: "customer_support", name: "Customer Support", detail: "Tickets, queues and policy review", dependencies: ["crm_core"] },
  { key: "partner", name: "Partner Management", detail: "Partners, commissions and manual payouts", dependencies: ["crm_core", "finance"] },
  { key: "reports", name: "Reports & Analytics", detail: "Dashboards, reports and exports", dependencies: ["crm_core"] },
  { key: "finance", name: "Finance & Billing", detail: "Invoices, ledger and manual payment references", dependencies: ["crm_core"] },
  { key: "documents", name: "Documents & Approvals", detail: "Contracts, client approvals and verification", dependencies: ["crm_core", "sales_pipeline"] },
  { key: "industry_workspace", name: "Industry Workspace", detail: "Published industry template and specialist records", dependencies: ["crm_core", "sales_pipeline"] },
];

const INITIAL_STAGES = ["Lead", "Application", "KYC", "Documents", "Verification", "Underwriting", "Sanction", "Disbursement", "Collection"];

// ── Types ──
type LaunchConfig = {
  name: string;
  legalName: string;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
  preferredLanguage: string;
  businessHours: string;
  phone: string;
  postalCode: string;
  taxPct: number;
  address: string;
  template: string;
  subtype: string;
  modules: string[];
  primaryColor: string;
  accentColor: string;
  font: string;
  logo: string | null;
  recordLabel: string;
  recordLabelPlural: string;
  domain: string;
  sender: string;
  seats: number;
  team: string;
  stages: string[];
  agents: boolean;
  workflows: boolean;
  integrations: string[];
};

const INITIAL_CONFIG: LaunchConfig = {
  name: "",
  legalName: "",
  country: "US",
  currency: "USD",
  timezone: "America/Adak",
  locale: "en-US",
  preferredLanguage: "English",
  businessHours: "",
  phone: "",
  postalCode: "",
  taxPct: 0,
  address: "",
  template: "finance_nbfc",
  subtype: "DSA",
  modules: ["crm_core", "sales_pipeline", "workflow", "documents"],
  primaryColor: "#0f766e",
  accentColor: "#e11d48",
  font: "System",
  logo: null,
  recordLabel: "Application",
  recordLabelPlural: "Applications",
  domain: "",
  sender: "",
  seats: 50,
  team: "",
  stages: [...INITIAL_STAGES],
  agents: false,
  workflows: true,
  integrations: ["Google Sheets", "WhatsApp"],
};

export default function LaunchCrmPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<LaunchConfig>(INITIAL_CONFIG);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");

  function set<K extends keyof LaunchConfig>(key: K, value: LaunchConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    setError("");
  }

  function resolveModules(requested: string[]): string[] {
    const result = new Set<string>();
    const add = (key: string) => {
      if (result.has(key)) return;
      const mod = MODULES.find((m) => m.key === key);
      if (mod) {
        mod.dependencies.forEach(add);
        result.add(key);
      }
    };
    requested.forEach(add);
    return Array.from(result);
  }

  const selected = resolveModules(config.modules);
  const country = COUNTRIES.find((c) => c.code === config.country);
  const base = TEMPLATES.find((t) => t.slug === config.template);

  const pickTemplate = (slug: string) => {
    const t = TEMPLATES.find((x) => x.slug === slug);
    if (!t) return;
    setConfig((c) => ({
      ...c,
      template: slug,
      subtype: t.subtypes[0] || "Standard",
      stages: [...INITIAL_STAGES],
    }));
  };

  const handleLaunch = async () => {
    // ⭐ Basic Validation
    if (config.name.trim().length < 2) {
      setError("Workspace name must contain at least 2 character(s)");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const payload = {
        workspace_name: config.name,
        legal_name: config.legalName,
        country: country?.name || "United States",
        currency: config.currency,
        timezone: config.timezone,
        date_format: config.locale,
        preferred_language: config.preferredLanguage,
        phone: config.phone,
        postal_code: config.postalCode,
        configured_tax: config.taxPct,
        business_address: config.address,
        industry: config.template,
        business_type: config.subtype,
        modules: selected,
        primary_color: config.primaryColor,
        secondary_color: config.accentColor,
        record_name: config.recordLabel,
        record_name_plural: config.recordLabelPlural,
        requested_seats: config.seats,
        initial_team_name: config.team,
        pipeline_stages: config.stages,
        enable_followup_workflows: config.workflows,
        integrations: config.integrations,
      };

      // ⭐ FASTAPI BACKEND CALL
      await apiFetch("/api/v1/onboarding/launch", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // LocalStorage me tenant update karo
      const rawTenant = localStorage.getItem("tenant");
      if (rawTenant) {
        const tenant = JSON.parse(rawTenant);
        tenant.is_onboarded = true;
        localStorage.setItem("tenant", JSON.stringify(tenant));
      }

      toast.success("Workspace launched successfully!");
      notifyAuthChanged();
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch could not finish. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ── Field Helpers ──
  const textField = (key: keyof LaunchConfig, title: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={`launch-${key}`}>{title}</Label>
      <Input
        id={`launch-${key}`}
        type={type}
        value={String(config[key] || "")}
        onChange={(e) => set(key, (type === "number" ? Number(e.target.value) : e.target.value) as never)}
      />
    </div>
  );

  const selectField = (title: string, key: keyof LaunchConfig, options: { value: string; label: string }[]) => (
    <div className="space-y-2">
      <Label htmlFor={`launch-${key}`}>{title}</Label>
      <select
        id={`launch-${key}`}
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={String(config[key])}
        onChange={(e) => set(key, e.target.value as never)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Rocket className="h-4 w-4" /> DigiCRM AI
          </div>
          <h1 className="text-3xl font-bold">Launch Your CRM</h1>
          <p className="mt-2 text-muted-foreground">Your business. Your country. Your workspace.</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <ShieldCheck className="h-4 w-4" /> Saved draft
        </Badge>
      </div>

      {/* Steps Navigation */}
      <nav aria-label="Setup steps" className="flex gap-1 overflow-x-auto border-b py-3">
        {STEPS.map((s, i) => (
          <Button
            key={s}
            variant={step === i ? "secondary" : "ghost"}
            size="sm"
            className="shrink-0"
            onClick={() => setStep(i)}
          >
            <span className="mr-2 text-muted-foreground">
              {i < step ? <Check className="h-4 w-4" /> : `0${i + 1}`}
            </span>
            {s}
          </Button>
        ))}
      </nav>

      {/* Main Content */}
      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 space-y-6">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Step {step + 1} of 6</p>
            <h2 className="mt-2 text-xl font-semibold">{STEPS[step]}</h2>
          </div>

          {/* STEP 1: Business & Region */}
          {step === 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              {textField("name", "Workspace name")}
              {textField("legalName", "Legal business name")}
              
              <div className="space-y-2">
                <Label htmlFor="country-search">Search countries and territories</Label>
                <Input
                  id="country-search"
                  placeholder="Search country"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                />
                <select
                  aria-label="Operating country"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={config.country}
                  onChange={(e) => {
                    const c = COUNTRIES.find((x) => x.code === e.target.value);
                    if (c) {
                      setConfig((prev) => ({
                        ...prev,
                        country: c.code,
                        currency: c.currency,
                        timezone: c.timezones[0],
                        phone: c.phone,
                      }));
                    }
                  }}
                >
                  {COUNTRIES.filter(
                    (c) => c.code === config.country || c.name.toLowerCase().includes(countrySearch.toLowerCase())
                  ).map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              {textField("currency", "Primary currency")}
              {selectField("Time zone", "timezone", (country?.timezones || ["UTC"]).map((t) => ({ value: t, label: t })))}
              {selectField("Date and number format", "locale", [
                { value: "en-IN", label: "English · India" },
                { value: "en-GB", label: "English · UK" },
                { value: "en-US", label: "English · International" },
              ])}
              {textField("preferredLanguage", "Preferred language (preference only)")}
              {textField("businessHours", "Working hours")}
              {textField("phone", `Phone · ${country?.phone || "international"}`)}
              {textField("postalCode", "Postal code")}
              {textField("taxPct", "Configured tax (%)", "number")}
              
              <div className="space-y-2">
                <Label htmlFor="business-address">Business address</Label>
                <Textarea
                  id="business-address"
                  value={config.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </div>
              
              <p className="sm:col-span-2 text-sm text-muted-foreground">
                Interface language: English. Hosting region is unchanged; country selection does not certify local compliance or enable local payment methods.
              </p>
            </div>
          )}

          {/* STEP 2: Industry & Template */}
          {step === 1 && (
            <div className="space-y-5">
              {selectField("Starting point", "template", TEMPLATES.map((t) => ({ value: t.slug, label: t.name })))}
              <div className="grid gap-3 sm:grid-cols-2">
                {TEMPLATES.map((t) => (
                  <Button
                    key={t.slug}
                    variant="outline"
                    className={`h-auto min-h-20 justify-start whitespace-normal p-4 text-left ${config.template === t.slug ? "border-primary bg-accent" : ""}`}
                    onClick={() => pickTemplate(t.slug)}
                  >
                    <Layers className="mr-3 h-5 w-5 shrink-0" />
                    <span>
                      <span className="block font-semibold">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">{t.group} · {t.subtypes.length} business types</span>
                    </span>
                  </Button>
                ))}
              </div>
              {selectField("Business type", "subtype", (base?.subtypes || [config.subtype]).map((s) => ({ value: s, label: s })))}
            </div>
          )}

          {/* STEP 3: Modules */}
          {step === 2 && (
            <div className="space-y-4">
              <Input
                aria-label="Search modules"
                placeholder="Search modules"
                value={moduleSearch}
                onChange={(e) => setModuleSearch(e.target.value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {MODULES.filter((m) => m.name.toLowerCase().includes(moduleSearch.toLowerCase())).map((m) => (
                  <label key={m.key} className="flex gap-3 rounded-md border p-4">
                    <Checkbox
                      checked={selected.includes(m.key)}
                      disabled={m.key === "crm_core"}
                      onCheckedChange={(v) => {
                        if (v) {
                          set("modules", resolveModules([...config.modules, m.key]));
                        } else {
                          const removed = new Set<string>([m.key]);
                          let changed = true;
                          while (changed) {
                            changed = false;
                            MODULES.forEach((x) => {
                              if (x.dependencies.some((d) => removed.has(d)) && !removed.has(x.key)) {
                                removed.add(x.key);
                                changed = true;
                              }
                            });
                          }
                          set("modules", selected.filter((k) => !removed.has(k)));
                        }
                      }}
                    />
                    <span>
                      <span className="block text-sm font-semibold">{m.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{m.detail}</span>
                      <span className="mt-2 block text-xs text-primary">
                        {m.dependencies.length
                          ? `Requires ${m.dependencies.map((k) => MODULES.find((x) => x.key === k)?.name).join(", ")}`
                          : "Always included"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Disabling a module retains its records. Dependencies are included automatically.</p>
            </div>
          )}

          {/* STEP 4: Brand */}
          {step === 3 && (
            <div className="grid gap-5 sm:grid-cols-2">
              {textField("name", "Workspace name")}
              {selectField("Typography", "font", ["System", "Manrope", "Georgia"].map((v) => ({ value: v, label: v })))}
              {textField("primaryColor", "Primary brand color", "color")}
              {textField("accentColor", "Secondary brand color", "color")}
              
              <div className="space-y-2">
                <Label htmlFor="brand-logo">Company logo</Label>
                <Input
                  id="brand-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 350000) {
                      toast.error("Use a logo smaller than 350 KB");
                      return;
                    }
                    const r = new FileReader();
                    r.onload = () => set("logo", String(r.result));
                    r.readAsDataURL(f);
                  }}
                />
                {config.logo && <img src={config.logo} alt="Company logo" className="h-16 w-16 object-contain" />}
              </div>
              
              {textField("recordLabel", "Record name")}
              {textField("recordLabelPlural", "Record name (plural)")}
              {textField("domain", "Requested custom domain")}
              {textField("sender", "Requested email sender")}
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Custom domains and email senders require separate verification. Requests do not activate them.
              </p>
            </div>
          )}

          {/* STEP 5: Team & Automation */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                {textField("seats", "Requested seats", "number")}
                {textField("team", "Initial team name")}
              </div>
              <p className="text-sm text-muted-foreground">
                The signed-in account becomes the owner. Additional users are invited from Teams & Invites; seats are a request, not purchased access.
              </p>
              
              <div>
                <Label>Pipeline stages</Label>
                <div className="mt-2 space-y-2">
                  {config.stages.map((s, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        aria-label={`Stage ${i + 1}`}
                        value={s}
                        onChange={(e) =>
                          set("stages", config.stages.map((x, j) => (i === j ? e.target.value : x)))
                        }
                      />
                      <Button
                        aria-label={`Remove stage ${i + 1}`}
                        disabled={config.stages.length <= 2}
                        variant="ghost"
                        size="icon"
                        onClick={() => set("stages", config.stages.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => set("stages", [...config.stages, "New stage"])}
                >
                  <Plus className="h-4 w-4" /> Add stage
                </Button>
              </div>
              
              <label className="flex gap-3">
                <Checkbox
                  checked={config.agents}
                  disabled={!selected.includes("ai")}
                  onCheckedChange={(v) => set("agents", !!v)}
                />
                <span className="text-sm">Install Sales Agent · needs AI Agents module and approved company policy</span>
              </label>
              
              <label className="flex gap-3">
                <Checkbox
                  checked={config.workflows}
                  disabled={!selected.includes("workflow")}
                  onCheckedChange={(v) => set("workflows", !!v)}
                />
                <span className="text-sm">Include template follow-up workflows · click-to-send messages only</span>
              </label>
              
              <div className="border-t pt-4">
                <Label>Requested integrations · connection required</Label>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {["Google Sheets", "Google Calendar", "HubSpot", "Salesforce", "WhatsApp", "Notion"].map((x) => (
                    <label key={x} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={config.integrations.includes(x)}
                        onCheckedChange={(v) =>
                          set(
                            "integrations",
                            v ? [...config.integrations, x] : config.integrations.filter((y) => y !== x)
                          )
                        }
                      />
                      {x}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Review */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="border-b pb-5">
                <h3 className="text-lg font-semibold">{config.name || "Your workspace"}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {base?.name} · {country?.name} · {config.currency} · {config.timezone}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {config.stages.map((s, i) => (
                    <Badge variant="outline" key={i}>{s}</Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold">Workspace menu preview</h3>
                <div className="mt-3 divide-y border-y">
                  {selected.map((k) => (
                    <div className="flex items-center justify-between py-3 text-sm" key={k}>
                      <span>{MODULES.find((m) => m.key === k)?.name}</span>
                      <Check className="h-4 w-4 text-success" />
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold">Plan review</h3>
                <p className="mt-2 text-sm">
                  Pricing requires confirmation · {country?.name} ({country?.currency})
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {config.seats} requested seat{config.seats === 1 ? "" : "s"}. AI usage and additional seats are not priced. No subscription purchase is processed. Workspace starts on Lite; additional commercial entitlements need approval.
                </p>
              </div>
              
              <div className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
                <span>Payments: manual transfer / reference</span>
                <span>WhatsApp: click-to-send</span>
                <span>Hosting region: existing deployment</span>
                <span>Email / custom domain: setup required</span>
                <span>Interface: English</span>
                <span>Integrations: not connected by selection</span>
              </div>
              <p className="text-sm text-muted-foreground">
                No invented customers will be added. Roles, forms and approvals can be configured after launch using the existing workspace tools.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-wrap justify-between gap-3 border-t pt-5">
            <Button variant="ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            
            {step < 5 ? (
              <Button onClick={() => setStep((s) => s + 1)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button disabled={busy} onClick={handleLaunch}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {busy ? "Launching..." : "Launch workspace"}
              </Button>
            )}
          </div>
        </section>

        {/* Right Sidebar */}
        <aside className="h-fit space-y-5 rounded-md border bg-card p-5 lg:sticky lg:top-24">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h3 className="wrap-break-word text-lg font-semibold">{config.name || "Your business CRM"}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{country?.name} · {base?.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 border-y py-4">
            <div>
              <span className="text-2xl font-bold">{selected.length}</span>
              <p className="text-xs text-muted-foreground">Modules</p>
            </div>
            <div>
              <span className="text-2xl font-bold">{config.seats}</span>
              <p className="text-xs text-muted-foreground">Requested seats</p>
            </div>
          </div>
          <div className="space-y-2">
            {selected.map((k) => (
              <p className="flex gap-2 text-sm" key={k}>
                <Check className="h-4 w-4 shrink-0 text-success" />
                {MODULES.find((m) => m.key === k)?.name}
              </p>
            ))}
          </div>
          <p className="flex gap-2 border-t pt-4 text-xs text-muted-foreground">
            <Globe2 className="h-4 w-4 shrink-0" /> Worldwide configuration · service availability varies
          </p>
        </aside>
      </div>
    </div>
  );
}