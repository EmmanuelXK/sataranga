import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Chaturanga } from "@/components/Chaturanga";
import { Chaturaji } from "@/components/Chaturaji";
import { Yuddha } from "@/components/Yuddha";
import type { Launch } from "@/game/launch";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [launch, setLaunch] = useState<Launch | null>(null);
  if (!launch) return <Yuddha onPlay={setLaunch} />;
  if (launch.kind === "chaturaja") return <Chaturaji launch={launch} onLeave={() => setLaunch(null)} />;
  return <Chaturanga launch={launch} onLeave={() => setLaunch(null)} />;
}
