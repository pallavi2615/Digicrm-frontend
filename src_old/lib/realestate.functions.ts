/**
 * Real Estate CRM — client-side API surface.
 *
 * Thin wrappers around the FastAPI endpoints. Every function returns
 * a typed promise so components can rely on the response shape.
 */

import { apiFetch } from "@/lib/api";

// ---------------------------------------------------------------------------
// TYPES (unchanged — same as before)
// ---------------------------------------------------------------------------
export interface Project {
  id: number;
  uuid: string;
  name: string;
  developer?: string | null;
  city?: string | null;
  location?: string | null;
  rera_number?: string | null;
  project_type?: string | null;
  total_units?: number | null;
  towers?: number | null;
  floors?: number | null;
  amenities?: string | null;
  payment_plans?: string | null;
  brochure_url?: string | null;
  possession_date?: string | null;
  price_min?: string | null;
  price_max?: string | null;
  created_at: string;
}

export interface Property {
  id: number;
  uuid: string;
  project_id?: number | null;
  title: string;
  tower?: string | null;
  floor_no?: number | null;
  unit_no?: string | null;
  property_type?: string | null;
  bhk?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  balconies?: number | null;
  carpet_area?: string | null;
  super_area?: string | null;
  area_sqft?: string | null;
  facing?: string | null;
  furnishing?: string | null;
  parking?: number | null;
  construction_status?: string | null;
  price: string;
  city?: string | null;
  location?: string | null;
  rera_number?: string | null;
  possession_date?: string | null;
  inventory_status: string;
  status: string;
  listing_type?: string | null;
  images?: any[];
  created_at: string;
}

export interface Client {
  id: number;
  uuid: string;
  full_name: string;
  phone?: string | null;
  alt_phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  source?: string | null;
  intent?: string | null;
  segment?: string | null;
  preferred_city?: string | null;
  preferred_location?: string | null;
  bhk?: number | null;
  budget_min?: string | null;
  budget_max?: string | null;
  status: string;
  temperature?: string | null;
  lost_reason?: string | null;
  assigned_team?: string | null;
  agent_id?: number | null;
  kyc_status: string;
  kyc_documents?: any[];
  ai_score?: number | null;
  ai_score_reason?: string | null;
  last_contacted_at?: string | null;
  created_at: string;
}

