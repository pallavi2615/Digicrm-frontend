import { supabaseRestGet, supabaseRestInsert } from "@/lib/supabase-rest";

export type CmsPageBlock = {
  type: string;
  text?: string;
  label?: string;
  url?: string;
  image?: string;
  items?: Array<{ title?: string; text?: string; q?: string; a?: string }>;
};

export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  seo_keywords: string | null;
  og_image: string | null;
  canonical_override: string | null;
  noindex: boolean;
  hero: { headline?: string; subhead?: string; image?: string } | null;
  body: CmsPageBlock[] | null;
  published_at: string | null;
  updated_at: string;
};

export type CmsPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body?: string;
  cover_image: string | null;
  tags: string[];
  reading_minutes: number;
  published_at: string | null;
  author_name: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_image?: string | null;
  updated_at?: string | null;
  canonical_url?: string | null;
  noindex?: boolean | null;
};

export type CmsHomeSlide = {
  id: string;
  headline: string;
  subhead: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  sort_order: number;
  active?: boolean;
};

export type CmsMenuItem = {
  id: string;
  location: "header" | "footer";
  label: string;
  url: string;
  sort_order: number;
  group_label: string | null;
  active?: boolean;
};

export type CmsSeoSettings = {
  site_name: string;
  default_title: string;
  default_description: string;
  default_og_image: string | null;
  twitter_handle: string | null;
  ga_id: string | null;
  gtm_id: string | null;
  meta_pixel_id: string | null;
  robots_default: string;
};

export type CmsCampaign = {
  id: string;
  slug: string;
  headline: string;
  subhead: string | null;
  hero_image: string | null;
  benefits: string[];
  cta_label: string;
  form_fields: string[];
  thank_you_message: string;
  theme: string;
  active?: boolean;
};

// Public CMS requests use Axios against the same read-only Supabase REST interface
// used by the former server handlers. This keeps pages working where the FastAPI API
// currently exposes only admin-protected listing endpoints.
export async function listPublishedPosts(): Promise<CmsPost[]> {
  return supabaseRestGet<CmsPost>("cms_posts", {
    select: "id,slug,title,excerpt,cover_image,tags,reading_minutes,published_at,author_name",
    status: "eq.published",
    order: "published_at.desc",
    limit: 50,
  });
}

export async function getPostBySlug(input: { slug: string }): Promise<CmsPost | null> {
  if (!input?.slug) throw new Error("slug required");
  const rows = await supabaseRestGet<CmsPost>("cms_posts", {
    select: "*", slug: `eq.${input.slug}`, status: "eq.published", limit: 1,
  });
  return rows[0] ?? null;
}

export async function listHomeSlides(): Promise<CmsHomeSlide[]> {
  return supabaseRestGet<CmsHomeSlide>("cms_home_slides", {
    select: "id,headline,subhead,image_url,cta_label,cta_url,sort_order",
    active: "eq.true",
    order: "sort_order.asc",
  });
}

export async function listMenuItems(): Promise<CmsMenuItem[]> {
  return supabaseRestGet<CmsMenuItem>("cms_menu_items", {
    select: "id,location,label,url,sort_order,group_label",
    active: "eq.true",
    order: "sort_order.asc",
  });
}

export async function getSeoSettings(): Promise<CmsSeoSettings | null> {
  const rows = await supabaseRestGet<CmsSeoSettings>("cms_seo_settings", {
    select: "*", id: "eq.global", limit: 1,
  });
  return rows[0] ?? null;
}

export async function getCampaignBySlug(input: { slug: string }): Promise<CmsCampaign | null> {
  if (!input?.slug) throw new Error("slug required");
  const rows = await supabaseRestGet<CmsCampaign>("cms_campaigns", {
    select: "*", slug: `eq.${input.slug}`, active: "eq.true", limit: 1,
  });
  return rows[0] ?? null;
}

export async function submitContact(input: {
  name: string; email: string; company?: string; phone?: string; message?: string;
  source?: string; ref?: string; utm?: Record<string, string>;
}) {
  if (!input?.name || !input?.email) throw new Error("name and email required");
  if (input.name.length > 200 || input.email.length > 200) throw new Error("input too long");
  if (input.message && input.message.length > 5000) throw new Error("message too long");
  await supabaseRestInsert("contact_submissions", {
    name: input.name,
    email: input.email,
    company: input.company ?? null,
    phone: input.phone ?? null,
    message: input.message ?? null,
    source: input.source ?? "contact",
    utm: { ...(input.utm ?? {}), ...(input.ref ? { ref: String(input.ref).slice(0, 32) } : {}) },
  });
  return { ok: true };
}

export async function submitAffiliate(input: {
  name: string; email: string; company?: string; audience?: string; channels?: string; payout_method?: string;
}) {
  if (!input?.name || !input?.email) throw new Error("name and email required");
  const code = "AF" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const settings = await supabaseRestGet<{ default_commission_pct?: number }>("affiliate_settings", {
    select: "default_commission_pct", id: "eq.default", limit: 1,
  });
  const pct = settings[0]?.default_commission_pct ?? 20;
  await supabaseRestInsert("affiliates", {
    name: input.name,
    email: input.email,
    company: input.company ?? null,
    audience: input.audience ?? null,
    channels: input.channels ?? null,
    payout_method: input.payout_method ?? null,
    referral_code: code,
    commission_pct: pct,
  });
  return { ok: true, referral_code: code };
}

export async function listPublishedPages(): Promise<Array<{ slug: string; updated_at: string }>> {
  return supabaseRestGet<{ slug: string; updated_at: string }>("cms_pages", {
    select: "slug,updated_at", status: "eq.published",
  });
}

export async function getPageBySlug(input: { slug: string }): Promise<CmsPage | null> {
  if (!input?.slug) throw new Error("slug required");
  const rows = await supabaseRestGet<CmsPage>("cms_pages", {
    select: "*", slug: `eq.${input.slug}`, status: "eq.published", limit: 1,
  });
  return rows[0] ?? null;
}
