import { parsePublicUrl } from "./public-url";

export interface GithubProfile {
  username: string;
  profileUrl: string;
  displayName: string;
  avatarUrl: string;
  publicRepos: number;
  bio: string;
}

export function extractGithubUsername(value: string): string {
  const url = parsePublicUrl(value);
  if (url.hostname.toLowerCase() !== "github.com" && url.hostname.toLowerCase() !== "www.github.com") throw new Error("Enter a github.com profile URL");
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) throw new Error("Enter a GitHub user profile, not a repository or other GitHub page");
  const username = segments[0];
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) throw new Error("This GitHub username is not valid");
  return username;
}

export function normalizeGithubProfileUrl(value: string): string {
  return `https://github.com/${extractGithubUsername(value)}`;
}

export const GITHUB_UNAVAILABLE = "GitHub profile validation is temporarily unavailable";

export async function validateGithubProfile(value: string): Promise<GithubProfile> {
  const username = extractGithubUsername(value);
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "Foxy-AI-Interviewer", "X-GitHub-Api-Version": "2022-11-28" };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers, signal: AbortSignal.timeout(10000) });
  } catch {
    throw new Error(GITHUB_UNAVAILABLE);
  }
  if (response.status === 404) throw new Error("This GitHub profile does not exist or is not publicly accessible");
  if (response.status === 403 || response.status === 429) {
    console.error(`GitHub API rate limited (${response.status}) while validating ${username}`);
    throw new Error(GITHUB_UNAVAILABLE);
  }
  if (!response.ok) throw new Error(GITHUB_UNAVAILABLE);
  const profile = await response.json() as { login?: string; html_url?: string; name?: string | null; avatar_url?: string; public_repos?: number; bio?: string | null; type?: string };
  if (profile.type !== "User" || !profile.login || !profile.html_url) throw new Error("This URL is not a public GitHub user profile");
  return {
    username: profile.login,
    profileUrl: profile.html_url,
    displayName: profile.name || profile.login,
    avatarUrl: profile.avatar_url || "",
    publicRepos: profile.public_repos ?? 0,
    bio: profile.bio || "",
  };
}
