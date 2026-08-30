import { ConvexError } from "convex/values";

export function fail(
  code: "NOT_FOUND" | "INVALID_ARGUMENT" | "INVALID_STATE" | "CONFLICT",
  message: string,
): never {
  throw new ConvexError({ code, message });
}

export function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    fail("INVALID_ARGUMENT", `${field} is required`);
  }
  return normalized;
}

export function optionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function requireHttpUrl(value: string, field: string): string {
  const normalized = requireText(value, field);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    fail("INVALID_ARGUMENT", `${field} must be a valid URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail("INVALID_ARGUMENT", `${field} must use http or https`);
  }
  return parsed.toString();
}

export function optionalHttpUrl(
  value: string | undefined,
  field: string,
): string | undefined {
  const normalized = optionalText(value);
  return normalized ? requireHttpUrl(normalized, field) : undefined;
}

export function optionalEmail(value: string | undefined): string | undefined {
  const normalized = optionalText(value)?.toLowerCase();
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    fail("INVALID_ARGUMENT", "email must be valid");
  }
  return normalized;
}

export function score(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    fail("INVALID_ARGUMENT", `${field} must be between 0 and 100`);
  }
  return value;
}

export function confidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    fail("INVALID_ARGUMENT", "confidence must be between 0 and 1");
  }
  return value;
}

export function stringList(values: string[], field: string): string[] {
  const normalized = values.map((value) => requireText(value, field));
  return [...new Set(normalized)];
}
