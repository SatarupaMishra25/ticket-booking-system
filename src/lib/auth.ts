import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

const SESSION_COOKIE = "tbs_session";
const SESSION_DAYS = 7;

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

export type Session = {
  userId: string;
  email: string;
  name: string;
  role: Role;
};

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);

export const verifyPassword = (plain: string, hash: string) =>
  bcrypt.compare(plain, hash);

/** Signs a session JWT and stores it in an httpOnly cookie. */
export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Reads the current session, or null when signed out / token invalid. */
export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

/** Thrown by the `require*` helpers; mapped to an HTTP status by the API layer. */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Requires any signed-in user. */
export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError("You must be signed in.", 401);
  return session;
}

/** Requires a signed-in user holding one of `roles`. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireUser();
  if (!roles.includes(session.role)) {
    throw new AuthError("You do not have access to this resource.", 403);
  }
  return session;
}
