import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Chaturanga } from "@/components/Chaturanga";
import { Hall } from "@/components/hall";
import { Splash } from "@/components/splash";
import type { PlayLaunch } from "@/components/battle-gate";
import type { RecentGame } from "@/components/Yuddha";
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
  const [splash, setSplash] = useState(true);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [playGate, setPlayGate] = useState(false);
  const [recent, setRecent] = useState<RecentGame[]>([]);
  const openId = useRef<string | null>(null);
  const onStart = (next: PlayLaunch) => {
    const { gate, ...launchOnly } = next;
    const label = labelFor(launchOnly);
    if (label) {
      const id = `${Date.now()}`;
      openId.current = id;
      setRecent((rows) => [{ id, ...label, result: "—", at: Date.now() }, ...rows].slice(0, 8));
    }
    const fresh =
      gate !== false &&
      (launchOnly.kind === "solo" || launchOnly.kind === "pvp" || launchOnly.kind === "online" || launchOnly.kind === "live");
    setPlayGate(fresh);
    setLaunch({ ...launchOnly });
  };
  const onNote = (result: string) => {
    const id = openId.current;
    if (!id) return;
    setRecent((rows) => rows.map((row) => (row.id === id ? { ...row, result } : row)));
  };
  return (
    <>
      {launch ? (
        <Chaturanga launch={launch} playGate={playGate} onLaunch={onStart} onNote={onNote} onHome={() => setLaunch(null)} recent={recent} />
      ) : (
        <Hall onStart={onStart} recent={recent} />
      )}
      {splash && <Splash onDone={() => setSplash(false)} />}
    </>
  );
}
