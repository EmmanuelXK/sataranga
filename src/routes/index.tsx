import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Chaturanga } from "@/components/Chaturanga";
import type { RecentGame } from "@/components/Yuddha";
import { ENGINES } from "@/game/engine";
import { pairClocks, TIME_CONTROL, type Launch } from "@/game/launch";

export const Route = createFileRoute("/")({ component: Home });

const OPENING: Launch = {
  kind: "solo",
  human: "w",
  level: 2,
  clocks: pairClocks("blitz"),
  increment: TIME_CONTROL.blitz.inc,
  rated: false,
};

function labelFor(launch: Launch): { title: string; detail: string } | null {
  if (launch.kind === "solo") {
    return { title: `vs. ${ENGINES[launch.level].name}`, detail: "Bot" };
  }
  if (launch.kind === "pvp") return { title: "Same phone", detail: "Pass and play" };
  if (launch.kind === "online") return { title: "Online game", detail: "Online" };
  return null;
}

function Home() {
  const [launch, setLaunch] = useState<Launch>(OPENING);
  const opening = labelFor(OPENING);
  const [recent, setRecent] = useState<RecentGame[]>(
    opening ? [{ id: "open", ...opening, result: "—", at: 0 }] : [],
  );
  const openId = useRef("open");
  const onLaunch = (next: Launch) => {
    const label = labelFor(next);
    if (label) {
      const id = `${Date.now()}`;
      openId.current = id;
      setRecent((rows) => [{ id, ...label, result: "—", at: Date.now() }, ...rows].slice(0, 8));
    }
    setLaunch({ ...next });
  };
  const onNote = (result: string) => {
    const id = openId.current;
    setRecent((rows) => rows.map((row) => (row.id === id ? { ...row, result } : row)));
  };
  return <Chaturanga launch={launch} onLaunch={onLaunch} onNote={onNote} recent={recent} />;
}
