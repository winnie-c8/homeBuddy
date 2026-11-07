import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearCare } from "@/lib/care-store";
import { PREVIEW_ALL_PAGES, ROLE_LABELS, roleHome, useAccount } from "@/lib/auth";

export function SiteHeader() {
  const account = useAccount();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    clearCare();
    await router.invalidate();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <HeartHandshake className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">homeBuddy</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {account ? (
            <>
              {PREVIEW_ALL_PAGES && (
                <span className="mr-2 flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
                  Test:
                  {(["/senior", "/family", "/care"] as const).map((to) => (
                    <Link key={to} to={to} className="rounded-full px-2 py-0.5 hover:bg-secondary hover:text-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>
                      {to.slice(1)}
                    </Link>
                  ))}
                </span>
              )}
              <Link
                to={roleHome(account.role)}
                className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <span className="font-medium text-foreground">{account.displayName}</span>
                {account.role && <span className="hidden sm:inline"> · {ROLE_LABELS[account.role]}</span>}
              </Link>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </>
          ) : account === null ? (
            <Link to="/auth" className="rounded-full bg-primary px-4 py-1.5 text-primary-foreground transition-colors hover:bg-primary/90">
              Sign in
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
