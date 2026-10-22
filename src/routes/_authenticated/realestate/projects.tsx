/**
 * Projects & Inventory — projects list, tower builder, unit cards.
 */

import { defineRoute } from "@/lib/router-compat";
import { useState } from "react";
import { useQuery, useQueryClient } from "@/lib/react-data-client";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  listProjects, createProject, updateProject,
  listProperties, createProperty, updateInventoryStatus,
} from "@/lib/realestate.functions";
import { useReConfig } from "@/hooks/use-re-config";
import { cr, INV_TONE } from "@/lib/re-data";

export const Route = defineRoute("/_authenticated/realestate/projects")({
  head: () => ({ meta: [{ title: "Projects & Inventory | Real Estate CRM" }] }),
  component: ProjectsPage,
});

const emptyP: any = {
  name: "", developer: "", city: "", location: "", rera_number: "",
  project_type: "Residential", total_units: "", towers: "", floors: "",
  amenities: "", possession_date: "", price_min: "", price_max: "", brochure_url: "",
};

const emptyU: any = {
  title: "", project_id: "", tower: "", floor_no: "", unit_no: "",
  property_type: "Apartment", bhk: "", super_area: "", facing: "",
  price: "", city: "", location: "", inventory_status: "Available",
};

function ProjectsPage() {
  const qc = useQueryClient();
  const cfg = useReConfig();
  const [filter, setFilter] = useState("all");
  const [pOpen, setPOpen] = useState(false);
  const [uOpen, setUOpen] = useState(false);
  const [p, setP] = useState<any>(emptyP);
  const [u, setU] = useState<any>(emptyU);

  const { data: projects = [] } = useQuery({
    queryKey: ["re-projects"],
    queryFn: listProjects,
  });
  const { data: units = [] } = useQuery({
    queryKey: ["re-properties"],
    queryFn: () => listProperties(),
  });

  const saveProject = async () => {
    if (!p.name?.trim()) return toast.error("Project name required");
    const body = {
      ...p,
      total_units: p.total_units ? Number(p.total_units) : null,
      towers: p.towers ? Number(p.towers) : null,
      floors: p.floors ? Number(p.floors) : null,
      price_min: p.price_min ? Number(p.price_min) : null,
      price_max: p.price_max ? Number(p.price_max) : null,
    };
    try {
      if (p.id) await updateProject(p.id, body);
      else await createProject(body);
      toast.success("Project saved");
      setPOpen(false);
      qc.invalidateQueries({ queryKey: ["re-projects"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const saveUnit = async () => {
    if (!u.title && !u.unit_no) return toast.error("Give the unit a name or unit number");
    const body: any = {
      ...u,
      project_id: u.project_id ? Number(u.project_id) : null,
      floor_no: u.floor_no ? Number(u.floor_no) : null,
      bhk: u.bhk ? Number(u.bhk) : null,
      super_area: u.super_area ? Number(u.super_area) : null,
      price: u.price ? Number(u.price) : 0,
      title: u.title || `Unit ${u.unit_no}`,
    };
    try {
      if (u.id) await updateInventoryStatus(u.id, u.inventory_status);
      else await createProperty(body);
      toast.success("Unit saved");
      setUOpen(false);
      qc.invalidateQueries({ queryKey: ["re-properties"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const setStatus = async (id: number, s: string) => {
    await updateInventoryStatus(id, s);
    qc.invalidateQueries({ queryKey: ["re-properties"] });
  };

  const groups = [
    ...projects.map((p: any) => ({ id: p.id, name: p.name, proj: p })),
    { id: null, name: "Standalone units", proj: null },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex flex-wrap gap-1">
          {["all", ...(cfg.data?.inventory_statuses ?? [])].map((s) => (
            <Button
              key={s} size="sm" variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "All" : s}{" "}
              {s !== "all" && `(${units.filter((x: any) => x.inventory_status === s).length})`}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => { setP(emptyP); setPOpen(true); }}>
            <Building2 className="h-4 w-4 mr-1" />New project
          </Button>
          <Button onClick={() => { setU(emptyU); setUOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />New unit
          </Button>
        </div>
      </div>

      {groups.map((g) => {
        const list = units.filter((x: any) =>
          (x.project_id ?? null) === g.id && (filter === "all" || x.inventory_status === filter)
        );
        const all = units.filter((x: any) => (x.project_id ?? null) === g.id);
        const sold = all.filter((x: any) => ["Sold", "Booked"].includes(x.inventory_status));
        if (!g.proj && list.length === 0) return null;

        return (
          <Card key={g.id ?? "none"}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start gap-2">
                <div>
                  <CardTitle className="text-base">{g.name}</CardTitle>
                  {g.proj && (
                    <CardDescription>
                      {[g.proj.developer, g.proj.location || g.proj.city, g.proj.rera_number && `RERA ${g.proj.rera_number}`]
                        .filter(Boolean).join(" · ")}
                    </CardDescription>
                  )}
                </div>
                <div className="ml-auto flex gap-3 text-xs">
                  <span>Units <b>{all.length}</b></span>
                  <span>Available <b>{all.filter((x: any) => x.inventory_status === "Available").length}</b></span>
                  <span>Sold/Booked <b>{sold.length}</b></span>
                  <span>Booked value <b>{cr(sold.reduce((a: number, x: any) => a + Number(x.price || 0), 0))}</b></span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                {list.map((x: any) => (
                  <div key={x.id} className={`border rounded-md p-2 text-xs space-y-1 ${INV_TONE[x.inventory_status] ?? ""}`}>
                    <div
                      className="font-semibold truncate cursor-pointer"
                      onClick={() => { setU({ ...emptyU, ...x }); setUOpen(true); }}
                    >
                      {x.tower ? `${x.tower}-${x.unit_no ?? ""}` : x.title}
                    </div>
                    <div>
                      {[x.bhk && `${x.bhk} BHK`, x.super_area && `${x.super_area} sqft`].filter(Boolean).join(" · ")}
                    </div>
                    <div className="font-medium">{cr(x.price)}</div>
                    <Select value={x.inventory_status} onValueChange={(v) => setStatus(x.id, v)}>
                      <SelectTrigger className="h-7 text-xs bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(cfg.data?.inventory_statuses ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {!list.length && <div className="text-sm text-muted-foreground">No units in this view</div>}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={pOpen} onOpenChange={setPOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{p.id ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              ["name", "Project name *"], ["developer", "Developer"], ["rera_number", "RERA number"],
              ["city", "City"], ["location", "Location"], ["project_type", "Type"],
              ["total_units", "Total units", "number"], ["towers", "Towers", "number"], ["floors", "Floors", "number"],
              ["price_min", "Price from", "number"], ["price_max", "Price to", "number"], ["possession_date", "Possession", "date"],
              ["brochure_url", "Brochure link"],
            ].map(([k, l, t]: any) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{l}</Label>
                <Input type={t ?? "text"} value={p[k] ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="space-y-1"><Label className="text-xs">Amenities</Label><Textarea rows={2} value={p.amenities} onChange={(e) => setP({ ...p, amenities: e.target.value })} /></div>
          <DialogFooter><Button onClick={saveProject}>Save project</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={uOpen} onOpenChange={setUOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{u.id ? "Edit unit" : "New unit"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Project</Label>
              <Select value={u.project_id ? String(u.project_id) : "none"} onValueChange={(v) => setU({ ...u, project_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Standalone</SelectItem>
                  {projects.map((x: any) => <SelectItem key={x.id} value={String(x.id)}>{x.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {[
              ["title", "Display name"], ["tower", "Tower"],
              ["floor_no", "Floor", "number"], ["unit_no", "Unit no."], ["property_type", "Property type"],
              ["bhk", "BHK", "number"], ["super_area", "Super area", "number"],
              ["facing", "Facing"], ["price", "Price", "number"],
              ["city", "City"], ["location", "Location"],
            ].map(([k, l, t]: any) => (
              <div key={k} className="space-y-1">
                <Label className="text-xs">{l}</Label>
                <Input type={t ?? "text"} value={u[k] ?? ""} onChange={(e) => setU({ ...u, [k]: e.target.value })} />
              </div>
            ))}
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={u.inventory_status} onValueChange={(v) => setU({ ...u, inventory_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(cfg.data?.inventory_statuses ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={saveUnit}>Save unit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}