export interface Deal {
  id: number;
  uuid: string;
  client_id?: number | null;
  property_id?: number | null;
  project_id?: number | null;
  buyer_user_id?: number | null;
  buyer_email?: string | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  property_title?: string | null;
  property_tower?: string | null;
  property_unit_no?: string | null;
  property_location?: string | null;
  property_city?: string | null;
  expected_value: string;
  final_value: string;
  discount: string;
  discount_pct: string;
  booking_amount: string;
  stage: string;
  doc_status: string;
  channel_partner_id?: number | null;
  agent_id?: number | null;
  owner_id?: number | null;
  booking_date?: string | null;
  closed_at?: string | null;
  next_action_at?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface SiteVisit {
  id: number;
  uuid: string;
  client_id?: number | null;
  property_id?: number | null;
  project_id?: number | null;
  deal_id?: number | null;
  scheduled_at?: string | null;
  checkin_at?: string | null;
  checkout_at?: string | null;
  status: string;
  interest?: number | null;
  feedback?: Record<string, any>;
  notes?: string | null;
  next_action?: string | null;
  ai_summary?: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  uuid: string;
  deal_id: number;
  milestone: string;
  amount: string;
  paid_amount: string;
  due_date?: string | null;
  paid_on?: string | null;
  reference?: string | null;
  status: string;
  reported_at?: string | null;
  reported_amount?: string | null;
  reported_ref?: string | null;
  confirmed_at?: string | null;
  notes?: string | null;
}

export interface Document {
  id: number;
  uuid: string;
  deal_id: number;
  doc_type: string;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  status: string;
  verified_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface ChannelPartner {
  id: number;
  uuid: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  rera_number?: string | null;
  specialization?: string | null;
  commission_pct: string;
  is_active: boolean;
  created_at: string;
}

export interface Commission {
  id: number;
  deal_id: number;
  partner_id: number;
  booking_value: string;
  pct: string;
  amount: string;
  tds_pct: string;
  status: string;
  paid_on?: string | null;
  reference?: string | null;
  created_at: string;
}

export interface Followup {
  id: number;
  client_id: number;
  kind: string;
  due_at?: string | null;
  done: boolean;
  done_at?: string | null;
  notes?: string | null;
  owner_id?: number | null;
  created_at: string;
}

export interface Dashboard {
  active_listings: number;
  total_listings: number;
  total_clients: number;
  kyc_verified: number;
  deals_won: number;
  total_deals: number;
  gmv_closed: number;
  site_visits: number;
  visit_to_close_pct: number;
  avg_ticket_size: number;
  kyc_verified_pct: number;
  listings_by_status: Record<string, number>;
  inventory_by_type: Record<string, number>;
  deals_by_stage: Record<string, number>;
}

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------
export const getDashboard = () =>
  apiFetch<Dashboard>("/api/v1/realestate/dashboard");

export const getAnalytics = () =>
  apiFetch<any>("/api/v1/realestate/analytics");

// ---------------------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------------------
export const listProjects = () =>
  apiFetch<Project[]>("/api/v1/realestate/projects");

export const createProject = (body: Partial<Project>) =>
  apiFetch<Project>("/api/v1/realestate/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateProject = (id: number, body: Partial<Project>) =>
  apiFetch<Project>(`/api/v1/realestate/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteProject = (id: number) =>
  apiFetch<void>(`/api/v1/realestate/projects/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// PROPERTIES
// ---------------------------------------------------------------------------
export const listProperties = (params?: Record<string, any>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<Property[]>(`/api/v1/realestate/properties${qs}`);
};

export const getProperty = (id: number) =>
  apiFetch<Property>(`/api/v1/realestate/properties/${id}`);

export const createProperty = (body: Partial<Property>) =>
  apiFetch<Property>("/api/v1/realestate/properties", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateProperty = (id: number, body: Partial<Property>) =>
  apiFetch<Property>(`/api/v1/realestate/properties/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const updateInventoryStatus = (id: number, status: string) =>
  apiFetch<Property>(
    `/api/v1/realestate/properties/${id}/inventory-status?status=${status}`,
    { method: "PATCH" }
  );

export const deleteProperty = (id: number) =>
  apiFetch<void>(`/api/v1/realestate/properties/${id}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// LEADS
// ---------------------------------------------------------------------------
export const listLeads = (params?: Record<string, any>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<Client[]>(`/api/v1/realestate/leads${qs}`);
};

export const getLead = (id: number) =>
  apiFetch<Client>(`/api/v1/realestate/leads/${id}`);

export const createLead = (body: Partial<Client>) =>
  apiFetch<Client>("/api/v1/realestate/leads", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateLead = (id: number, body: Partial<Client>) =>
  apiFetch<Client>(`/api/v1/realestate/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const deleteLead = (id: number) =>
  apiFetch<void>(`/api/v1/realestate/leads/${id}`, { method: "DELETE" });

export const assignLead = (id: number, agentId: number) =>
  apiFetch<Client>(`/api/v1/realestate/leads/${id}/assign?agent_id=${agentId}`, {
    method: "POST",
  });

// ---------------------------------------------------------------------------
// FOLLOW-UPS
// ---------------------------------------------------------------------------
export const listFollowups = (params?: Record<string, any>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<Followup[]>(`/api/v1/realestate/followups${qs}`);
};

export const createFollowup = (body: Partial<Followup>) =>
  apiFetch<Followup>("/api/v1/realestate/followups", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const completeFollowup = (id: number) =>
  apiFetch<Followup>(`/api/v1/realestate/followups/${id}/complete`, {
    method: "POST",
  });

// ---------------------------------------------------------------------------
// DEALS
// ---------------------------------------------------------------------------
export const listDeals = (params?: Record<string, any>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<Deal[]>(`/api/v1/realestate/deals${qs}`);
};

export const getDeal = (id: number) =>
  apiFetch<Deal>(`/api/v1/realestate/deals/${id}`);

export const createDeal = (body: Partial<Deal>) =>
  apiFetch<Deal>("/api/v1/realestate/deals", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateDeal = (id: number, body: Partial<Deal>) =>
  apiFetch<Deal>(`/api/v1/realestate/deals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const moveDealStage = (id: number, stage: string) =>
  apiFetch<Deal>(`/api/v1/realestate/deals/${id}/stage?stage=${stage}`, {
    method: "POST",
  });

export const deleteDeal = (id: number) =>
  apiFetch<void>(`/api/v1/realestate/deals/${id}`, { method: "DELETE" });

export const recordNegotiation = (dealId: number, body: any) =>
  apiFetch(`/api/v1/realestate/deals/${dealId}/negotiate`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const approveNegotiation = (id: number, action: "approve" | "reject") =>
  apiFetch(`/api/v1/realestate/negotiations/${id}/${action}`, { method: "POST" });

export const bookDeal = (id: number, channelPartnerId?: number) => {
  const qs = channelPartnerId ? `?channel_partner_id=${channelPartnerId}` : "";
  return apiFetch<Deal>(`/api/v1/realestate/deals/${id}/book${qs}`, {
    method: "POST",
  });
};

// ---------------------------------------------------------------------------
// SITE VISITS
// ---------------------------------------------------------------------------
export const listSiteVisits = (params?: Record<string, any>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<SiteVisit[]>(`/api/v1/realestate/site-visits${qs}`);
};

export const createSiteVisit = (body: Partial<SiteVisit>) =>
  apiFetch<SiteVisit>("/api/v1/realestate/site-visits", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateSiteVisit = (id: number, body: Partial<SiteVisit>) =>
  apiFetch<SiteVisit>(`/api/v1/realestate/site-visits/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const checkInVisit = (id: number, lat?: number, lng?: number) => {
  const qs = lat && lng ? `?lat=${lat}&lng=${lng}` : "";
  return apiFetch<SiteVisit>(`/api/v1/realestate/site-visits/${id}/check-in${qs}`, {
    method: "POST",
  });
};

export const checkOutVisit = (id: number) =>
  apiFetch<SiteVisit>(`/api/v1/realestate/site-visits/${id}/check-out`, {
    method: "POST",
  });

export const submitVisitFeedback = (id: number, body: Partial<SiteVisit>) =>
  apiFetch<SiteVisit>(`/api/v1/realestate/site-visits/${id}/feedback`, {
    method: "POST",
    body: JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// PAYMENTS
// ---------------------------------------------------------------------------
export const listPayments = (params?: Record<string, any>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<Payment[]>(`/api/v1/realestate/payments${qs}`);
};

export const createPayment = (body: Partial<Payment>) =>
  apiFetch<Payment>("/api/v1/realestate/payments", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const confirmPayment = (
  paymentId: number,
  action: "confirm" | "reject",
  notes?: string
) =>
  apiFetch<Payment>("/api/v1/realestate/payments/confirm", {
    method: "POST",
    body: JSON.stringify({ payment_id: paymentId, action, notes }),
  });

export const markPaymentPaid = (id: number, reference?: string) => {
  const qs = reference ? `?reference=${encodeURIComponent(reference)}` : "";
  return apiFetch<Payment>(
    `/api/v1/realestate/payments/${id}/mark-paid${qs}`,
    { method: "POST" }
  );
};

// ---------------------------------------------------------------------------
// DOCUMENTS
// ---------------------------------------------------------------------------
export const listDocuments = (dealId: number) =>
  apiFetch<Document[]>(`/api/v1/realestate/deals/${dealId}/documents`);

export const createDocument = (body: Partial<Document>) =>
  apiFetch<Document>("/api/v1/realestate/documents", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const verifyDocument = (
  id: number,
  action: "verify" | "reject",
  reason?: string
) => {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : "";
  return apiFetch<Document>(`/api/v1/realestate/documents/${id}/${action}${qs}`, {
    method: "POST",
  });
};

// ---------------------------------------------------------------------------
// CHANNEL PARTNERS
// ---------------------------------------------------------------------------
export const listPartners = () =>
  apiFetch<ChannelPartner[]>("/api/v1/realestate/partners");

export const createPartner = (body: Partial<ChannelPartner>) =>
  apiFetch<ChannelPartner>("/api/v1/realestate/partners", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updatePartner = (id: number, body: Partial<ChannelPartner>) =>
  apiFetch<ChannelPartner>(`/api/v1/realestate/partners/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// COMMISSIONS
// ---------------------------------------------------------------------------
export const listCommissions = (params?: Record<string, any>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch<Commission[]>(`/api/v1/realestate/commissions${qs}`);
};

export const actOnCommission = (
  commissionId: number,
  action: "approve" | "pay" | "reject",
  reference?: string
) =>
  apiFetch<Commission>("/api/v1/realestate/commissions/action", {
    method: "POST",
    body: JSON.stringify({ commission_id: commissionId, action, reference }),
  });

// ---------------------------------------------------------------------------
// ASSIGNMENT RULES
// ---------------------------------------------------------------------------
export const listAssignmentRules = () =>
  apiFetch<any[]>("/api/v1/realestate/assignment-rules");

export const createAssignmentRule = (body: any) =>
  apiFetch("/api/v1/realestate/assignment-rules", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const deleteAssignmentRule = (id: number) =>
  apiFetch<void>(`/api/v1/realestate/assignment-rules/${id}`, {
    method: "DELETE",
  });