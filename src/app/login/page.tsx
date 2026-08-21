import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Card, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/events");

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Sign in" subtitle="Welcome back." />
      <Card>
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </Card>
    </div>
  );
}
