import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { ok, fail, route } from "@/lib/api";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const POST = route(async (req: NextRequest) => {
  const { email, password } = Body.parse(await req.json());

  const user = await prisma.user.findUnique({ where: { email } });

  // Same message either way, so the endpoint cannot be used to discover which
  // email addresses have accounts.
  const INVALID = "Incorrect email or password.";
  if (!user) return fail(INVALID, 401);
  if (!(await verifyPassword(password, user.passwordHash))) return fail(INVALID, 401);

  await createSession({ userId: user.id, email: user.email, name: user.name, role: user.role });

  return ok({ id: user.id, name: user.name, email: user.email, role: user.role });
});
