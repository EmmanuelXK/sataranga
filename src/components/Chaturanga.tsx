import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import {
  ArrowLeftRight,
  BookOpen,
  ChevronLeft,
  Flag,
  Plus,
  Settings,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  ENGINES,
  PIECE_META,
  MATERIAL,
  applyMove,
  coord,
  fileOf,
  formatMove,
  inCheck,
  kingSquare,
  legalMoves,
  materialQuarters,
  other,
  outcome,
  pickAiMove,
  rankOf,
  replay,
  startPosition,
  type Color,
  type End,
  type Level,
  type Move,
  type Piece,
  type PieceType,
  type Position,
} from "@/game/engine";
import { playSound, unlockAudio } from "@/game/sound";
import { loadCareer, noteSolo } from "@/game/career";
import { noteBattle } from "@/game/profile";
import { PACE_MS } from "@/game/launch";
import { PieceGlyph } from "@/components/pieces";
import { P2PRoom } from "@/lib/multiplayer";
import type { Launch } from "@/game/launch";

const SAVE_KEY = "chaturanga-pvp-v1";

type Mode = "pvp" | "solo" | "live";

type Game = {
  moves: Move[];
  mode: Mode;
  human: Color;
  level: Level;
  bottom: Color | null;
  sound: boolean;
  names: Record<Color, string>;
  resigned: Color | null;
  flagged: Color | null;
};

const FRESH: Game = {
  moves: [],
  mode: "pvp",
  human: "w",
  level: 2,
  bottom: null,
  sound: true,
  names: { w: "White", b: "Black" },
  resigned: null,
  flagged: null,
};

function atPly(moves: Move[], ply: number): Position {
  let pos = startPosition();
  for (let i = 0; i < ply; i++) pos = applyMove(pos, moves[i]);
  return pos;
}

function loadGame(): Game | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<Game> & { v?: number };
    if (data.v !== 1 || !Array.isArray(data.moves)) return null;
    const pos = replay(data.moves as Move[]);
    if (!pos) return null;
    const mode = data.mode === "solo" ? "solo" : "pvp";
    const human = data.human === "b" ? "b" : "w";
    const level: Level = data.level === 1 || data.level === 3 || data.level === 4 ? data.level : 2;
    const bottom = data.bottom === "w" || data.bottom === "b" ? data.bottom : null;
    const names = {
      w: typeof data.names?.w === "string" && data.names.w.trim() ? data.names.w.slice(0, 18) : "White",
      b: typeof data.names?.b === "string" && data.names.b.trim() ? data.names.b.slice(0, 18) : "Black",
    };
    const resigned = data.resigned === "w" || data.resigned === "b" ? data.resigned : null;
    return {
      moves: pos.moves,
      mode,
      human,
      level,
      bottom,
      sound: data.sound !== false,
      names,
      resigned,
      flagged: null,
    };
  } catch {
    return null;
  }
}

function persist(game: Game) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, ...game }));
}

function endOf(game: Game, live: Position): End {
  if (game.flagged) return { kind: "win", winner: other(game.flagged), reason: "time" };
  if (game.resigned) return { kind: "win", winner: other(game.resigned), reason: "resign" };
  return outcome(live);
}

function headline(end: End, names: Record<Color, string>): string {
  if (end.kind === "ongoing") return "";
  if (end.kind === "draw") {
    if (end.reason === "mutual_bare") return "Draw · mutual bare";
    if (end.reason === "repetition") return "Draw · threefold repetition";
    return "Draw · lone Rajas";
  }
  const who = names[end.winner];
  if (end.reason === "checkmate") return `Checkmate · ${who} wins`;
  if (end.reason === "stalemate") return `Stalemate · ${who} wins`;
  if (end.reason === "bare_raja") return `Bare Raja · ${who} wins`;
  if (end.reason === "time") return `Time · ${who} wins`;
  return `${who} wins on resignation`;
}

function detail(end: End): string {
  if (end.kind === "draw" && end.reason === "mutual_bare")
    return "The side left with only a Raja could bare the other Raja on the next move. The game is drawn.";
  if (end.kind === "draw" && end.reason === "repetition")
    return "The same position has appeared three times.";
  if (end.kind === "draw") return "Only the two Rajas remain.";
  if (end.kind === "win" && end.reason === "stalemate")
    return "No legal move, and the Raja is not in check. In Sataranga that is a loss, not a draw.";
  if (end.kind === "win" && end.reason === "bare_raja")
    return "One side has only the Raja left, and cannot bare the other Raja immediately.";
  if (end.kind === "win" && end.reason === "checkmate")
    return "The Raja is in check and has no legal move.";
  if (end.kind === "win" && end.reason === "resign") return "The player to move resigned.";
  if (end.kind === "win" && end.reason === "time") return "The clock ran out.";
  return "";
}

