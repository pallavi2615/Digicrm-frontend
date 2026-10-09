import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/agency/portal")({
  head: () => ({ meta: [{ title: "Agency Client Portal — DigiCRM AI" }] }),
  component: AgencyPortalPage,
});

type ClientShare = {
  id: number;
  tenant_id: number;
  deal_id: number | null;
  client_email: string;
  contract_type: string | null;
  title: string | null;
  notes: string | null;
  link: string | null;
  file_path: string | null;
  kind: string;
  status: string;
  created_at: string;
};

function AgencyPortalPage() {
  const { user } = useAuth();

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["my-shares"],
    queryFn: () => apiFetch<ClientShare[]>("/api/v1/agency/my-shares"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Client portal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Shared contracts, documents, and updates from your agency.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
            Loading…
          </CardContent>
        </Card>
      ) : shares.length === 0 ? (
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client portal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nothing is shared with {user?.email ?? "you"} yet. Ask your
                agency to add your email to your project, then refresh.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shares.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {s.title || "(untitled)"}
                </CardTitle>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                  <span>{s.contract_type ?? "document"}</span>
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {s.notes && (
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {s.notes}
                  </p>
                )}

                {s.link && (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    Open link <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                {s.file_path && (
                  <a
                    href={`${import.meta.env.VITE_API_URL?.replace("/api/v1", "") ?? ""}/${s.file_path}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                  >
                    Download file <ExternalLink className="h-3 w-3" />
                  </a>
                )}

                <div className="text-xs">
                  <span
                    className={
                      s.status === "signed"
                        ? "text-green-600"
                        : s.status === "viewed"
                        ? "text-blue-600"
                        : "text-muted-foreground"
                    }
                  >
                    Status: {s.status}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
