import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { getBearerToken } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Shell } from "@/components/shell";
import { getDeskRole } from "@/lib/admin.functions";

export function StaffOnly({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    getDeskRole().then((role) => setOk(role === "admin")).catch(() => setOk(false));
  }, []);
  if (ok === null) return null;
  if (!ok) return <p className="rounded-3xl border p-6 text-[14px]">Admin only. Customer accounts cannot open this page.</p>;
  return children;
}

export function Authed({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const trusted = isPending && Boolean(getBearerToken());
  if (isPending && !trusted) {
    return (
      <Shell>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-card" />
          ))}
        </div>
      </Shell>
    );
  }
  if (!isPending && !user) return <RedirectToSignIn />;
  return <Shell>{children}</Shell>;
}
