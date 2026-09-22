export const TICKET_STATUSES = ["backlog", "pending_approval", "in_progress", "client_uat", "ready_for_deploy", "completed", "archived"] as const;
export const TICKET_PRIORITIES = ["low", "medium", "high"] as const;
export const TICKET_TYPES = ["new_feature", "feature_update", "bug"] as const;
export const TICKET_PLATFORMS = ["desktop", "mobile", "tablet"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketPlatform = (typeof TICKET_PLATFORMS)[number];

export function isTicketStatus(value: string): value is TicketStatus {
  return TICKET_STATUSES.includes(value as TicketStatus);
}

export function isTicketPriority(value: string): value is TicketPriority {
  return TICKET_PRIORITIES.includes(value as TicketPriority);
}

export function isTicketType(value: string): value is TicketType {
  return TICKET_TYPES.includes(value as TicketType);
}

export function isTicketPlatform(value: string): value is TicketPlatform {
  return TICKET_PLATFORMS.includes(value as TicketPlatform);
}

export function validateProjectName(value: string) {
  const name = value.trim();
  if (!name) return "Project name is required.";
  if (name.length < 2) return "Project name must be at least 2 characters.";
  if (name.length > 100) return "Project name must be 100 characters or less.";
  return null;
}

export function validateDescription(value: string) {
  return value.trim().length > 2000 ? "Description must be 2,000 characters or less." : null;
}

export function validateTicketTitle(value: string) {
  const title = value.trim();
  if (!title) return "Ticket title is required.";
  if (title.length < 2) return "Ticket title must be at least 2 characters.";
  if (title.length > 140) return "Ticket title must be 140 characters or less.";
  return null;
}

export function validateComment(value: string) {
  const comment = value.trim();
  if (!comment) return "Comment cannot be empty.";
  if (comment.length > 2000) return "Comment must be 2,000 characters or less.";
  return null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseOptionalNonnegativeNumber(value: string, maximum: number) {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > maximum) return undefined;
  return Math.round(number * 100) / 100;
}

export function isCurrency(value: string) {
  return /^[A-Z]{3}$/.test(value);
}

export function validateOptionalUrl(value: string, label: string) {
  const url = value.trim();
  if (!url) return null;
  if (url.length > 2000) return `${label} must be 2,000 characters or less.`;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return `${label} must start with http:// or https://.`;
    }
  } catch {
    return `Enter a valid ${label.toLowerCase()}.`;
  }

  return null;
}

export function validateLongText(value: string, label: string, maximum = 5000) {
  return value.trim().length > maximum ? `${label} must be ${maximum.toLocaleString()} characters or less.` : null;
}
