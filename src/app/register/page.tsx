import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Card, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSession()) redirect("/events");

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Create an account" subtitle="Book seats, or list your own events." />
      <Card>
        <Suspense fallback={null}>
          <AuthForm mode="register" />
        </Suspense>
      </Card>
    </div>
  );
}
