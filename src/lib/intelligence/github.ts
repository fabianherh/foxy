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

export async function validateGithubProfile(value: string): Promise<GithubProfile> {
  const username = extractGithubUsername(value);
  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Foxy-AI-Interviewer", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) throw new Error("This GitHub profile does not exist or is not publicly accessible");
  if (!response.ok) throw new Error("GitHub profile validation is temporarily unavailable");
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
