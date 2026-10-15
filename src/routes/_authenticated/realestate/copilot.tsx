/**
 * AI Sales Copilot — conversational assistant placeholder.
 *
 * This page is ready for integration with a real LLM endpoint. Until
 * that endpoint exists, the page accepts the question, forwards it to
 * the `/realestate/analytics` data, and displays a templated response.
 */

import { defineRoute } from "@/lib/router-compat";
import { useState } from "react";
import { useQuery } from "@/lib/react-data-client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { getAnalytics } from "@/lib/realestate.functions";
import { cr } from "@/lib/re-data";

export const Route = defineRoute("/_authenticated/realestate/copilot")({
  head: () => ({ meta: [{ title: "AI Sales Copilot | Real Estate CRM" }] }),
  component: CopilotPage,
});

const SUGGESTIONS = [
  "Which leads should I call first?",
  "Show me all hot leads.",
  "Which projects have the highest unsold inventory?",
  "Why are bookings down this month?",
];

function CopilotPage() {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: analytics } = useQuery({
    queryKey: ["re-analytics"],
    queryFn: getAnalytics,
  });

  const answer = (question: string): string => {
    if (!analytics) return "I don't have analytics yet.";
    const k = analytics.kpis;
    const lower = question.toLowerCase();

    if (lower.includes("hot")) {
      return `You have ${k.hot_leads} hot leads in the pipeline. Total leads: ${k.total_leads}.`;
    }
    if (lower.includes("booking")) {
      return `Bookings: ${k.bookings}. Booking value: ${cr(k.booking_value)}. Visit-to-booking rate: ${k.visit_to_booking_pct ?? "n/a"}%.`;
    }
    if (lower.includes("collect") || lower.includes("outstanding")) {
      return `Collected: ${cr(k.collected)}. Outstanding: ${cr(k.outstanding)}.`;
    }
    return `Summary — Leads: ${k.total_leads}, Visits: ${k.site_visits_done}, Bookings: ${k.bookings}, GMV: ${cr(k.booking_value)}.`;
  };

  const ask = async (question = q) => {
    if (!question.trim()) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 400));
    const a = answer(question);
    setLog([{ q: question, a }, ...log]);
    setQ("");
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Sales Copilot</CardTitle>
          <CardDescription>
            Ask about your leads, visits, inventory and collections.
            Answers are based on live CRM analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            rows={2}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask a question…"
          />
          <div className="flex flex-wrap gap-1">
            {SUGGESTIONS.map((s) => (
              <Button key={s} size="sm" variant="outline" onClick={() => ask(s)} disabled={busy}>
                {s}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={() => ask()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Ask
          </Button>
          {log.map((l, i) => (
            <div key={i} className="border-t pt-2">
              <div className="font-medium text-sm">{l.q}</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{l.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}