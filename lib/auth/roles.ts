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
