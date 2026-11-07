import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccount } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const account = await getAccount();
    if (!account) throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    return { account };
  },
  component: () => <Outlet />,
});
