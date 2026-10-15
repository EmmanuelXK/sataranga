import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { Board } from "@/components/Chaturanga";
import { GameDesk } from "@/components/desk";
import { ProfilePane } from "@/components/Yuddha";
import { loadCareer, totals } from "@/game/career";
import {
  applyMove,
  inCheck,
  kingSquare,
  outcome,
  pickAiMove,
  startPosition,
  type Level,
  type Move,
  type Position,
} from "@/game/engine";
import { boardTheme } from "@/game/boards";
import { pairClocks, TIME_CONTROL, type Launch, type TimeControl } from "@/game/launch";
import { enqueue, leaveQueue, myRating, type LiveRating } from "@/game/online";
import { hydrateAccount, loadProfile, type Profile } from "@/game/profile";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSupabase } from "@/lib/supabase/client";

const TABLE_KEY = "sataranga-table-v1";

type TableMode = "online" | "bot" | "pvp" | "invite";

type TablePick = {
  v: 1;
  time: TimeControl;
  mode: TableMode;
  rated: boolean;
  level: Level;
};

type Seat = { id: string; name: string; avatar: string | null };

const DEFAULT_PICK: TablePick = { v: 1, time: "blitz", mode: "bot", rated: false, level: 2 };

function readPick(): TablePick {
  if (typeof localStorage === "undefined") return DEFAULT_PICK;
  try {
    const data = JSON.parse(localStorage.getItem(TABLE_KEY) || "") as Partial<TablePick>;
    if (data.v !== 1) return DEFAULT_PICK;
    const time = data.time === "rapid" ? "rapid" : "blitz";
    const mode = data.mode === "online" || data.mode === "pvp" || data.mode === "invite" ? data.mode : "bot";
    const level = data.level === 1 || data.level === 2 || data.level === 3 || data.level === 4 ? data.level : 2;
    return { v: 1, time, mode, rated: Boolean(data.rated), level };
  } catch {
    return DEFAULT_PICK;
  }
}

function writePick(pick: TablePick) {
  try {
    localStorage.setItem(TABLE_KEY, JSON.stringify(pick));
  } catch {
    /* the choice still applies this visit */
  }
}

function pillText(): string {
  return "Blitz";
}

