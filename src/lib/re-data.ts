/**
 * Real Estate CRM — shared frontend utilities.
 *
 * Provides currency formatters, WhatsApp link builder, and a typed
 * config fetcher used across the CRM pages.
 */

export interface ReConfig {
  deal_stages: string[];
  lead_sources: string[];
  lead_temperatures: string[];
  lead_statuses: string[];
  lost_reasons: string[];
  followup_kinds: string[];
  intents: string[];
  segments: string[];
  purposes: string[];
  property_types: string[];
  property_statuses: string[];
  inventory_statuses: string[];
  construction_statuses: string[];
  furnishing: string[];
  facings: string[];
  listing_types: string[];
  visit_statuses: string[];
  payment_statuses: string[];
  document_statuses: string[];
  document_types: string[];
  kyc_statuses: string[];
  loan_statuses: string[];
  commission_statuses: string[];
}

// ---------------------------------------------------------------------------
// FORMATTERS
// ---------------------------------------------------------------------------
export const inr = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

export const cr = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2)} L`;
  return inr(v);
};

export const fmt = (n: number): string => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
};

export const today = (): string => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// WHATSAPP
// ---------------------------------------------------------------------------
export const waLink = (phone: string | null | undefined, message: string): string => {
  const clean = (phone || "").replace(/\D/g, "");
  const withCountry = clean.startsWith("91") ? clean : `91${clean}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
};

// ---------------------------------------------------------------------------
// STATUS TONES
// ---------------------------------------------------------------------------
export const TEMP_TONE: Record<string, string> = {
  Hot: "bg-red-100 text-red-700 border-red-200",
  Warm: "bg-amber-100 text-amber-700 border-amber-200",
  Cold: "bg-gray-100 text-gray-700 border-gray-200",
};

export const INV_TONE: Record<string, string> = {
  Available: "border-emerald-300 bg-emerald-50",
  Hold: "border-amber-300 bg-amber-50",
  "Token Received": "border-blue-300 bg-blue-50",
  Booked: "border-purple-300 bg-purple-50",
  Sold: "border-gray-300 bg-gray-100",
};

// ---------------------------------------------------------------------------
// MATCH SCORE (client-side helper)
// ---------------------------------------------------------------------------
export interface MatchReq {
  budget_min?: number | null;
  budget_max?: number | null;
  city?: string | null;
  location?: string | null;
  bhk?: number | null;
  size_min?: number | null;
  possession?: string | null;
}

export interface MatchUnit {
  price: number;
  city?: string | null;
  location?: string | null;
  bhk?: number | null;
  super_area?: number | null;
  area_sqft?: number | null;
  construction_status?: string | null;
  possession_date?: string | null;
}

export function matchScore(req: MatchReq, unit: MatchUnit) {
  const checks: { label: string; ok: boolean }[] = [];
  let score = 0;
  let total = 0;

  const push = (label: string, ok: boolean, weight = 1) => {
    checks.push({ label, ok });
    total += weight;
    if (ok) score += weight;
  };

  if (req.budget_min || req.budget_max) {
    const price = Number(unit.price || 0);
    const minOk = !req.budget_min || price >= req.budget_min;
    const maxOk = !req.budget_max || price <= req.budget_max;
    push("Budget", minOk && maxOk, 3);
  }
  if (req.city) push("City", (unit.city || "").toLowerCase() === req.city.toLowerCase(), 2);
  if (req.location) push("Location", (unit.location || "").toLowerCase().includes(req.location.toLowerCase()), 1);
  if (req.bhk) push("BHK", Number(unit.bhk || 0) === req.bhk, 2);
  if (req.size_min) {
    const area = Number(unit.super_area || unit.area_sqft || 0);
    push("Size", area >= req.size_min, 1);
  }
  if (req.possession) {
    const have = (unit.construction_status || "").toLowerCase();
    push("Possession", have.includes(req.possession.toLowerCase()), 1);
  }

  const pct = total ? Math.round((score / total) * 100) : 0;
  return { score: pct, checks };
}