function fmtLead(quarters: number): string {
  if (quarters === 0) return "";
  const sign = quarters > 0 ? "+" : "−";
  const n = Math.abs(quarters);
  const whole = Math.floor(n / 4);
  const frac = ["", "¼", "½", "¾"][n % 4];
  return sign + (whole ? String(whole) : "") + frac;
}

function startClocks(launch: Launch): Record<Color, number> {
  if (launch.kind !== "resume" && launch.clocks) return { w: launch.clocks.w, b: launch.clocks.b };
  const pace = launch.kind === "resume" ? undefined : launch.pace;
  const ms = pace ? PACE_MS[pace] : 0;
  return { w: ms, b: ms };
}

export function Chaturanga({ launch, onLeave }: { launch: Launch; onLeave: () => void }) {
  const [game, setGame] = useState<Game>(FRESH);
  const [ply, setPly] = useState(0);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [flight, setFlight] = useState<{ from: number; to: number; color: Color; type: PieceType } | null>(
    null,
  );
  const [shown, setShown] = useState<Color>("w");
  const [thinking, setThinking] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [overOpen, setOverOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "new" | "resign">(null);
  const [editing, setEditing] = useState<Color | null>(null);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "wait" | "play" | "failed">("connecting");
  const [liveColor, setLiveColor] = useState<Color>("w");
  const [copied, setCopied] = useState(false);
  const [landSq, setLandSq] = useState<number | null>(null);
  const baseClock = startClocks(launch);
  const timed = baseClock.w > 0 || baseClock.b > 0;
  const [clock, setClock] = useState<Record<Color, number>>(baseClock);
  const recorded = useRef("");
  const busy = useRef(false);
  const selfId = useRef(`p${Math.random().toString(36).slice(2, 12)}`);
  const liveRef = useRef<P2PRoom | null>(null);
  const movesRef = useRef(game.moves);
  const liveColorRef = useRef<Color>("w");
  movesRef.current = game.moves;
  liveColorRef.current = liveColor;

  useEffect(() => {
    if (launch.kind === "resume") {
      const saved = loadGame();
      if (saved) {
        setGame(saved);
        setPly(saved.moves.length);
      }
      setReady(true);
      return;
    }
    if (launch.kind === "solo") {
      const engine = ENGINES[launch.level].name;
      const you = loadCareer().name;
      setGame({
        ...FRESH,
        mode: "solo",
        human: launch.human,
        level: launch.level,
        bottom: launch.human,
        names: {
          w: launch.human === "w" ? you : engine,
          b: launch.human === "b" ? you : engine,
        },
      });
      setPly(0);
      setReady(true);
      return;
    }
    if (launch.kind === "live") {
      setGame({ ...FRESH, mode: "live", names: { w: "White", b: "Black" }, bottom: "w" });
      setPly(0);
      setLiveStatus("connecting");
      setReady(true);
      return;
    }
    setGame({ ...FRESH, mode: "pvp" });
    setPly(0);
    setReady(true);
  }, [launch]);

  useEffect(() => {
    if (ready && game.mode !== "live") persist(game);
  }, [game, ready]);

  const live = useMemo(() => atPly(game.moves, game.moves.length), [game.moves]);
  const view = useMemo(() => atPly(game.moves, ply), [game.moves, ply]);
  const end = endOf(game, live);
  const endKey =
    end.kind === "ongoing" ? "" : `${end.kind}:${end.kind === "win" ? end.winner + end.reason : end.reason}`;

  useEffect(() => {
    if (endKey) setOverOpen(true);
  }, [endKey]);

  useEffect(() => {
    if (!endKey || game.mode !== "solo" || game.moves.length < 2) return;
    if (recorded.current === endKey) return;
    recorded.current = endKey;
    if (end.kind === "ongoing") return;
    const result = end.kind === "draw" ? "draw" : end.winner === game.human ? "win" : "loss";
    noteSolo(game.level, ENGINES[game.level].name, result);
    const rated = launch.kind === "solo" && !!launch.rated;
    const head = launch.kind === "solo" ? launch.head : undefined;
    noteBattle({ result, rated, head });
  }, [endKey, end, game.mode, game.moves.length, game.human, game.level, launch]);

  const logical: Color = (() => {
    if (game.mode === "solo") return game.bottom ?? game.human;
    if (game.bottom) return game.bottom;
    return view.turn;
  })();

  useEffect(() => {
    if (flight) return;
    setShown(logical);
  }, [flight, logical]);

  useEffect(() => {
    if (!flight) return;
    const id = window.setTimeout(() => setFlight(null), 200);
    return () => window.clearTimeout(id);
  }, [flight]);

  const aiTurn =
    game.mode === "solo" &&
    ply === game.moves.length &&
    end.kind === "ongoing" &&
    live.turn !== game.human;

  useEffect(() => {
    if (!aiTurn) {
      setThinking(false);
      return;
    }
    setThinking(true);
    let cancel = false;
    const worker = new Worker(new URL("../game/ai.worker.ts", import.meta.url), { type: "module" });
    const id = window.setTimeout(() => {
      if (cancel) return;
      worker.postMessage({ pos: live, level: game.level });
    }, 180);
    worker.onmessage = (event: MessageEvent<Move | null>) => {
      if (cancel) return;
      setThinking(false);
      const move = event.data;
      if (move) commitMove(move, live);
      worker.terminate();
    };
    worker.onerror = () => {
      if (cancel) return;
      const move = pickAiMove(live, game.level);
      setThinking(false);
      if (move) commitMove(move, live);
    };
    return () => {
      cancel = true;
      window.clearTimeout(id);
      worker.terminate();
    };
    // commitMove reads the latest sound flag; the searched position is this snapshot
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiTurn, game.moves, game.level, game.human, ply]);

  function commitMove(move: Move, fromPos: Position) {
    if (busy.current) return;
    busy.current = true;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setFlight({ from: move.from, to: move.to, color: move.color, type: move.piece });
    else setFlight(null);
    window.setTimeout(() => {
      busy.current = false;
    }, reduce ? 0 : 200);
    setSelected(null);
    setLandSq(move.to);
    setGame((g) => ({ ...g, moves: [...g.moves, move], resigned: null }));
    setPly((p) => p + 1);
    if (game.sound) {
      const next = applyMove(fromPos, move);
      const after = outcome(next);
      const kind =
        after.kind !== "ongoing" ? "end" : inCheck(next) ? "check" : move.captured ? "capture" : "move";
      playSound(kind);
    }
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }

  const acceptRef = useRef<(from: number, to: number, promotion: boolean) => void>(() => {});
  acceptRef.current = (from, to, promotion) => {
    const moves = movesRef.current;
    const pos = atPly(moves, moves.length);
    if (pos.turn === liveColorRef.current) return;
    const move = legalMoves(pos).find((m) => m.from === from && m.to === to && m.promotion === promotion);
    if (!move) return;
    commitMove(move, pos);
  };

  useEffect(() => {
    if (launch.kind !== "live") return;
    let closed = false;
    const id = selfId.current;
    const room = new P2PRoom({
      room: launch.room,
      selfId: id,
      name: launch.name || "You",
      onPeersChanged: (peers) => {
        const friend = peers.find((p) => p.connectionState === "connected");
        if (!friend) {
          setLiveStatus(peers.some((p) => p.connectionState === "failed") ? "failed" : "wait");
          return;
        }
        const mine: Color = id < friend.id ? "w" : "b";
        setLiveColor(mine);
        liveColorRef.current = mine;
        setLiveStatus("play");
        const you = launch.name || "You";
        const them = friend.name || "Friend";
        setGame((g) => ({
          ...g,
          human: mine,
          bottom: mine,
          names: { w: mine === "w" ? you : them, b: mine === "b" ? you : them },
        }));
      },
      onMessage: (_from, data) => {
        if (!data || typeof data !== "object") return;
        const msg = data as { t?: string; from?: number; to?: number; promotion?: boolean };
        if (msg.t === "mv" && typeof msg.from === "number" && typeof msg.to === "number") {
          acceptRef.current(msg.from, msg.to, !!msg.promotion);
        }
        if (msg.t === "rs") {
          setGame((g) => ({ ...g, resigned: other(liveColorRef.current) }));
          setPly(movesRef.current.length);
        }
        if (msg.t === "ng") resetRef.current(false);
      },
    });
    liveRef.current = room;
    room.join().catch(() => {
      if (!closed) setLiveStatus("failed");
    });
    return () => {
      closed = true;
      room.close();
      liveRef.current = null;
    };
  }, [launch]);

  function playUser(from: number, to: number) {
    if (ply !== game.moves.length || end.kind !== "ongoing" || thinking) return;
    if (game.mode === "solo" && view.turn !== game.human) return;
    if (game.mode === "live" && (liveStatus !== "play" || view.turn !== liveColor)) return;
    const legal = legalMoves(view);
    const move = legal.find((m) => m.from === from && m.to === to);
    if (!move) return;
    commitMove(move, view);
    if (game.mode === "live") liveRef.current?.send({ t: "mv", from: move.from, to: move.to, promotion: move.promotion });
  }

  function undo() {
    if (game.resigned && ply === game.moves.length) {
      setGame((g) => ({ ...g, resigned: null }));
      setOverOpen(false);
      return;
    }
    if (!game.moves.length) return;
    setFlight(null);
    busy.current = false;
    setSelected(null);
    setOverOpen(false);
    setGame((g) => {
      let next = g.moves.slice(0, -1);
      if (g.mode === "solo" && next.length) {
        const back = atPly(next, next.length);
        if (back.turn !== g.human) next = next.slice(0, -1);
      }
      setPly(next.length);
      return { ...g, moves: next, resigned: null };
    });
  }

  const resetRef = useRef<(broadcast: boolean) => void>(() => {});
  function newGame(broadcast = true) {
    setFlight(null);
    setSelected(null);
    setLandSq(null);
    setOverOpen(false);
    setConfirm(null);
    setPly(0);
    recorded.current = "";
    setClock(startClocks(launch));
    setGame((g) => ({ ...g, moves: [], resigned: null, flagged: null }));
    if (broadcast && game.mode === "live") liveRef.current?.send({ t: "ng" });
  }
  resetRef.current = newGame;

  function resign() {
    if (end.kind !== "ongoing") return;
    setGame((g) => ({ ...g, resigned: live.turn }));
    setPly(game.moves.length);
    setConfirm(null);
    if (game.mode === "live") liveRef.current?.send({ t: "rs" });
    if (game.sound) playSound("end");
  }

  const sans = useMemo(() => {
    const out: string[] = [];
    let pos = startPosition();
    for (const m of game.moves) {
      const legal = legalMoves(pos);
      out.push(formatMove(pos, m, legal));
      pos = applyMove(pos, m);
    }
    return out;
  }, [game.moves]);

  const interactive =
    end.kind === "ongoing" &&
    ply === game.moves.length &&
    !thinking &&
    !flight &&
    !(game.mode === "solo" && view.turn !== game.human) &&
    !(game.mode === "live" && (liveStatus !== "play" || view.turn !== liveColor));

  const legal = interactive ? legalMoves(view) : [];
  const targets = legal.filter((m) => m.from === selected).map((m) => m.to);
  const last = ply > 0 ? game.moves[ply - 1] : null;
  const checkSq = inCheck(view) ? kingSquare(view.board, view.turn) : -1;
  const lead = materialQuarters(view.board, "w") - materialQuarters(view.board, "b");

  useEffect(() => {
    if (!timed || end.kind !== "ongoing" || ply !== game.moves.length) return;
    if (game.mode === "live" && liveStatus !== "play") return;
    const id = window.setInterval(() => {
      setClock((cur) => {
        const side = live.turn;
        return { ...cur, [side]: Math.max(0, cur[side] - 200) };
      });
    }, 200);
    return () => window.clearInterval(id);
  }, [timed, end.kind, ply, game.moves.length, game.mode, liveStatus, live.turn]);

  useEffect(() => {
    if (!timed || end.kind !== "ongoing") return;
    if (clock[live.turn] > 0) return;
    setGame((g) => (g.flagged || g.resigned ? g : { ...g, flagged: live.turn }));
  }, [clock, live.turn, end.kind, timed]);

  function fmtClock(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  const captured = (by: Color): PieceType[] => {
    const list: PieceType[] = [];
    for (let i = 0; i < ply; i++) {
      const m = game.moves[i];
      if (m.captured && m.color === by) list.push(m.captured);
    }
    return list.sort((a, b) => MATERIAL[a] - MATERIAL[b] || (a < b ? -1 : 1));
  };

  const subtitle =
    game.mode === "solo"
      ? `Computer · ${ENGINES[game.level].name}`
      : game.mode === "live"
        ? launch.kind === "live"
          ? liveStatus === "play"
            ? `Live · ${launch.room}`
            : `Table ${launch.room} · waiting`
          : "Live table"
        : game.bottom
          ? "Pass & play · board locked"
          : "Pass & play";

  const sheetOpen = rulesOpen || settingsOpen || overOpen || confirm !== null;

  return (
    <main className="shell play">
      <header className="top">
        <div className="top-lead">
          <button type="button" className="icon-btn" onClick={onLeave}>
            <ChevronLeft strokeWidth={1.75} />
            <span>Lobby</span>
          </button>
          <div>
            <h1 className="wordmark">SATARANGA</h1>
            <p className="sub">{subtitle}</p>
          </div>
        </div>
        <div className="top-actions">
          <button type="button" className="icon-btn" onClick={() => setRulesOpen(true)}>
            <BookOpen strokeWidth={1.75} />
            <span>Moves</span>
          </button>
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)}>
            <Settings strokeWidth={1.75} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {game.mode === "live" && launch.kind === "live" && liveStatus !== "play" && (
        <div className="wait-card">
          <p className="eyebrow">{liveStatus === "failed" ? "No connection" : "Private table"}</p>
          <p className="wait-code">{launch.room}</p>
          <p className="card-copy">
            {liveStatus === "failed"
              ? "This table did not connect. Go back to the lobby and try the code again."
              : "Share this code with one friend. The board starts when they join. Unrated, and there is no referee."}
          </p>
          {liveStatus !== "failed" && (
            <button
              type="button"
              className="play-second"
              onClick={() => {
                const room = launch.room;
                void navigator.clipboard?.writeText(room).then(
                  () => setCopied(true),
                  () => setCopied(false),
                );
              }}
            >
              {copied ? "Copied" : "Copy code"}
            </button>
          )}
        </div>
      )}
      {end.kind !== "ongoing" && (
        <button type="button" className="result-banner" onClick={() => setOverOpen(true)}>
          {headline(end, game.names)}
        </button>
      )}

      <div className="layout">
        <section className="stage" inert={sheetOpen ? true : undefined}>
          <div className="frame">
            <PlayerBar
              color={other(shown)}
              name={game.names[other(shown)]}
              active={view.turn === other(shown) && end.kind === "ongoing"}
              thinking={thinking && live.turn === other(shown)}
              check={checkSq >= 0 && view.turn === other(shown)}
              lead={other(shown) === "w" ? lead : -lead}
              captured={captured(other(shown))}
              time={timed ? fmtClock(clock[other(shown)]) : null}
              low={timed ? clock[other(shown)] < 10000 : false}
              role={game.mode === "solo" && other(shown) !== game.human ? "Engine" : null}
              editing={editing === other(shown)}
              onEdit={() => setEditing(other(shown))}
              onName={(value) => {
                setGame((g) => ({ ...g, names: { ...g.names, [other(shown)]: value } }));
                setEditing(null);
              }}
            />
            <Board
              board={view.board}
              orientation={shown}
              selected={selected}
              targets={targets}
              last={last}
              checkSq={checkSq}
              flight={flight}
              landSq={landSq}
              interactive={interactive}
              turn={view.turn}
              onSelect={setSelected}
              onMove={playUser}
            />
            <PlayerBar
              color={shown}
              name={game.names[shown]}
              active={view.turn === shown && end.kind === "ongoing"}
              thinking={thinking && live.turn === shown}
              check={checkSq >= 0 && view.turn === shown}
              lead={shown === "w" ? lead : -lead}
              captured={captured(shown)}
              time={timed ? fmtClock(clock[shown]) : null}
              low={timed ? clock[shown] < 10000 : false}
              role={game.mode === "solo" && shown !== game.human ? "Engine" : null}
              editing={editing === shown}
              onEdit={() => setEditing(shown)}
              onName={(value) => {
                setGame((g) => ({ ...g, names: { ...g.names, [shown]: value } }));
                setEditing(null);
              }}
            />
          </div>

          <div className="toolbar">
            <button
              type="button"
              className="tool"
              onClick={undo}
              disabled={(launch.kind === "solo" && !!launch.strict) || (!game.moves.length && !game.resigned && !game.flagged)}
            >
              <Undo2 strokeWidth={1.75} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              className={clsx("tool", game.bottom && "tool-on")}
              onClick={() => {
                const cur = game.mode === "solo" ? (game.bottom ?? game.human) : (game.bottom ?? view.turn);
                setGame((g) => ({ ...g, bottom: other(cur) }));
                setFlight(null);
              }}
            >
              <ArrowLeftRight strokeWidth={1.75} />
              <span>Flip</span>
            </button>
            <button
              type="button"
              className="tool"
              onClick={() => {
                if (game.moves.length && end.kind === "ongoing") setConfirm("new");
                else newGame();
              }}
            >
              <Plus strokeWidth={1.75} />
              <span>New</span>
            </button>
            <button
              type="button"
              className="tool"
              disabled={end.kind !== "ongoing" || (game.mode === "solo" && live.turn !== game.human)}
              onClick={() => setConfirm("resign")}
            >
              <Flag strokeWidth={1.75} />
              <span>Resign</span>
            </button>
          </div>

          <MoveStrip sans={sans} ply={ply} onPick={setPly} />
        </section>

        <aside className="side">
          <div className="side-head">
            <h2>Score</h2>
            <p>{end.kind === "ongoing" ? (view.turn === "w" ? "White to move" : "Black to move") : headline(end, game.names)}</p>
          </div>
          <MoveList sans={sans} ply={ply} onPick={setPly} />
          <p className="side-note">
            Raja on d, Mantri on e. The elephant leaps two diagonals. Stalemate loses. A bare Raja loses unless it can
            bare back at once.
          </p>
        </aside>
      </div>

      <p className="sr-only" aria-live="polite">
        {end.kind === "ongoing"
          ? `${view.turn === "w" ? "White" : "Black"} to move${checkSq >= 0 ? ", check" : ""}`
          : headline(end, game.names)}
      </p>

      <Sheet open={rulesOpen} onOpenChange={setRulesOpen} title="How the pieces move" description="Sataranga — old Ceylon chess. The same laws on every table.">
        <ul className="rules">
          {(Object.keys(PIECE_META) as PieceType[]).map((type) => (
            <li key={type}>
              <Mini type={type} />
              <div>
                <strong>
                  {PIECE_META[type].name}
                  <span> {PIECE_META[type].aka}</span>
                </strong>
                <p>{PIECE_META[type].blurb}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="rule-notes">
          <p>Rajas start facing on the d-file. Mantris stand on e.</p>
          <p>You may not leave your own Raja in check.</p>
          <p>Checkmate wins. Stalemate is a loss for the player who cannot move.</p>
          <p>Bare Raja wins at once, unless the bare side can bare you on the next move — that is a draw.</p>
          <p>Threefold repetition is a draw. There is no castling and no en passant.</p>
        </div>
      </Sheet>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen} title="Settings" description="Game mode, board direction, and sound.">
        {launch.kind === "live" ? (
          <p className="side-note">Private table. Go back to the lobby to start a different game.</p>
        ) : (
        <Field label="Play">
          <Segment
            value={game.mode}
            options={[
              ["pvp", "Pass & play"],
              ["solo", "Computer"],
            ]}
            onChange={(mode) => {
              setGame((g) => ({
                ...g,
                mode,
                moves: [],
                resigned: null,
                bottom: mode === "solo" ? g.human : null,
                human: mode === "solo" ? g.human : "w",
              }));
              setPly(0);
              setSelected(null);
              setFlight(null);
            }}
          />
        </Field>
        )}
        {game.mode === "solo" && (
          <>
            <Field label="You play">
              <Segment
                value={game.human}
                options={[
                  ["w", "White"],
                  ["b", "Black"],
                ]}
                onChange={(human) => {
                  setGame((g) => ({ ...g, human, moves: [], resigned: null, bottom: null }));
                  setPly(0);
                }}
              />
            </Field>
            <Field label="Engine">
              <Segment
                value={String(game.level)}
                options={[
                  ["1", "Padati"],
                  ["2", "Ashva"],
                  ["3", "Gaja"],
                  ["4", "Raja"],
                ]}
                onChange={(level) => {
                  const lv = Number(level) as Level;
                  setGame((g) => {
                    const names = { ...g.names, [other(g.human)]: ENGINES[lv].name };
                    return { ...g, level: lv, names };
                  });
                }}
              />
            </Field>
          </>
        )}
        {game.mode === "pvp" && (
          <Field label="Board">
            <Segment
              value={game.bottom ? "lock" : "auto"}
              options={[
                ["auto", "Follow turn"],
                ["lock", "Stay flipped"],
              ]}
              onChange={(value) =>
                setGame((g) => ({
                  ...g,
                  bottom: value === "auto" ? null : (g.bottom ?? other(view.turn)),
                }))
              }
            />
          </Field>
        )}
        <button
          type="button"
          className="sound-row"
          onClick={() => {
            unlockAudio();
            setGame((g) => ({ ...g, sound: !g.sound }));
          }}
        >
          {game.sound ? <Volume2 strokeWidth={1.75} /> : <VolumeX strokeWidth={1.75} />}
          <span>{game.sound ? "Sound on" : "Sound off"}</span>
        </button>
      </Sheet>

      <Sheet
        open={overOpen && end.kind !== "ongoing"}
        onOpenChange={setOverOpen}
        title={end.kind === "draw" ? "Draw" : "Game over"}
        description={detail(end)}
      >
        <p className="over-title">{headline(end, game.names)}</p>
        <p className="over-copy">{detail(end)}</p>
        <div className="over-actions">
          <button type="button" className="btn primary" onClick={() => newGame()}>
            Rematch
          </button>
          <button type="button" className="btn" onClick={() => setOverOpen(false)}>
            Review board
          </button>
          <button type="button" className="btn" onClick={onLeave}>
            Lobby
          </button>
        </div>
      </Sheet>

      <Sheet
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirm === "resign" ? "Resign this game?" : "Start a new game?"}
        description={confirm === "resign" ? "The player to move will lose." : "The current game will be cleared."}
      >
        <div className="over-actions">
          <button type="button" className="btn primary" onClick={confirm === "resign" ? resign : () => newGame()}>
            {confirm === "resign" ? "Resign" : "New game"}
          </button>
          <button type="button" className="btn" onClick={() => setConfirm(null)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </main>
  );
}

function PlayerBar({
  color,
  name,
  active,
  thinking,
  check,
  lead,
  captured,
  time,
  low,
  role,
  editing,
  onEdit,
  onName,
}: {
  color: Color;
  name: string;
  active: boolean;
  thinking: boolean;
  check: boolean;
  lead: number;
  captured: PieceType[];
  time: string | null;
  low: boolean;
  role: string | null;
  editing: boolean;
  onEdit: () => void;
  onName: (value: string) => void;
}) {
  return (
    <div className={clsx("player", active && "player-active")}>
      <span className={clsx("swatch", color === "w" ? "swatch-w" : "swatch-b")} aria-hidden="true" />
      <div className="player-main">
        <div className="player-line">
          {editing ? (
            <input
              className="name-input"
              autoFocus
              defaultValue={name}
              maxLength={18}
              aria-label="Player name"
              onBlur={(e) => onName(e.target.value.trim() || name)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
          ) : (
            <button type="button" className="name" onClick={onEdit}>
              {name}
            </button>
          )}
          {role && <span className="role">{role}</span>}
          {check && <span className="check-tag">Check</span>}
          {thinking && <span className="think">Thinking</span>}
          {lead > 0 && <span className="lead">{fmtLead(lead)}</span>}
          {time && <span className={clsx("clk", low && "clk-low")}>{time}</span>}
        </div>
        <div className="caps">
          {captured.map((type, i) => (
            <PieceGlyph key={type + i} type={type} color={other(color)} className="cap" />
          ))}
        </div>
      </div>
    </div>
  );
}

function Board({
  board,
  orientation,
  selected,
  targets,
  last,
  checkSq,
  flight,
  landSq,
  interactive,
  turn,
  onSelect,
  onMove,
}: {
  board: (Piece | null)[];
  orientation: Color;
  selected: number | null;
  targets: number[];
  last: Move | null;
  checkSq: number;
  flight: { from: number; to: number; color: Color; type: PieceType } | null;
  landSq: number | null;
  interactive: boolean;
  turn: Color;
  onSelect: (sq: number | null) => void;
  onMove: (from: number, to: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sqPx, setSqPx] = useState(0);
  const [drag, setDrag] = useState<{
    pointer: number;
    from: number;
    x: number;
    y: number;
    active: boolean;
  } | null>(null);
  const [flown, setFlown] = useState(false);
  const targetSet = useMemo(() => new Set(targets), [targets]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSqPx(el.clientWidth / 8);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!flight) {
      setFlown(false);
      return;
    }
    setFlown(false);
    const id = requestAnimationFrame(() => setFlown(true));
    return () => cancelAnimationFrame(id);
  }, [flight]);

  function squareAt(clientX: number, clientY: number): number | null {
    const el = ref.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) return null;
    const f = Math.min(7, Math.floor((x / r.width) * 8));
    const rk = Math.min(7, Math.floor((y / r.height) * 8));
    const file = orientation === "w" ? f : 7 - f;
    const rank = orientation === "w" ? 7 - rk : rk;
    return rank * 8 + file;
  }

  function origin(sq: number) {
    const file = fileOf(sq);
    const rank = rankOf(sq);
    const x = (orientation === "w" ? file : 7 - file) * sqPx;
    const y = (orientation === "w" ? 7 - rank : rank) * sqPx;
    return { x, y };
  }

  const ranks = orientation === "w" ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = orientation === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const fromSq = drag?.from ?? selected;

  const flightStart = flight && sqPx ? origin(flight.from) : null;
  const flightEnd = flight && sqPx ? origin(flight.to) : null;
  const flightPos = flown ? flightEnd : flightStart;

  return (
    <div
      className={clsx("board", drag?.active && "board-dragging")}
      ref={ref}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        unlockAudio();
        const sq = squareAt(e.clientX, e.clientY);
        if (sq == null || !interactive) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const piece = board[sq];
        if (piece && piece.color === turn) {
          onSelect(sq);
          setDrag({ pointer: e.pointerId, from: sq, x: e.clientX, y: e.clientY, active: false });
          return;
        }
        if (fromSq != null && targetSet.has(sq)) onMove(fromSq, sq);
        else onSelect(null);
      }}
      onPointerMove={(e) => {
        if (!drag || drag.pointer !== e.pointerId) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.active && dx * dx + dy * dy > 36) setDrag({ ...drag, active: true, x: e.clientX, y: e.clientY });
        else if (drag.active) setDrag({ ...drag, x: e.clientX, y: e.clientY });
      }}
      onPointerUp={(e) => {
        if (!drag || drag.pointer !== e.pointerId) return;
        if (drag.active) {
          const sq = squareAt(e.clientX, e.clientY);
          if (sq != null && targetSet.has(sq)) onMove(drag.from, sq);
        }
        setDrag(null);
      }}
      onPointerCancel={() => setDrag(null)}
    >
      {ranks.map((rank) =>
        files.map((file) => {
          const sq = rank * 8 + file;
          const piece = board[sq];
          const dark = (file + rank) % 2 === 0;
          const showFile = rank === (orientation === "w" ? 0 : 7);
          const showRank = file === (orientation === "w" ? 0 : 7);
          const hidePiece = (flight && flight.to === sq) || (drag?.active && drag.from === sq);
          return (
            <button
              key={sq}
              type="button"
              className={clsx(
                "sq",
                dark ? "sq-dark" : "sq-light",
                selected === sq && "sq-selected",
                last && (last.from === sq || last.to === sq) && "sq-last",
                checkSq === sq && "sq-check",
              )}
              aria-label={`${coord(sq)}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${PIECE_META[piece.type].name}` : ""}`}
            >
              {showRank && <i className={clsx("coord rank", dark ? "coord-on-dark" : "coord-on-light")}>{rank + 1}</i>}
              {showFile && (
                <i className={clsx("coord file", dark ? "coord-on-dark" : "coord-on-light")}>{"abcdefgh"[file]}</i>
              )}
              {piece && !hidePiece && (
                <span className={clsx("piece-wrap", piece.type === "K" && "piece-k", landSq === sq && "piece-land")}>
                  <PieceGlyph type={piece.type} color={piece.color} />
                </span>
              )}
              {fromSq != null && targetSet.has(sq) && !piece && <i className="dot" />}
              {fromSq != null && targetSet.has(sq) && piece && <i className="ring" />}
            </button>
          );
        }),
      )}
      {flight && flightPos && (
        <div
          className="flight"
          style={{
            width: flight.type === "K" ? sqPx * 1.14 : sqPx,
            height: flight.type === "K" ? sqPx * 1.14 : sqPx,
            transform: `translate(${flightPos.x - (flight.type === "K" ? sqPx * 0.07 : 0)}px, ${flightPos.y - (flight.type === "K" ? sqPx * 0.12 : 0)}px)`,
          }}
        >
          <PieceGlyph type={flight.type} color={flight.color} />
        </div>
      )}
      {drag?.active && sqPx > 0 && board[drag.from] && (
        <div
          className="ghost"
          style={{
            width: sqPx * (board[drag.from]!.type === "K" ? 1.18 : 1.05),
            height: sqPx * (board[drag.from]!.type === "K" ? 1.18 : 1.05),
            transform: `translate(${drag.x - sqPx * 0.52}px, ${drag.y - sqPx * 0.62}px)`,
          }}
        >
          <PieceGlyph type={board[drag.from]!.type} color={board[drag.from]!.color} />
        </div>
      )}
    </div>
  );
}

function MoveStrip({ sans, ply, onPick }: { sans: string[]; ply: number; onPick: (ply: number) => void }) {
  if (!sans.length) return <p className="empty-moves">Moves show up here.</p>;
  return (
    <div className="strip">
      {sans.map((san, i) => (
        <button key={i} type="button" className={clsx("move-btn", ply === i + 1 && "on")} onClick={() => onPick(i + 1)}>
          {i % 2 === 0 && <span className="mn">{i / 2 + 1}</span>}
          {san}
        </button>
      ))}
    </div>
  );
}

function MoveList({ sans, ply, onPick }: { sans: string[]; ply: number; onPick: (ply: number) => void }) {
  if (!sans.length) return <p className="empty-side">No moves yet.</p>;
  const rows: { n: number; w?: string; b?: string; wp?: number; bp?: number }[] = [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: sans[i], b: sans[i + 1], wp: i + 1, bp: sans[i + 1] ? i + 2 : undefined });
  }
  return (
    <ol className="score">
      {rows.map((row) => (
        <li key={row.n}>
          <span className="mn">{row.n}</span>
          <button type="button" className={clsx("move-btn", ply === row.wp && "on")} onClick={() => onPick(row.wp!)}>
            {row.w}
          </button>
          {row.b ? (
            <button type="button" className={clsx("move-btn", ply === row.bp && "on")} onClick={() => onPick(row.bp!)}>
              {row.b}
            </button>
          ) : (
            <span />
          )}
        </li>
      ))}
    </ol>
  );
}

function Mini({ type }: { type: PieceType }) {
  const dots = new Set<string>();
  const mark = (x: number, y: number) => {
    if (x >= 0 && x < 5 && y >= 0 && y < 5) dots.add(`${x},${y}`);
  };
  if (type === "K") for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) mark(2 + dx, 2 + dy);
  if (type === "M") for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) mark(2 + dx, 2 + dy);
  if (type === "G") for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) mark(2 + dx, 2 + dy);
  if (type === "A")
    for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) mark(2 + dx, 2 + dy);
  if (type === "R") {
    for (let i = 0; i < 5; i++) {
      if (i !== 2) {
        mark(i, 2);
        mark(2, i);
      }
    }
  }
  if (type === "P") {
    mark(2, 1);
    mark(1, 1);
    mark(3, 1);
  }
  return (
    <div className="mini" aria-hidden="true">
      {Array.from({ length: 25 }, (_, i) => {
        const x = i % 5;
        const y = Math.floor(i / 5);
        const dark = (x + y) % 2 === 1;
        return (
          <span key={i} className={dark ? "mini-dark" : "mini-light"}>
            {x === 2 && y === 2 ? (
              <PieceGlyph type={type} color="w" />
            ) : dots.has(`${x},${y}`) ? (
              <i className={type === "P" && x !== 2 ? "mini-x" : "mini-dot"} />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="sheet">
          <div className="grabber" />
          <Dialog.Title className="sheet-title">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          <div className="sheet-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segment" role="radiogroup">
      {options.map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}
