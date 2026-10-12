import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Chaturanga } from "@/components/Chaturanga";
import { Yuddha, type RecentGame } from "@/components/Yuddha";
import { ENGINES } from "@/game/engine";
import type { Launch } from "@/game/launch";

export const Route = createFileRoute("/")({ component: Home });

function labelFor(launch: Launch): { title: string; detail: string } | null {
  if (launch.kind === "solo") {
    return { title: `vs. ${ENGINES[launch.level].name}`, detail: launch.rated ? "Rated bot" : "Bot" };
  }
  if (launch.kind === "pvp") return { title: "Same phone", detail: "Pass and play" };
  if (launch.kind === "online") return { title: "Online game", detail: "Match" };
  return null;
}

function Home() {
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [recent, setRecent] = useState<RecentGame[]>([]);
  const onPlay = (next: Launch) => {
    const label = labelFor(next);
    if (label) {
      setRecent((rows) => [{ id: `${Date.now()}`, ...label, at: Date.now() }, ...rows].slice(0, 8));
    }
    setLaunch(next);
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
      <Chaturanga launch={launch} onLeave={() => setLaunch(null)} />
    </div>
  );
}
