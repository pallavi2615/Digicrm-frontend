import { apiFetch } from "@/lib/api";

type JsonVal = string | number | boolean | null | undefined | JsonVal[] | { [key: string]: JsonVal };
type JsonMap = Record<string, JsonVal>;

export type VerifyKind = "pan" | "aadhaar" | "gst" | "bank_account" | "document_ocr" | "bureau";
export type VerifyResult = {
  id: string | null;
  kind: VerifyKind;
  status: "verified" | "failed" | "manual_review";
  provider: string;
  score: number | null;
  masked: string;
  result: JsonMap;
  error: string | null;
};

type VerifyInput = {
  kind: VerifyKind;
  value?: string;
  ifsc?: string;
  subjectName?: string;
  mobile?: string;
  recordId?: string | null;
  leadId?: string | null;
  fileDataUrl?: string;
  fileName?: string;
  docHint?: string;
};

function toVerifyResult(kind: VerifyKind, response: any, input: VerifyInput): VerifyResult {
  const check = response?.check ?? response;
  const rawStatus = String(check?.status ?? (response?.success ? "success" : "failed")).toLowerCase();
  const status: VerifyResult["status"] = ["success", "verified", "completed"].includes(rawStatus)
    ? "verified"
    : ["pending", "review", "manual_review"].includes(rawStatus) ? "manual_review" : "failed";
  return {
    id: check?.id == null ? null : String(check.id),
    kind,
    status,
    provider: String(check?.provider ?? "DigiVerify"),
    score: typeof check?.score === "number" ? check.score : null,
    masked: String(check?.input_masked ?? check?.identifier_masked ?? input.fileName ?? input.value ?? ""),
    result: (check?.result && typeof check.result === "object" ? check.result : {}) as JsonMap,
    error: check?.error_message ?? check?.error ?? (status === "failed" ? response?.message ?? "Verification failed" : null),
  };
}

function refFields(input: VerifyInput) {
  const ref = input.recordId ?? input.leadId ?? null;
  const id = ref && /^\d+$/.test(ref) ? Number(ref) : undefined;
  return id === undefined ? {} : { reference_type: input.recordId ? "record" : "lead", reference_id: id };
}

export async function runVerification({ data }: { data: VerifyInput }): Promise<VerifyResult> {
  const kinds: VerifyKind[] = ["pan", "aadhaar", "gst", "bank_account", "document_ocr", "bureau"];
  if (!data || !kinds.includes(data.kind)) throw new Error("Unsupported verification type");
  if (data.kind === "document_ocr") {
    if (!data.fileDataUrl?.startsWith("data:")) throw new Error("Upload a document to run OCR");
    if (data.fileDataUrl.length > 8_000_000) throw new Error("Document is too large (max ~6 MB)");
  } else if (!data.value || data.value.trim().length < 4) {
    throw new Error("Enter the value to verify");
  }
  if (data.kind === "bank_account" && !data.ifsc) throw new Error("IFSC is required for a bank check");

  const value = (data.value ?? "").trim();
  const fields = refFields(data);
  let endpoint = "";
  let body: Record<string, unknown>;
  switch (data.kind) {
    case "pan": endpoint = "/api/v1/digiverify/pan"; body = { pan: value.toUpperCase(), name: data.subjectName, ...fields }; break;
    case "aadhaar": endpoint = "/api/v1/digiverify/aadhaar"; body = { aadhaar: value.replace(/\s/g, ""), ...fields }; break;
    case "gst": endpoint = "/api/v1/digiverify/gstin"; body = { gstin: value.toUpperCase(), ...fields }; break;
    case "bank_account": endpoint = "/api/v1/digiverify/bank"; body = { account_number: value, ifsc: data.ifsc!.toUpperCase(), ...fields }; break;
    case "bureau": endpoint = "/api/v1/digiverify/credit-bureau"; body = { pan: value.toUpperCase(), name: data.subjectName ?? "", mobile: data.mobile ?? "", ...fields }; break;
    case "document_ocr":
      throw new Error("Document OCR is not available: the supplied FastAPI backend does not expose a document OCR endpoint yet.");
  }

  const response = await apiFetch<any>(endpoint, { method: "POST", body: JSON.stringify(body) });
  return toVerifyResult(data.kind, response, data);
}
