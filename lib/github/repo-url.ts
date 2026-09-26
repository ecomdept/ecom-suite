export type GithubRepoRef = { owner: string; repo: string };

const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

function toRef(owner: string, repo: string): GithubRepoRef | null {
  const cleanRepo = repo.replace(/\/+$/, "").replace(/\.git$/i, "");
  if (!SEGMENT_PATTERN.test(owner) || !SEGMENT_PATTERN.test(cleanRepo)) return null;
  if ([owner, cleanRepo].some((segment) => segment === "." || segment === "..")) return null;
  return { owner, repo: cleanRepo };
}

export function parseGithubRepoUrl(value: string): GithubRepoRef | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const scpMatch = /^git@github\.com:([^/]+)\/(.+)$/i.exec(trimmed);
  if (scpMatch) return toRef(scpMatch[1], scpMatch[2]);

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }
    if (!["http:", "https:", "ssh:", "git:"].includes(parsed.protocol)) return null;
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    return toRef(segments[0], segments[1]);
  }

  const segments = trimmed.replace(/\/+$/, "").split("/");
  if (segments.length !== 2) return null;
  return toRef(segments[0], segments[1]);
}

export function buildBlobUrl(
  owner: string,
  repo: string,
  sha: string,
  path: string,
  startLine?: number,
  endLine?: number,
) {
  const encodedPath = path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
  const base = `https://github.com/${owner}/${repo}/blob/${sha}/${encodedPath}`;
  if (!startLine || startLine < 1) return base;
  return endLine && endLine > startLine ? `${base}#L${startLine}-L${endLine}` : `${base}#L${startLine}`;
}
