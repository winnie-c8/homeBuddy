import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Users, Stethoscope, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "homeBuddy — Stay independent at home, longer" },
      { name: "description", content: "A friendly daily AI check-in call connects seniors, families and their care team. No screens or tech skills needed." },
      { property: "og:title", content: "homeBuddy — Stay independent at home, longer" },
      { property: "og:description", content: "Daily AI check-in calls, medication follow-up and safety alerts for seniors and the people who care for them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const roles = [
  { to: "/senior", icon: Phone, who: "Margaret Thompson", role: "Senior, 82", text: "Take today's check-in call with Rosie." },
  { to: "/family", icon: Users, who: "Daniel Thompson", role: "Son", text: "See how Mom is doing and get alerts." },
  { to: "/care", icon: Stethoscope, who: "Dr. Anjali Patel", role: "Care team", text: "Review patients, answer questions, update plans." },
] as const;

function Index() {
  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-16">
      <section className="max-w-3xl">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
          <ShieldCheck className="size-4" /> Built for PHIPA / HIPAA privacy
        </p>
        <h1 className="text-5xl font-semibold leading-[1.05] text-foreground md:text-7xl">
          A friendly voice every morning. <span className="text-accent">Peace of mind</span> for everyone.
        </h1>
        <p className="mt-6 max-w-2xl text-xl leading-relaxed text-muted-foreground">
          homeBuddy calls at the same time each day to check on medications, meals, sleep, pain, mood and falls —
          then keeps family and the care team in the loop.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="mb-1 text-2xl font-semibold">Try the demo as…</h2>
        <p className="mb-6 text-muted-foreground">Sample patients for now — real sign-in comes next.</p>
        <div className="grid gap-5 md:grid-cols-3">
          {roles.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="group rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-1"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
                <r.icon className="size-6" />
              </span>
              <p className="mt-5 font-display text-2xl font-semibold">{r.who}</p>
              <p className="text-sm text-muted-foreground">{r.role}</p>
              <p className="mt-3 text-lg">{r.text}</p>
              <span className="mt-5 inline-flex items-center gap-1 font-bold text-primary">
                Continue <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
