/**
 * Buyer Portal — client-side API surface.
 */

import { apiFetch } from "@/lib/api";

export interface BuyerDeal {
  id: number;
  uuid: string;
  stage: string;
  doc_status: string;
  property_title: string | null;
  property_tower: string | null;
  property_unit_no: string | null;
  property_location: string | null;
  property_city: string | null;
  expected_value: string;
  final_value: string;
  booking_amount: string;
  booking_date: string | null;
  created_at: string;
}

export interface BuyerPayment {
  id: number;
  deal_id: number;
  milestone: string;
  amount: string;
  paid_amount: string;
  due_date: string | null;
  paid_on: string | null;
  status: string;
  reported_at: string | null;
  reported_amount: string | null;
  reported_ref: string | null;
  confirmed_at: string | null;
}

export interface BuyerDocument {
  id: number;
  deal_id: number;
  doc_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  status: string;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface BuyerPortalData {
  deals: BuyerDeal[];
  payments: BuyerPayment[];
  documents: BuyerDocument[];
}

export const getBuyerPortal = () =>
  apiFetch<BuyerPortalData>("/api/v1/buyer/portal");

export const reportBuyerPayment = (paymentId: number, amount: number, reference: string) =>
  apiFetch<BuyerPayment>("/api/v1/buyer/payments/report", {
    method: "POST",
    body: JSON.stringify({ payment_id: paymentId, amount, reference }),
  });

export const uploadBuyerDocument = (
  dealId: number,
  docType: string,
  fileUrl: string,
  fileName: string,
  fileSize?: number,
) =>
  apiFetch<BuyerDocument>("/api/v1/buyer/documents/upload", {
    method: "POST",
    body: JSON.stringify({
      deal_id: dealId,
      doc_type: docType,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
    }),
  });