import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccount } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const account = await getAccount();
    if (!account) throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    if (!account.role && location.pathname !== "/welcome") throw redirect({ to: "/welcome" });
    return { account };
  },
  component: () => <Outlet />,
});
