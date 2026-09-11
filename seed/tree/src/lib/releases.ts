/**
 * Which Calliopa releases exist, and which of them make sense to install from
 * the one that runs. The list comes from GitHub's public release list, asked
 * for by the owner's browser and by nothing in the stack (`LICENSE-CORE.md`
 * §6; `distribution/README.md`); this module only reads it. BO_0223_013
 */

export interface Release {
  readonly version: string;
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly publishedAt: string;
  readonly url: string;
}

/** A release worth offering: the newest of its type above the installed one. */
export interface Candidate {
  readonly type: "patch" | "minor" | "major";
  readonly release: Release;
}

export interface ReleaseCheck {
  /** Every release newest first, whether installed, above or below. */
  readonly releases: readonly Release[];
  /** The candidates, highest type first; empty means nothing newer. */
  readonly candidates: readonly Candidate[];
}

/** Where the list comes from: the public `calliopa` repository's releases. */
export const RELEASES_URL = "https://api.github.com/repos/frankzickert/calliopa/releases?per_page=100";

const TAG = /^v(\d+)\.(\d+)\.(\d+)$/u;

export function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(version);
  if (match === null) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function compareReleases(a: Release, b: Release): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * The release list as GitHub answers it: drafts and prereleases dropped, tags
 * that are not `v<major>.<minor>.<patch>` ignored, newest first.
 */
export function parseReleases(raw: unknown): Release[] {
  if (!Array.isArray(raw)) return [];
  const releases: Release[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    if (row["draft"] === true || row["prerelease"] === true) continue;
    const tag = typeof row["tag_name"] === "string" ? row["tag_name"] : "";
    const match = TAG.exec(tag);
    if (match === null) continue;
    releases.push({
      version: `${match[1]}.${match[2]}.${match[3]}`,
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
      publishedAt: typeof row["published_at"] === "string" ? row["published_at"] : "",
      url: typeof row["html_url"] === "string" ? row["html_url"] : "",
    });
  }
  releases.sort((a, b) => compareReleases(b, a));
  return releases;
}

/**
 * The candidates for an installed `M.m.p`: the newest `M.m.x` above it (a
 * patch), the newest `M.y.x` with `y > m` (a minor), the newest `X.y.x` with
 * `X > M` (a major); a release that is two of these is listed once, under its
 * highest type. An installed version the list does not parse yields no
 * candidate: nothing can be said to be newer.
 */
export function candidates(installed: string, releases: readonly Release[]): Candidate[] {
  const base = parseVersion(installed);
  if (base === null) return [];
  const newest = (matches: (r: Release) => boolean): Release | undefined =>
    [...releases].filter(matches).sort((a, b) => compareReleases(b, a))[0];
  const major = newest((r) => r.major > base.major);
  const minor = newest((r) => r.major === base.major && r.minor > base.minor);
  const patch = newest((r) => r.major === base.major && r.minor === base.minor && r.patch > base.patch);
  const found: Candidate[] = [];
  const seen = new Set<string>();
  for (const [type, release] of [
    ["major", major],
    ["minor", minor],
    ["patch", patch],
  ] as const) {
    if (release === undefined || seen.has(release.version)) continue;
    seen.add(release.version);
    found.push({ type, release });
  }
  return found;
}

export function check(installed: string, raw: unknown): ReleaseCheck {
  const releases = parseReleases(raw);
  return { releases, candidates: candidates(installed, releases) };
}

/** The storage key under which a session remembers the list it fetched. */
export const RELEASES_CACHE_KEY = "calliopa.releases";

/**
 * Asks GitHub for the release list from the browser, once per session: the
 * answer is remembered in `sessionStorage`, so a reload does not ask again
 * and *Check again* does by passing `fresh`. Answers `null` when GitHub
 * cannot be reached, which the caller says in words and never as an error.
 */
export async function fetchReleases(fresh = false): Promise<unknown | null> {
  const storage = ((): Storage | null => {
    try {
      return typeof sessionStorage === "undefined" ? null : sessionStorage;
    } catch {
      return null;
    }
  })();
  if (!fresh && storage !== null) {
    const cached = storage.getItem(RELEASES_CACHE_KEY);
    if (cached !== null) {
      try {
        return JSON.parse(cached) as unknown;
      } catch {
        storage.removeItem(RELEASES_CACHE_KEY);
      }
    }
  }
  try {
    const response = await fetch(RELEASES_URL, { headers: { accept: "application/vnd.github+json" } });
    if (!response.ok) return null;
    const raw = (await response.json()) as unknown;
    if (storage !== null) {
      try {
        storage.setItem(RELEASES_CACHE_KEY, JSON.stringify(raw));
      } catch {
        // A full or refused storage only costs a second request later.
      }
    }
    return raw;
  } catch {
    return null;
  }
}
