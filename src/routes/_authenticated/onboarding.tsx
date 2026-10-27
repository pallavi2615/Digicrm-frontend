import { defineRoute, useNavigate } from "@/lib/router-compat";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { notifyAuthChanged } from "@/hooks/use-auth";

export const Route = defineRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your workspace | DigiCRM AI" },
      { name: "description", content: "Configure your workspace and launch your CRM." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

// POST /api/v1/onboarding/launch
type LaunchPayload = {
  workspace_name: string;
  industry: string;
  business_type: string;
  currency: string;
  timezone: string;
  language: string;
  modules: string[];
};
type LaunchResponse = { status: string; message: string; redirect_url: string };

const ONBOARDING_FLAG = "requires_onboarding";

// `value` should match Industry.key in your database.
const INDUSTRIES = [
  { value: "real_estate", label: "Real Estate" },
  { value: "it_company", label: "IT / Software Company" },
  { value: "coaching", label: "Coaching & Education" },
  { value: "healthcare", label: "Healthcare / Clinic" },
  { value: "finance", label: "Finance & Loans" },
  { value: "retail", label: "Retail & E-commerce" },
  { value: "hospitality", label: "Hospitality & Restaurants" },
  { value: "fitness", label: "Fitness & Wellness" },
  { value: "other", label: "Other" },
];

const BUSINESS_TYPES = ["B2B", "B2C", "B2B2C", "Services / Agency", "Marketplace", "Other"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY"];
const LANGUAGES = ["English", "Hindi", "Spanish", "French", "German", "Arabic"];
const TIMEZONES = [
  "Asia/Kolkata", "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney",
];

const MODULES = [
  { key: "leads", label: "Leads", desc: "Capture and score leads" },
  { key: "contacts", label: "Contacts", desc: "People you work with" },
  { key: "companies", label: "Companies", desc: "Organisation records" },
  { key: "pipeline", label: "Pipeline", desc: "Deal stages and board" },
  { key: "follow_ups", label: "Follow-ups", desc: "Reminders and next steps" },
  { key: "tasks", label: "Tasks", desc: "Team to-dos" },
  { key: "calendar", label: "Calendar", desc: "Schedule and events" },
  { key: "meetings", label: "Meetings", desc: "Meeting notes and links" },
  { key: "tickets", label: "Tickets", desc: "Support requests" },
  { key: "proposals", label: "Proposals", desc: "Quotes and proposals" },
  { key: "automation", label: "Automation", desc: "Rules and workflows" },
  { key: "reports", label: "Reports", desc: "Dashboards and analytics" },
  { key: "ai_assistant", label: "AI Assistant", desc: "Built-in assistant" },
  { key: "affiliates", label: "Affiliates", desc: "Partner tracking" },
];
const DEFAULT_MODULES = ["leads", "contacts", "companies", "pipeline", "follow_ups", "tasks", "reports"];

const STEPS = ["Your business", "Region & language", "Modules"];

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return tz === "Asia/Calcutta" ? "Asia/Kolkata" : tz;
  } catch {
    return "UTC";
  }
}

function storedTenantName(): string {
  try {
    const t = JSON.parse(localStorage.getItem("tenant") || "null");
    const n: string = t?.name ?? "";
    return n && n !== "Platform Admin" ? n : "";
  } catch {
    return "";
  }
}

function NativeSelect({
  id, value, onChange, children,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {children}
    </select>
  );
}

