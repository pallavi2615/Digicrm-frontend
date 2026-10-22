
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";

interface PermissionsContextType {
  roles: string[];
  role: string | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isExecutive: boolean;
  permissions: Record<string, string[]>;
  industries: string[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext =
  createContext<PermissionsContextType | null>(null);

export const PermissionsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<
    Record<string, string[]>
  >({});
  const [industries, setIndustries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setRoles([]);
      setPermissions({});
      setIndustries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const data = await apiFetch<any>(
        "/api/v1/auth/my-permissions"
      );

      console.log("PERMISSIONS API RESPONSE:", {
        role: data.role,
        roles: data.roles,
        permissionsKeys: Object.keys(data.permissions || {}),
        paymentsValue: data.permissions?.payments,
      });

      const rolesArr: string[] = Array.isArray(data.roles)
        ? data.roles
        : data.role
          ? [data.role]
          : [];

      setRoles(rolesArr);
      setPermissions(data.permissions || {});
      setIndustries(data.industries || []);
    } catch (err) {
      console.error("Failed to load permissions", err);

      // Clear permissions if the session is no longer valid.
      // apiFetch handles token refresh and redirects on failed refresh.
      if (!localStorage.getItem("access_token")) {
        setRoles([]);
        setPermissions({});
        setIndustries([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log(
      "PermissionsProvider mounted — calling refresh()"
    );
    void refresh();
  }, []);

  const role = roles[0] ?? null;

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isManager = isAdmin || roles.includes("manager");
  const isExecutive =
    roles.includes("sales_executive") ||
    roles.includes("executive");

  return (
    <PermissionsContext.Provider
      value={{
        roles,
        role,
        isSuperAdmin,
        isAdmin,
        isManager,
        isExecutive,
        permissions,
        industries,
        loading,
        refresh,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionsContext);

  if (!ctx) {
    throw new Error(
      "usePermissions must be used within <PermissionsProvider>"
    );
  }

  return ctx;
};
