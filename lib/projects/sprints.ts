const DAY_IN_MS = 24 * 60 * 60 * 1000;
export const SPRINT_LENGTH_DAYS = 14;

function dateAtUtcMidnight(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getSprintWindow(anchorDate: string, now = new Date()) {
  const anchor = dateAtUtcMidnight(anchorDate);
  const today = dateAtUtcMidnight(isoDate(now));
  const elapsedDays = Math.floor((today.getTime() - anchor.getTime()) / DAY_IN_MS);
  const sprintIndex = Math.max(0, Math.floor(elapsedDays / SPRINT_LENGTH_DAYS));
  const start = new Date(anchor.getTime() + sprintIndex * SPRINT_LENGTH_DAYS * DAY_IN_MS);
  const endExclusive = new Date(start.getTime() + SPRINT_LENGTH_DAYS * DAY_IN_MS);
  const endInclusive = new Date(endExclusive.getTime() - DAY_IN_MS);

  return {
    number: sprintIndex + 1,
    start: isoDate(start),
    end: isoDate(endInclusive),
    endExclusive: isoDate(endExclusive),
    isUpcoming: elapsedDays < 0,
  };
}

export function formatSprintDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateAtUtcMidnight(value));
}

export function formatSprintLabel(anchorDate: string, now = new Date()) {
  const sprint = getSprintWindow(anchorDate, now);
  return `${sprint.isUpcoming ? "First sprint" : `Sprint ${sprint.number}`} · ${formatSprintDate(sprint.start)} – ${formatSprintDate(sprint.end)}`;
}
