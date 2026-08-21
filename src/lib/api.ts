import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { SeatConflictError } from "@/lib/seats";
import { BookingError } from "@/lib/bookings";
import { WaitlistError } from "@/lib/waitlist";

/** Uniform success envelope. */
export const ok = <T,>(data: T, status = 200) => NextResponse.json(data, { status });

/** Uniform error envelope: every failure is { error: "..." } plus a status. */
export const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

/**
 * Maps the domain error types onto HTTP responses so every route handler can
 * simply throw, and no route leaks a stack trace to the client.
 */
export function handleError(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.join(".");
    return fail(path ? `${path}: ${first.message}` : (first?.message ?? "Invalid request."), 422);
  }
  if (err instanceof AuthError) return fail(err.message, err.status);
  if (err instanceof BookingError) return fail(err.message, err.status);
  if (err instanceof WaitlistError) return fail(err.message, err.status);
  if (err instanceof SeatConflictError) return fail(err.message, 409);

  console.error("[api] unhandled error:", err);
  return fail("Something went wrong. Please try again.", 500);
}

/** Wraps a route handler with the error mapping above. */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<NextResponse>,
) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      return handleError(err);
    }
  };
}
