import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/workspace/")({
  head: () => ({ meta: [{ title: "Industry Workspace — DigiCRM AI" }] }),
  component: WorkspaceLanding,
});

type WorkspaceOut = {
  id: number;
  template_key: string;
  industry_key: string;
  location_type: string;
} | null;

function WorkspaceLanding() {
    const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-me"],
    queryFn: () => apiFetch<WorkspaceOut>("/api/v1/workspace/me"),
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-muted-foreground">
        <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  // No workspace yet → show setup prompt
  if (!data) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              Set up your industry workspace
            </h2>
            <p className="text-sm text-muted-foreground">
              “LA Test 1784299256310” has no industry template yet. Pick your
              industry and DigiCRM configures itself.
            </p>
              <Button onClick={() => navigate({ to: "/workspace/setup" })}>
                <Sparkles className="h-4 w-4 mr-2" />
                Open the AI template engine
              </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Workspace exists
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Industry Workspace</h1>
      <Card>
        <CardContent className="p-6 text-sm space-y-1">
          <div>
            <span className="text-muted-foreground">Template:</span>{" "}
            {data.template_key}
          </div>
          <div>
            <span className="text-muted-foreground">Industry:</span>{" "}
            {data.industry_key}
          </div>
          <div>
            <span className="text-muted-foreground">Location type:</span>{" "}
            {data.location_type}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}