import { cn } from "@/lib/utils";
import type { Status } from "@/lib/care";

const styles: Record<Status, { label: string; cls: string; dot: string }> = {
  green: { label: "On track", cls: "bg-status-green-soft text-foreground", dot: "bg-status-green" },
  yellow: { label: "Watch", cls: "bg-status-yellow-soft text-foreground", dot: "bg-status-yellow" },
  red: { label: "Needs attention", cls: "bg-status-red-soft text-foreground", dot: "bg-status-red" },
};

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("inline-block size-3 rounded-full", styles[status].dot, className)} aria-hidden />;
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = styles[status];
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold", s.cls, className)}>
      <StatusDot status={status} />
      {s.label}
    </span>
  );
}

export function Loading() {
  return <div className="mx-auto max-w-6xl px-5 py-16 text-muted-foreground">Loading…</div>;
}
