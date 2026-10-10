// Brand Portal API — uses the shared apiFetch (auth header, token refresh, ngrok header, error parsing).
// Change the import path if your api.ts lives elsewhere (e.g. "@/lib/api" or "@/services/api").
import { apiFetch } from "@/lib/api";

// All brand routes live under this prefix (same /api/v1 as /api/v1/auth/*).
// If your brand router is mounted at a different prefix, change only this line.
const BASE = "/api/v1/brand";

const get = <T>(path: string) => apiFetch<T>(`${BASE}${path}`);
const post = <T>(path: string, body: unknown) =>
  apiFetch<T>(`${BASE}${path}`, { method: "POST", body: JSON.stringify(body) });

// ---------- Types ----------
export type BrandAccount = { company: string; contact_name?: string | null; website?: string | null; category?: string | null };
export type BrandAccountResponse = { account: BrandAccount | null; email: string };

export type BrandCampaignCard = {
  id: string;
  campaign: string;
  platform: string | null;
  stage: string;
  value: number | string;
  approved: number;
  total: number;
  pending: number;
  creator_profiles?: { display_name: string } | null;
};

export type MarketplaceCreator = {
  id: string; display_name: string; handle: string; niche: string | null; location: string | null;
  bio: string | null; avatar_url: string | null; categories: string[]; followers: number; engagement_rate: number;
};
export type MarketplaceResponse = { creators: MarketplaceCreator[]; categories: string[] };

export type CampaignComment = {
  id: string; deliverable_id: string | null; author_role: string; author_name: string | null; body: string; created_at: string;
};

export type MyCampaign = { id: string; title: string; status: string; budget: number | string | null };
export type CampaignApplication = {
  id: string; campaign_id: string; status: string; pitch: string | null; quote: number | string | null; deal_id: string | null;
  creator_profiles: { display_name: string; handle: string; followers: number; engagement_rate: number } | null;
};
export type MyCampaignsResponse = { campaigns: MyCampaign[]; applications: CampaignApplication[] };

export type Deliverable = {
  id: string; quantity: number; content_type: string; platform: string | null; status: string;
  due_date: string | null; revision_count: number | null; posted_at: string | null;
  reach: number; views: number; engagements: number; clicks: number; conversions: number;
  caption: string | null; script: string | null; draft_url: string | null;
};
export type DealInvoice = { id: string; number: string; amount: number | string; tax_pct: number | string; due_date: string | null; status: string };
export type DealDetail = {
  deal: {
    id: string; campaign: string; platform: string | null; stage: string; value: number | string;
    start_date: string | null; end_date: string | null; objective: string | null; usage_rights: string | null; exclusivity: string | null;
    creator_profiles?: { display_name: string } | null;
  } | null;
  deliverables: Deliverable[];
  comments: CampaignComment[];
  invoices: DealInvoice[];
};

// ---------- Normalizers ----------
// Make the UI render the same even if the API returns nulls, numeric strings or slightly different key names.
/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: unknown) => Number(v) || 0;
const arr = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);
const profileOf = (o: any) => o?.creator_profiles ?? o?.creator_profile ?? o?.creator ?? null;

const normCard = (d: any): BrandCampaignCard => ({
  ...d,
  value: num(d.value),
  total: num(d.total),
  pending: num(d.pending),
  approved: num(d.approved),
  creator_profiles: profileOf(d),
});

const normCreator = (c: any): MarketplaceCreator => ({
  ...c,
  categories: arr(c.categories),
  followers: num(c.followers),
  engagement_rate: num(c.engagement_rate),
});

const normApplication = (a: any): CampaignApplication => {
  const p = profileOf(a);
  return {
    ...a,
    campaign_id: a.campaign_id ?? a.campaignId,
    deal_id: a.deal_id ?? a.dealId ?? null,
    creator_profiles: p ? { ...p, followers: num(p.followers), engagement_rate: num(p.engagement_rate) } : null,
  };
};

const normDeliverable = (v: any): Deliverable => ({
  ...v,
  quantity: num(v.quantity) || 1,
  revision_count: num(v.revision_count),
  reach: num(v.reach),
  views: num(v.views),
  engagements: num(v.engagements),
  clicks: num(v.clicks),
  conversions: num(v.conversions),
});

// ---------- Endpoints ----------
export const brandApi = {
  // Account
  getAccount: () => get<BrandAccountResponse>("/account"),
  saveAccount: (data: { company: string; contact_name: string; website: string; category: string }) =>
    post<{ ok: boolean }>("/account", data),

  // My campaigns (index)
  listCampaignCards: async (): Promise<BrandCampaignCard[]> =>
    arr(await get<any[]>("/campaigns/list")).map(normCard),

  // Marketplace
  searchMarketplace: async (p: { q: string; category: string; minFollowers: number; minEngagement: number; sort: string }): Promise<MarketplaceResponse> => {
    const qs = new URLSearchParams({
      q: p.q, category: p.category, minFollowers: String(p.minFollowers),
      minEngagement: String(p.minEngagement), sort: p.sort,
    });
    const r = await get<any>(`/marketplace?${qs}`);
    return { creators: arr(r?.creators).map(normCreator), categories: arr(r?.categories) };
  },
  sendBrief: (data: { creatorId: string; campaign: string; budget: number | null; platform: string; deadline: string; brief: string }) =>
    post<{ dealId: string }>("/briefs", data),

  // Post a campaign
  myCampaigns: async (): Promise<MyCampaignsResponse> => {
    const r = await get<any>("/my-campaigns");
    return { campaigns: arr(r?.campaigns), applications: arr(r?.applications).map(normApplication) };
  },
  createCampaign: (data: { title: string; brief: string; budget: number | null; platform: string; category: string; min_followers: number; deadline: string }) =>
    post<{ id: string; ok: boolean }>("/campaigns", data),
  setCampaignStatus: (data: { id: string; status: string }) =>
    post<{ ok: boolean; id: string; status: string }>("/campaigns/status", data),
  decideApplication: (data: { id: string; decision: "Accepted" | "Shortlisted" | "Declined" }) =>
    post<{ ok: boolean; id: string; status: string }>("/applications/decide", data),

  // Deal detail
  getDeal: async (id: string): Promise<DealDetail> => {
    const r = await get<any>(`/campaigns/${encodeURIComponent(id)}`);
    return {
      deal: r?.deal ? { ...r.deal, value: num(r.deal.value), creator_profiles: profileOf(r.deal) } : null,
      deliverables: arr(r?.deliverables).map(normDeliverable),
      comments: arr(r?.comments),
      invoices: arr(r?.invoices),
    };
  },
  actOnDeliverable: (data: { dealId: string; deliverableId: string; action: "approve" | "revise"; comment: string }) =>
    post<unknown>("/deliverables/action", data),
  comment: (data: { dealId: string; deliverableId?: string; body: string }) => post<unknown>("/comments", data),
};