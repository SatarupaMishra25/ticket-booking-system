import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";
import { Card, PageTitle } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/events");

  return (
    <div className="mx-auto max-w-lg py-6 sm:py-12">
      <Card className="p-6 sm:p-9">
        <div className="mb-7 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-[#2a14b4] text-white shadow-lg"><Icon name="ticket" size={28}/></span>
          <div className="mt-5"><PageTitle title="Sign in to TBS" subtitle="Enter your details to access your account." /></div>
        </div>
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </Card>
    </div>
  );
}
