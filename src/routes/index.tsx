import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import patientIcon from "@/assets/patientIcon.svg";
import familyIcon from "@/assets/familyIcon.svg";
import careTeamIcon from "@/assets/careTeam.svg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — homeBuddy" },
      { name: "description", content: "Choose patient, family or care team to sign in to homeBuddy, the friendly daily check-in call." },
      { property: "og:title", content: "Sign in — homeBuddy" },
      { property: "og:description", content: "Daily check-in calls for seniors, with family and the care team kept in the loop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const shadow = { textShadow: "0 3px 6px rgb(0 0 0 / 0.25)" };

function Banner({ role, label, bg, ink, scene, front, icon }: { role: "senior" | "family" | "care_team"; label: string; bg: string; ink: string; scene: ReactNode; front?: ReactNode; icon: ReactNode }) {
  return (
    <Link
      to="/auth"
      search={{ role, redirect: undefined }}
      aria-label={`Sign in as ${label}`}
      className={`group relative block h-36 overflow-hidden transition-transform hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-ring md:h-40 ${bg}`}
    >
      <svg viewBox="0 0 700 140" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        {scene}
      </svg>
      <span className={`absolute left-5 top-1/2 grid size-24 -translate-y-1/2 place-items-center bg-scene-ink p-2 md:size-28 ${ink}`}>{icon}</span>
      <svg viewBox="0 0 700 140" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        {front}
      </svg>
      <span style={shadow} className="absolute left-36 top-1/2 -translate-y-1/2 text-5xl font-bold text-scene-ink md:left-44 md:text-6xl">
        {label}
      </span>
    </Link>
  );
}

function Index() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-10">
      <h1 className="text-6xl font-bold text-foreground">homeBuddy</h1>
      <p className="mt-2 text-lg italic">click an option to sign in</p>
      <div className="mt-6 space-y-6">
        <Banner
          role="senior"
          label="patient"
          bg="bg-sky-1"
          ink="text-sky-3"
          icon={<img src={patientIcon} alt="" className="max-h-full max-w-full object-contain" />}
          scene={
            <>
              <g className="fill-sky-3">
                <circle cx="230" cy="110" r="70" /><circle cx="360" cy="120" r="60" /><circle cx="520" cy="110" r="70" /><circle cx="650" cy="100" r="80" />
              </g>
            </>
          }
          front={
            <>
              <g className="fill-sky-2">
                <circle cx="20" cy="140" r="70" /><circle cx="140" cy="150" r="60" /><circle cx="280" cy="150" r="55" /><circle cx="420" cy="150" r="60" /><circle cx="560" cy="150" r="60" /><circle cx="690" cy="140" r="65" />
              </g>
            </>
          }
        />
        <Banner
          role="family"
          label="family"
          bg="bg-meadow-1"
          ink="text-meadow-ink"
          icon={<img src={familyIcon} alt="" className="max-h-full max-w-full object-contain" />}
          scene={
            <>
              <path className="fill-meadow-3" d="M0 90 L60 50 L120 100 L200 40 L270 90 L330 30 L400 100 L470 45 L540 95 L620 20 L700 70 L700 140 L0 140Z" />
            </>
          }
          front={
            <>
              <path className="fill-meadow-2" d="M0 140 L70 80 L150 140 L230 60 L300 130 L380 70 L450 140 L520 75 L600 140 L660 60 L700 100 L700 140Z" />
            </>
          }
        />
        <Banner
          role="care_team"
          label="care team"
          bg="bg-dusk-1"
          ink="text-dusk-ink"
          icon={<img src={careTeamIcon} alt="" className="max-h-full max-w-full object-contain" />}
          scene={
            <>
              <g className="fill-dusk-3">
                <rect x="160" y="50" width="70" height="90" /><rect x="300" y="70" width="60" height="70" /><rect x="420" y="40" width="80" height="100" /><rect x="530" y="30" width="120" height="110" /><rect x="640" y="50" width="60" height="90" />
              </g>
            </>
          }
          front={
            <>
              <g className="fill-dusk-2">
                <rect x="0" y="90" width="120" height="50" /><rect x="100" y="80" width="150" height="60" /><rect x="260" y="100" width="130" height="40" /><rect x="380" y="45" width="40" height="95" /><rect x="460" y="90" width="110" height="50" /><rect x="560" y="50" width="70" height="90" /><rect x="610" y="85" width="90" height="55" />
              </g>
            </>
          }
        />
      </div>
    </main>
  );
}
