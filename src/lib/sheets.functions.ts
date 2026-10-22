/**
 * Google Sheets sync/export need a trusted server-side integration. The supplied
 * FastAPI backend does not expose these endpoints yet, so fail clearly instead
 * of issuing requests that are guaranteed to return 404.
 */
export async function syncSheetNowFn({ data }: { data: { configId: string } }) {
  if (!data?.configId) throw new Error("configId is required");
  throw new Error("Google Sheets sync is unavailable until the backend exposes /api/v1/sheets/sync.");
}

type ExportInput = { entity: "leads" | "contacts" | "companies"; spreadsheetId?: string; title?: string };

export async function exportToSheetFn({ data }: { data: ExportInput }) {
  if (!["leads", "contacts", "companies"].includes(data?.entity)) throw new Error("Unsupported entity");
  throw new Error("Google Sheets export is unavailable until the backend exposes /api/v1/sheets/export.");
}
