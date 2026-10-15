const VALID_ROLES = ["super_admin", "admin", "sales_manager", "sales_executive"];

/**
 * Signed role-PDF URLs must be created by a trusted backend endpoint. The supplied
 * FastAPI backend does not expose that endpoint, so do not return a broken or
 * unsigned URL from the browser.
 */
export async function issueRolePdfLink({ data }: { data: { role: string } }) {
  if (!VALID_ROLES.includes(String(data?.role))) throw new Error("Invalid role");
  throw new Error("Role PDF links are not available until the backend exposes a signed role-PDF endpoint.");
}
