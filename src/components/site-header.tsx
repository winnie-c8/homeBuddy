import { Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";

const links = [
  { to: "/senior", label: "Margaret's view" },
  { to: "/family", label: "Family" },
  { to: "/care", label: "Care team" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <HeartHandshake className="size-5" />
          </span>
          <span className="font-display text-xl font-semibold">Hearthline</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
