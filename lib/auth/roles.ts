export const APP_ROLES = [
  "admin",
  "project_manager",
  "developer",
  "designer",
  "client",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  project_manager: "Project manager",
  developer: "Developer",
  designer: "Designer",
  client: "Client",
};

export function isAppRole(value: string): value is AppRole {
  return APP_ROLES.includes(value as AppRole);
}

const ROLE_PRIORITY: AppRole[] = [
  "admin",
  "project_manager",
  "developer",
  "designer",
  "client",
];

export function normalizeRoles(values: string[]): AppRole[] {
  return [...new Set(values.filter(isAppRole))].sort(
    (left, right) =>
      ROLE_PRIORITY.indexOf(left) - ROLE_PRIORITY.indexOf(right),
  );
}

export function splitPrimaryRole(values: string[]) {
  const roles = normalizeRoles(values);
  return { primaryRole: roles[0] ?? null, additionalRoles: roles.slice(1) };
}
