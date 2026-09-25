function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getMonthWindow(now = new Date(), offset = 0) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const endExclusive = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const end = new Date(endExclusive.getTime() - 24 * 60 * 60 * 1000);

  return {
    start: isoDate(start),
    end: isoDate(end),
    endExclusive: isoDate(endExclusive),
    label: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start),
    shortLabel: new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(start),
  };
}

export function getRecentMonthWindows(count: number, now = new Date()) {
  return Array.from({ length: count }, (_, index) =>
    getMonthWindow(now, index - count + 1),
  );
}
