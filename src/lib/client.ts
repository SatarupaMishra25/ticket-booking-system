"use client";

/**
 * Thin fetch wrapper: sends/receives JSON and turns the API's uniform
 * `{ error }` envelope into a thrown Error, so callers can just try/catch.
 */
export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};

  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as T;
}
