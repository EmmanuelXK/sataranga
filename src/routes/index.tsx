import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Chaturanga } from "@/components/Chaturanga";
import { Yuddha, type RecentGame } from "@/components/Yuddha";
import { ENGINES } from "@/game/engine";
import type { Launch } from "@/game/launch";

export const Route = createFileRoute("/")({ component: Home });

function labelFor(launch: Launch): { title: string; detail: string } | null {
  if (launch.kind === "solo") {
    return { title: `vs. ${ENGINES[launch.level].name}`, detail: "Bot" };
  }
  if (launch.kind === "pvp") return { title: "Same phone", detail: "Pass and play" };
  if (launch.kind === "online") return { title: "Online game", detail: "Online" };
  return null;
}

function Home() {
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [recent, setRecent] = useState<RecentGame[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const onPlay = (next: Launch) => {
    const label = labelFor(next);
    if (label) {
      const id = `${Date.now()}`;
      setOpenId(id);
      setRecent((rows) => [{ id, ...label, result: "—", at: Date.now() }, ...rows].slice(0, 8));
    }
    setLaunch(next);
  };
  const onLeave = (summary?: { result: string }) => {
    if (openId && summary?.result) {
      const id = openId;
      setRecent((rows) => rows.map((row) => (row.id === id ? { ...row, result: summary.result } : row)));
    }
    setOpenId(null);
    setLaunch(null);
  };
  const home = !launch || launch.kind === "prep" || launch.kind === "chaturaja";
  if (home) {
    return (
      <div className="screen-fade" key="home">
        <Yuddha onPlay={onPlay} recent={recent} />
      </div>
    );
  }
  return (
    <div className="screen-fade" key="play">
      <Chaturanga launch={launch} onLeave={onLeave} />
    </div>
  );
}