export function Hall({
  onStart,
  recent,
}: {
  onStart: (launch: Launch) => void;
  recent: { id: string; title: string; detail: string; result: string; at: number }[];
}) {
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [tab, setTab] = useState<"home" | "puzzles" | "insights" | "profile">("home");
  const [pick, setPick] = useState<TablePick>(DEFAULT_PICK);
  const [timeOpen, setTimeOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [entering, setEntering] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [seats, setSeats] = useState<Seat[] | null>(null);
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [live, setLive] = useState<LiveRating | null>(null);
  const pickRef = useRef(pick);
  pickRef.current = pick;
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;
  const enterTimer = useRef(0);
  const toastTimer = useRef(0);

  function showToast(text: string) {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }

  function playBot() {
    setTimeOpen(false);
    setToast(null);
    const go = () => begin({ ...pickRef.current, mode: "bot", time: "blitz", rated: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      go();
      return;
    }
    setEntering(true);
    window.clearTimeout(enterTimer.current);
    enterTimer.current = window.setTimeout(() => {
      setEntering(false);
      go();
    }, 700);
  }

  function skipEntry() {
    window.clearTimeout(enterTimer.current);
    setEntering(false);
    begin({ ...pickRef.current, mode: "bot", time: "blitz", rated: true });
  }

  useEffect(() => {
    setPick(readPick());
    return () => {
      window.clearTimeout(enterTimer.current);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setLive(null);
      return;
    }
    let on = true;
    hydrateAccount().then((next) => {
      if (on && next) setProfile(next);
    });
    myRating().then((next) => {
      if (on) setLive(next);
    });
    return () => {
      on = false;
    };
  }, [signedIn]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let id = "guest";
    try {
      id = sessionStorage.getItem("sataranga-lobby-seat") || "";
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem("sataranga-lobby-seat", id);
      }
    } catch {
      id = "guest";
    }
    const name = user && !user.isDevFallback ? user.displayName || loadCareer().name : loadCareer().name;
    const channel = supabase.channel("sataranga-lobby", { config: { presence: { key: id } } });
    const read = () => {
      const state = channel.presenceState<{ name?: string; avatar?: string | null }>();
      const next: Seat[] = [];
      for (const [key, rows] of Object.entries(state)) {
        const row = rows[0];
        if (!row) continue;
        next.push({ id: key, name: row.name?.trim() || "Player", avatar: row.avatar || null });
      }
      setSeats(next);
    };
    channel.on("presence", { event: "sync" }, read);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ name: name || "Guest", avatar: user?.profileImageUrl ?? null });
        read();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setSeats(null);
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!searching) return;
    let on = true;
    const tick = () => {
      void enqueue("blitz", true)
        .then((game) => {
          if (!on) return;
          if (game.id) {
            setSearching(false);
            onStartRef.current({ kind: "online", gameId: game.id });
          }
        })
        .catch((err: unknown) => {
          if (!on) return;
          setSearching(false);
          setNote(err instanceof Error ? err.message : "Pairing failed.");
        });
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      on = false;
      window.clearInterval(id);
      void leaveQueue();
    };
  }, [searching]);

  function save(next: TablePick) {
    setPick(next);
    writePick(next);
  }

  function begin(current = pickRef.current, authed = signedIn) {
    setNote(null);
    setTimeOpen(false);
    const next: TablePick = {
      ...current,
      time: "blitz",
      rated: true,
      mode: current.mode === "invite" ? "pvp" : current.mode,
    };
    writePick(next);
    setPick(next);
    if (next.mode === "online" && !authed) {
      try {
        sessionStorage.setItem("sataranga-after-auth", "home");
      } catch {
        /* the sheet still opens */
      }
      setAuthOpen(true);
      return;
    }
    const control = TIME_CONTROL.blitz;
    if (next.mode === "bot") {
      onStart({
        kind: "solo",
        human: "w",
        level: next.level,
        clocks: pairClocks("blitz"),
        increment: control.inc,
        rated: true,
      });
      return;
    }
    if (next.mode === "pvp") {
      onStart({ kind: "pvp", clocks: pairClocks("blitz"), increment: control.inc });
      return;
    }
    setSearching(true);
  }

  const count = seats == null ? null : seats.length;
  const faces = (seats ?? []).slice(0, 3);

  return (
    <main className="hall">
      <header className="hall-brand">
        <h1>SATARANGA</h1>
        <p>Chess before Chess</p>
      </header>

      {tab === "home" && (
        <>
          <button type="button" className="lobby-bar" onClick={() => setLobbyOpen(true)} aria-haspopup="dialog">
            {faces.length > 0 && (
              <span className="lobby-faces" aria-hidden="true">
                {faces.map((seat) => (
                  <span key={seat.id} title={seat.name}>
                    {seat.avatar ? <img src={seat.avatar} alt="" /> : seat.name.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </span>
            )}
            <strong>Lobby</strong>
            {count != null && <b>{count}</b>}
          </button>

          <div className="hall-stage">
            <WatchBoard />
          </div>

          <button type="button" className="hall-pill" onClick={() => setTimeOpen(true)} aria-haspopup="dialog">
            {pillText()}
          </button>
          {note && <p className="hall-note">{note}</p>}
          <button type="button" className="hall-start" disabled={searching || entering || isPending} onClick={() => begin()}>
            START GAME
          </button>
        </>
      )}

      {tab === "puzzles" && (
        <section className="hall-panel" aria-labelledby="puzzles-title">
          <h2 id="puzzles-title">Puzzles</h2>
          <p>Puzzles are not in this build yet. Home is playing a live bot game you can watch, then start your own.</p>
        </section>
      )}

      {tab === "insights" && <Insights profile={profile} live={live} signedIn={signedIn} recent={recent} />}

      {tab === "profile" && (
        <section className="hall-panel hall-profile" aria-labelledby="profile-title">
          <h2 id="profile-title" className="sr-only">
            Profile
          </h2>
          {signedIn ? (
            <ProfilePane profile={profile} live={live} signedIn recent={recent} onDeleted={() => setLive(null)} />
          ) : (
            <>
              <p>Your profile keeps the live rating, invites, and rated games. Guest play stays on this phone.</p>
              <button
                type="button"
                className="hall-start"
                onClick={() => {
                  try {
                    sessionStorage.setItem("sataranga-after-auth", "profile");
                  } catch {
                    /* still opens */
                  }
                  setAuthOpen(true);
                }}
              >
                Sign in
              </button>
            </>
          )}
        </section>
      )}

      <nav className="hall-tabs" aria-label="SATARANGA">
        <Tab id="home" tab={tab} setTab={setTab} label="Home">
          <HomeIcon />
        </Tab>
        <Tab id="puzzles" tab={tab} setTab={setTab} label="Puzzles">
          <PuzzleIcon />
        </Tab>
        <Tab id="insights" tab={tab} setTab={setTab} label="Insights">
          <InsightIcon />
        </Tab>
        <Tab id="profile" tab={tab} setTab={setTab} label="Profile">
          <ProfileIcon />
        </Tab>
      </nav>

      <LeatherDialog open={timeOpen} onOpenChange={setTimeOpen} title="Time and type" description="Blitz is the clock. Every game is rated.">
        <div className="time-names" role="group" aria-label="Time">
          <button type="button" className="time-name on" aria-pressed="true">
            Blitz
          </button>
          <button
            type="button"
            className="time-name locked"
            title="Unlocks when more players are online"
            onClick={() => showToast("Unlocks when more players are online")}
          >
            <LockIcon />
            Rapid
          </button>
          <button
            type="button"
            className="time-name locked classical"
            title="Premium coming soon"
            onClick={() => showToast("Premium coming soon")}
          >
            <LockIcon />
            Classical
            <em className="premium-tag">Premium</em>
          </button>
        </div>
        <p className="time-toast" role="status">
          {toast ?? ""}
        </p>
        <div className="medallions">
          <button type="button" className="medallion" onClick={() => begin({ ...pick, mode: "online", time: "blitz", rated: true })}>
            <LotusMark />
            <span>Online</span>
          </button>
          <button type="button" className="medallion" onClick={playBot}>
            <FowlMark />
            <span>Bot</span>
          </button>
          <button type="button" className="medallion" onClick={() => begin({ ...pick, mode: "pvp", time: "blitz", rated: true })}>
            <PairMark />
            <span>Friend</span>
          </button>
        </div>
        <p className="rated-caption">All games rated · No ads</p>
      </LeatherDialog>

      <LeatherDialog open={lobbyOpen} onOpenChange={setLobbyOpen} title="Lobby" description="People in SATARANGA right now.">
        {seats == null && <p className="leather-note">The lobby count is not available on this copy.</p>}
        {seats != null && seats.length === 0 && <p className="leather-note">No one is in the lobby yet.</p>}
        {seats != null && seats.length > 0 && (
          <ul className="lobby-list">
            {seats.map((seat) => (
              <li key={seat.id}>
                <span>{seat.avatar ? <img src={seat.avatar} alt="" /> : seat.name.slice(0, 1).toUpperCase()}</span>
                <strong>{seat.name}</strong>
              </li>
            ))}
          </ul>
        )}
      </LeatherDialog>

      <GameDesk
        panel={authOpen ? "signin" : null}
        onPanel={(next) => {
          if (next === "profile") {
            setAuthOpen(false);
            setTab("profile");
            return;
          }
          setAuthOpen(next === "signin");
        }}
        onPlay={() => {}}
        onPractice={() => setAuthOpen(false)}
        time={pick.time}
        onTime={(time) => save({ ...pick, time })}
        focus={null}
        recent={recent}
        onHome={() => {
          setAuthOpen(false);
          const current = readPick();
          pickRef.current = current;
          setPick(current);
          begin(current, true);
        }}
      />

      {searching && (
        <div className="seek-veil" role="dialog" aria-modal="true" aria-labelledby="seek-title">
          <div className="seek-medallion">
            <LotusMark />
          </div>
          <p id="seek-title">Finding opponent…</p>
          <button
            type="button"
            className="hall-cancel seek-cancel"
            onClick={() => {
              setSearching(false);
              setNote(null);
              void leaveQueue();
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {entering && (
        <button type="button" className="seek-veil enter-veil" onClick={skipEntry}>
          <div className="seek-medallion enter-medallion">
            <FowlMark />
          </div>
          <p>Bot</p>
        </button>
      )}
    </main>
  );
}

function WatchBoard() {
  const [pos, setPos] = useState<Position>(() => startPosition());
  const [last, setLast] = useState<Move | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    let dead = false;
    let timer = 0;
    const worker = new Worker(new URL("../game/ai.worker.ts", import.meta.url), { type: "module" });
    let ticket = 0;
    const play = (move: Move | null, from: Position) => {
      if (dead) return;
      if (!move) {
        setPos(startPosition());
        setLast(null);
        timer = window.setTimeout(step, 700);
        return;
      }
      setPos(applyMove(from, move));
      setLast(move);
      timer = window.setTimeout(step, 700);
    };
    const step = () => {
      if (dead) return;
      const current = posRef.current;
      if (outcome(current).kind !== "ongoing") {
        timer = window.setTimeout(() => {
          if (dead) return;
          setPos(startPosition());
          setLast(null);
          timer = window.setTimeout(step, 500);
        }, 1200);
        return;
      }
      const mine = ++ticket;
      const level: Level = 2;
      worker.onmessage = (event: MessageEvent<Move | null>) => {
        if (mine !== ticket) return;
        play(event.data, current);
      };
      worker.onerror = () => {
        if (mine !== ticket) return;
        play(pickAiMove(current, level), current);
      };
      worker.postMessage({ pos: current, level });
    };
    timer = window.setTimeout(step, 600);
    return () => {
      dead = true;
      window.clearTimeout(timer);
      worker.terminate();
    };
  }, []);

  const checkSq = inCheck(pos) ? kingSquare(pos.board, pos.turn) : -1;

  return (
    <div className="ms-game home-watch">
      <p className="sr-only">Watching Ashva play Ashva. This board is not yours to move.</p>
      <div className="frame">
        <Board
          board={pos.board}
          orientation="w"
          squares={boardTheme("brown")}
          selected={null}
          targets={[]}
          last={last}
          checkSq={checkSq}
          flight={null}
          landSq={null}
          interactive={false}
          turn={pos.turn}
          onSelect={() => {}}
          onMove={() => {}}
        />
      </div>
    </div>
  );
}

function Insights({
  profile,
  live,
  signedIn,
  recent,
}: {
  profile: Profile;
  live: LiveRating | null;
  signedIn: boolean;
  recent: { id: string; title: string; detail: string; result: string; at: number }[];
}) {
  const career = loadCareer();
  const phone = totals(career);
  return (
    <section className="hall-panel" aria-labelledby="insights-title">
      <h2 id="insights-title">Insights</h2>
      <p className="hall-stat">
        <b>{live ? live.rating : "—"}</b>
        <span>{live ? `${live.games} rated` : signedIn ? "Rating loading" : "No live rating yet"}</span>
      </p>
      {live && (
        <p>
          Blitz {live.blitz} · Rapid {live.rapid} · Bot {live.bot}
        </p>
      )}
      <p>
        On this phone: {profile.wins} wins, {profile.losses} losses, {profile.draws} draws. Bots: {phone.w}–{phone.l}–{phone.d}.
      </p>
      {career.recent.length > 0 && (
        <ul className="lobby-list">
          {career.recent.slice(0, 4).map((row) => (
            <li key={`${row.at}-${row.opp}`}>
              <strong>
                vs {row.opp} · {row.result}
              </strong>
            </li>
          ))}
        </ul>
      )}
      {recent.length > 0 && (
        <ul className="lobby-list">
          {recent.slice(0, 3).map((row) => (
            <li key={row.id}>
              <strong>
                {row.title} · {row.result}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Tab({
  id,
  tab,
  setTab,
  label,
  children,
}: {
  id: "home" | "puzzles" | "insights" | "profile";
  tab: string;
  setTab: (id: "home" | "puzzles" | "insights" | "profile") => void;
  label: string;
  children: ReactNode;
}) {
  const on = tab === id;
  return (
    <button type="button" className={clsx(on && "on")} aria-current={on ? "page" : undefined} onClick={() => setTab(id)}>
      {children}
      <span>{label}</span>
    </button>
  );
}

function LeatherDialog({
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
        <Dialog.Content className="sheet leather">
          <div className="grabber" />
          <Dialog.Title className="sheet-title">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          <div className="sheet-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function PuzzleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h4a2 2 0 1 1 0 4h1v2h2a2 2 0 1 1 0 4h-2v2H9v-2H7a2 2 0 1 1 0-4h2V8H8a2 2 0 1 1 0-4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function InsightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0-3 11v2h6v-2a6 6 0 0 0-3-11zM9 19h6M10 21h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="9" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19c1.2-3.2 3.4-4.8 7-4.8S17.8 15.8 19 19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.2" y="7" width="9.6" height="7" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function Ring({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r="40" fill="#3e2e24" stroke="#c4a078" strokeWidth="2.4" />
      <circle cx="44" cy="44" r="33.5" fill="#5c2432" stroke="#8d6848" strokeWidth="1.2" />
      <circle cx="44" cy="44" r="31" fill="none" stroke="#c4a078" strokeWidth="0.6" opacity="0.7" />
      {children}
    </svg>
  );
}

function LotusMark() {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <Ring>
      {petals.map((deg) => (
        <ellipse
          key={deg}
          cx="44"
          cy="24"
          rx="6.2"
          ry="12"
          fill={deg % 90 === 0 ? "#c4a078" : "#8d4034"}
          stroke="#2a1c12"
          strokeWidth="0.6"
          transform={`rotate(${deg} 44 44)`}
        />
      ))}
      <circle cx="44" cy="44" r="8" fill="#e6d3b4" stroke="#c4a078" strokeWidth="1" />
      <circle cx="44" cy="44" r="3" fill="#8d4034" />
    </Ring>
  );
}

function FowlMark() {
  return (
    <Ring>
      <path d="M28 50c2-14 12-22 22-20 8 1 14 8 14 16 0 10-8 16-18 16-8 0-16-4-18-12z" fill="#3e2e24" stroke="#e6d3b4" strokeWidth="1" />
      <path d="M34 42c6-8 16-10 22-4 1 2 0 4-2 4-6-2-14 1-18 6-1-2-2-4-2-6z" fill="#e6d3b4" />
      <path d="M24 40c1-10 8-16 14-14 1 4-1 8-4 11-4 3-8 4-10 3z" fill="#6a5342" stroke="#e6d3b4" strokeWidth="0.6" />
      <path d="M22 34c1-4 4-6 5-4 0 3-2 5-4 6-1 0-1-1-1-2z" fill="#8d4034" />
      <circle cx="30" cy="44" r="2.4" fill="#f6efe2" />
      <circle cx="30.6" cy="44.2" r="1.1" fill="#1a120c" />
      <path d="M48 58c1 6 0 10-2 12M40 60c1 6 0 10-2 11" fill="none" stroke="#c4a078" strokeWidth="1.4" strokeLinecap="round" />
    </Ring>
  );
}

function PairMark() {
  return (
    <Ring>
      <circle cx="34" cy="36" r="5" fill="#e6d3b4" />
      <path d="M24 58c1.2-9 5-13 10-13s8.8 4 10 13" fill="#c4a078" />
      <circle cx="54" cy="36" r="5" fill="#e6d3b4" />
      <path d="M44 58c1.2-9 5-13 10-13s8.8 4 10 13" fill="#c4a078" />
      <path d="M30 30.5c.4-3 1.6-4.2 4-4.2s3.6 1.2 4 4.2" fill="none" stroke="#c4a078" strokeWidth="1.3" />
      <path d="M50 30.5c.4-3 1.6-4.2 4-4.2s3.6 1.2 4 4.2" fill="none" stroke="#c4a078" strokeWidth="1.3" />
    </Ring>
  );
}
