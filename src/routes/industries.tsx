import { defineRoute, Outlet } from "@/lib/router-compat";

export const Route = defineRoute("/industries")({
  component: () => <Outlet />,
});
