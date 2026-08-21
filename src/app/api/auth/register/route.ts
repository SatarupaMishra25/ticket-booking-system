import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { ok, fail, route } from "@/lib/api";

const Body = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  // ADMIN is deliberately not self-servable; seed or promote instead.
  role: z.enum(["CUSTOMER", "ORGANISER"]).default("CUSTOMER"),
});

export const POST = route(async (req: NextRequest) => {
  const { name, email, password, role } = Body.parse(await req.json());

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("An account with that email already exists.", 409);

  const user = await prisma.user.create({
    data: { name, email, role, passwordHash: await hashPassword(password) },
  });

  await createSession({ userId: user.id, email: user.email, name: user.name, role: user.role });

  return ok({ id: user.id, name: user.name, email: user.email, role: user.role }, 201);
});