function Onboarding() {
  const navigate = useNavigate();

  const detectedTz = useMemo(detectTimezone, []);
  const timezoneOptions = useMemo(
    () => (TIMEZONES.includes(detectedTz) ? TIMEZONES : [detectedTz, ...TIMEZONES]),
    [detectedTz],
  );

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [workspaceName, setWorkspaceName] = useState(storedTenantName);
  const [industry, setIndustry] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [currency, setCurrency] = useState(detectedTz === "Asia/Kolkata" ? "INR" : "USD");
  const [timezone, setTimezone] = useState(detectedTz);
  const [language, setLanguage] = useState("English");
  const [modules, setModules] = useState<string[]>(DEFAULT_MODULES);

  // Must be signed in to be here
  useEffect(() => {
    if (!localStorage.getItem("access_token")) {
      navigate({ to: "/auth" as any, replace: true } as any);
    }
  }, [navigate]);

  const toggleModule = (key: string) =>
    setModules((xs) => (xs.includes(key) ? xs.filter((x) => x !== key) : [...xs, key]));

  const canNext =
    step === 0
      ? workspaceName.trim().length >= 2 && !!industry && !!businessType
      : step === 1
        ? !!currency && !!timezone && !!language
        : modules.length > 0;

  // After a successful launch: refresh cached session data, then go to the CRM
  const finishOnboarding = async (redirectUrl?: string) => {
    const token = localStorage.getItem("access_token") ?? "";

    try {
      const p = await apiFetch("/api/v1/auth/my-permissions", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      localStorage.setItem("permissions", JSON.stringify(p));
      const active = p?.is_super_admin ? null : p?.industries?.[0] ?? null;
      if (active) localStorage.setItem("active_industry", active);
      else localStorage.removeItem("active_industry");
    } catch (err) {
      console.error("Failed to refresh permissions:", err);
    }

    try {
      const t = JSON.parse(localStorage.getItem("tenant") || "null");
      if (t) localStorage.setItem("tenant", JSON.stringify({ ...t, name: workspaceName.trim() }));
    } catch {
      /* ignore */
    }

    localStorage.removeItem(ONBOARDING_FLAG);
    notifyAuthChanged();

    const to = redirectUrl && redirectUrl.startsWith("/") ? redirectUrl : "/dashboard";
    navigate({ to: to as any, replace: true } as any);
  };

  const launch = async () => {
    setSubmitting(true);
    try {
      const body: LaunchPayload = {
        workspace_name: workspaceName.trim(),
        industry,
        business_type: businessType,
        currency,
        timezone,
        language,
        modules,
      };
      const res = (await apiFetch("/api/v1/onboarding/launch", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}` },
        body: JSON.stringify(body),
      })) as LaunchResponse;

      toast.success(res?.message || "Your CRM is ready");
      await finishOnboarding(res?.redirect_url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Could not launch your CRM";
      // Already launched earlier (e.g. double click / second device) -> just continue
      if (/already onboarded/i.test(msg)) {
        await finishOnboarding();
        return;
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const industryLabel = INDUSTRIES.find((i) => i.value === industry)?.label ?? "—";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Set up your workspace</h1>
        <p className="text-sm text-muted-foreground">
          Three short steps, then we launch your CRM. You can change these later in settings.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((label, i) => (
          <Badge key={label} variant={i === step ? "default" : i < step ? "secondary" : "outline"} className="gap-1">
            {i < step && <Check className="h-3 w-3" />}
            {i + 1}. {label}
          </Badge>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tell us about your business</CardTitle>
            <CardDescription>This name appears across your workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Apex Finserv"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <NativeSelect id="industry" value={industry} onChange={setIndustry}>
                <option value="" disabled>Select your industry</option>
                {INDUSTRIES.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="btype">Business type</Label>
              <NativeSelect id="btype" value={businessType} onChange={setBusinessType}>
                <option value="" disabled>Select business type</option>
                {BUSINESS_TYPES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </NativeSelect>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Region & language</CardTitle>
            <CardDescription>Used for amounts, dates and reminders.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <NativeSelect id="currency" value={currency} onChange={setCurrency}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz">Timezone</Label>
              <NativeSelect id="tz" value={timezone} onChange={setTimezone}>
                {timezoneOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lang">Language</Label>
              <NativeSelect id="lang" value={language} onChange={setLanguage}>
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </NativeSelect>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Choose your modules</CardTitle>
              <CardDescription>Pick what your team needs. You can turn more on later.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODULES.map((m) => {
                  const on = modules.includes(m.key);
                  return (
                    <button
                      type="button"
                      key={m.key}
                      onClick={() => toggleModule(m.key)}
                      aria-pressed={on}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        on ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                        }`}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{m.label}</span>
                        <span className="block text-xs text-muted-foreground">{m.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {modules.length === 0 && (
                <p className="mt-3 text-xs text-destructive">Select at least one module.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Workspace: </span>{workspaceName.trim()}</div>
              <div><span className="text-muted-foreground">Industry: </span>{industryLabel}</div>
              <div><span className="text-muted-foreground">Business type: </span>{businessType}</div>
              <div><span className="text-muted-foreground">Currency: </span>{currency}</div>
              <div><span className="text-muted-foreground">Timezone: </span>{timezone}</div>
              <div><span className="text-muted-foreground">Language: </span>{language}</div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Modules: </span>{modules.length} selected
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Continue<ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!canNext || submitting} onClick={launch}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            Launch CRM
          </Button>
        )}
      </div>
    </div>
  );
}