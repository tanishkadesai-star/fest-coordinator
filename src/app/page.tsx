"use client";

import { useState } from "react";
import Board from "@/components/Board";
import FestPanel from "@/components/FestPanel";
import PlanPanel from "@/components/PlanPanel";
import type { Session } from "@/lib/types";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);

  return (
    <main>
      <header>
        <h1>Fest Coordinator</h1>
        <p className="muted">Plan the fest, then make sure every request has exactly one owner.</p>
      </header>

      {session && (
        <section className="card">
          <p className="muted">Fest code: share this with your team</p>
          <p className="code">{session.festCode}</p>
          <p className="muted">
            You are {session.name} · {session.department}
          </p>
        </section>
      )}

      {/* Joined volunteers don't need the planner; everyone else (and the organiser) sees it. */}
      {(!session || session.isOrganiser) && <PlanPanel />}

      {session ? <Board session={session} /> : <FestPanel onJoined={setSession} />}
    </main>
  );
}
