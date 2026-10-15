import { defineRoute, Outlet } from "@/lib/router-compat";

export const Route = defineRoute("/products")({
  component: () => <Outlet />,
});
