import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Volume2, VolumeX } from "lucide-react";
import { IconKastane } from "@/components/ceylon-icons";
import {
  BattleSketch,
  IconBust,
  IconFriends,
  IconQuill,
  IconScholar,
  IconScroll,
  IconTemple,
  SageCoach,
  WeaveBand,
  WordOrnament,
} from "@/components/manuscript";
import { ENGINES, type Level } from "@/game/engine";
import type { PlayLaunch } from "@/components/battle-gate";
import { pairClocks, TIME_CONTROL, type TimeControl } from "@/game/launch";
import { loadCareer } from "@/game/career";
import { hydrateAccount, loadProfile, type Profile } from "@/game/profile";
import { setSoundEnabled, soundEnabled } from "@/game/sound";
import {
  abortGame,
  activeGame,
  createInvite,
  deleteAccount,
  enqueue,
  joinInvite,
  leaderboard,
  leaveQueue,
  myRating,
  watchGame,
  type BoardRow,
  type LiveRating,
  type OnlineGame,
} from "@/game/online";
import { SignedOut } from "@/lib/auth/gates";
import { signOut } from "@/lib/supabase/client";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { PIECE_META, type PieceType } from "@/game/engine";
import { PieceGlyph } from "@/components/pieces";

type Tab = "play" | "board" | "profile" | "lore";

export type RecentGame = { id: string; title: string; detail: string; result: string; at: number };

const SEEN = "yuddha-seen-v1";
const TUTORIAL = "sataranga-tutorial-v1";

export function Yuddha({ onPlay, recent = [] }: { onPlay: (launch: PlayLaunch) => void; recent?: RecentGame[] }) {
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [welcome, setWelcome] = useState(false);
  const [enter, setEnter] = useState(false);
  const [tab, setTab] = useState<Tab>("play");
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem("sataranga-enter") !== "1") return;
    sessionStorage.removeItem("sataranga-enter");
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* the hub still opens */
    }
    setWelcome(false);
    setEnter(true);
  }, []);
  useEffect(() => {
    if (signedIn) return;
    try {
      if (localStorage.getItem(SEEN) !== "1") setWelcome(true);
    } catch {
      setWelcome(true);
    }
  }, [signedIn]);
  useEffect(() => {
    if (!signedIn) return;
    try {
      localStorage.setItem(SEEN, "1");
    } catch {
      /* guest welcome stays available next time */
    }
    setWelcome(false);
  }, [signedIn]);
  if (welcome && !signedIn) {
    return (
      <Welcome
        onPlay={() => {
          localStorage.setItem(SEEN, "1");
          setWelcome(false);
        }}
      />
    );
  }
  return <Camp tab={tab} setTab={setTab} onPlay={onPlay} enter={enter} signedIn={signedIn} recent={recent} />;
}

function Welcome({ onPlay }: { onPlay: () => void }) {
  return (
    <main className="yd ms">
      <div className="yd-welcome ms-welcome">
        <WordOrnament />
        <h1 className="ms-word">SATARANGA</h1>
        <p className="ms-sub">The ancient battle of minds</p>
        <BattleSketch />
        <button type="button" className="plaque" onClick={onPlay}>
          <IconKastane strokeWidth={1.6} />
          <span>
            <strong>PLAY</strong>
            <em>NO ACCOUNT NEEDED</em>
          </span>
        </button>
        <p className="yd-fine">Guest games stay on this phone. A rating needs an account.</p>
        <SignedOut>
          <Link to="/login" className="login-quiet">
            Sign in · Google or email
          </Link>
        </SignedOut>
      </div>
      <WeaveBand />
    </main>
  );
}

function Camp({
  tab,
  setTab,
  onPlay,
  enter,
  signedIn,
  recent,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  onPlay: (launch: PlayLaunch) => void;
  enter: boolean;
  signedIn: boolean;
  recent: RecentGame[];
}) {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [live, setLive] = useState<LiveRating | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
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
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem(TUTORIAL) === "1") return;
    setShowTutorial(true);
  }, []);
  const ratingLabel = live ? String(live.rating) : signedIn ? "…" : "Guest";

  return (
    <main className={clsx("yd yd-app ms", enter && "yd-enter")}>
      <div className="yd-body">
        <header className="ms-brand">
          <button type="button" className="ms-brand-btn" onClick={() => setTab("play")}>
            <WordOrnament />
            <h1 className="ms-word">SATARANGA</h1>
            <p className="ms-sub">
              <i />
              The ancient battle of minds
              <i />
            </p>
            <p className="ms-rate">{ratingLabel}</p>
          </button>
        </header>

        <div key={tab} className="pane-fade ms-stage">
          {tab === "play" && (
            <PlayHome onPlay={onPlay} signedIn={signedIn} />
          )}
          {tab === "board" && <Leaderboard />}
          {tab === "profile" && (
            <>
              <ProfilePane
                profile={profile}
                live={live}
                signedIn={signedIn}
                recent={recent}
                onDeleted={() => setLive(null)}
              />
              <SettingsPane onTutorial={() => setShowTutorial(true)} />
            </>
          )}
          {tab === "lore" && <LorePane onPractice={() => setShowTutorial(true)} />}
        </div>
      </div>
      <nav className="ms-dock" aria-label="SATARANGA">
        <TabBtn id="board" tab={tab} setTab={setTab} icon={<IconScroll />} label="Leaderboard" />
        <TabBtn id="profile" tab={tab} setTab={setTab} icon={<IconBust />} label="Profile" />
        <TabBtn id="lore" tab={tab} setTab={setTab} icon={<IconQuill />} label="Lore" />
      </nav>
      <WeaveBand />
      {showTutorial && (
        <Tutorial
          onClose={(skip) => {
            try {
              localStorage.setItem(TUTORIAL, "1");
            } catch {
              /* still closes */
            }
            setShowTutorial(false);
            void skip;
          }}
        />
      )}
    </main>
  );
}

function PlayHome({
  onPlay,
  signedIn,
}: {
  onPlay: (launch: PlayLaunch) => void;
  signedIn: boolean;
}) {
  const [time, setTime] = useState<TimeControl>("blitz");
  const [rated, setRated] = useState(true);
  const [level, setLevel] = useState<Level>(2);
  const [busy, setBusy] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState<OnlineGame | null>(null);
  const [resume, setResume] = useState<OnlineGame | null>(null);
  const [open, setOpen] = useState<null | "online" | "bot" | "friend">(null);

  useEffect(() => {
    if (!signedIn) return;
    let on = true;
    activeGame().then((game) => {
      if (on && game.id && (game.status === "live" || game.status === "waiting")) setResume(game);
    }).catch(() => undefined);
    return () => {
      on = false;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!searching) return;
    let on = true;
    const tick = () => {
      void enqueue(time, rated)
        .then((game) => {
          if (!on) return;
          if (game.id) {
            setSearching(false);
            onPlay({ kind: "online", gameId: game.id });
          } else setNote(`Looking for a ${TIME_CONTROL[time].name} game…`);
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
    };
  }, [searching, time, rated, onPlay]);

  useEffect(() => {
    if (!invite?.id || invite.status !== "waiting") return;
    return watchGame(invite.id, (next) => {
      if (next.status === "live" && next.black_id) onPlay({ kind: "online", gameId: next.id! });
      else setInvite(next);
    });
  }, [invite?.id, invite?.status, onPlay]);

  const control = TIME_CONTROL[time];

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setNote(null);
    try {
      await task();
    } catch (err) {
      setNote(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="play-stack ms-play">
      {resume?.id && (
        <button type="button" className="resume-banner" onClick={() => onPlay({ kind: "online", gameId: resume.id!, gate: false })}>
          Resume {resume.time_class === "rapid" ? "Rapid" : "Blitz"}
          {resume.invite_code ? ` · ${resume.invite_code}` : ""}
        </button>
      )}
      <div className="ms-art">
        <BattleSketch />
      </div>
      <div className="ms-plaques">
        <button
          type="button"
          className={clsx("plaque", open === "online" && "on")}
          aria-expanded={open === "online"}
          onClick={() => setOpen(open === "online" ? null : "online")}
        >
          <IconTemple />
          <span>
            <strong>{searching ? "PAIRING" : "PLAY ONLINE"}</strong>
            <em>BEGIN BATTLE</em>
          </span>
        </button>
        <button
          type="button"
          className={clsx("plaque", open === "bot" && "on")}
          aria-expanded={open === "bot"}
          onClick={() => setOpen(open === "bot" ? null : "bot")}
        >
          <IconScholar />
          <span>
            <strong>PLAY A BOT</strong>
            <em>A QUIET LESSON</em>
          </span>
        </button>
        <button
          type="button"
          className={clsx("plaque", open === "friend" && "on")}
          aria-expanded={open === "friend"}
          onClick={() => setOpen(open === "friend" ? null : "friend")}
        >
          <IconFriends />
          <span>
            <strong>PLAY A FRIEND</strong>
            <em>ONE CODE</em>
          </span>
        </button>
      </div>
      {searching && (
        <button
          type="button"
          className="quiet ms-cancel"
          onClick={() => {
            setSearching(false);
            setNote(null);
            void leaveQueue();
          }}
        >
          Cancel search
        </button>
      )}

      {open === "online" && (
        <div className="mode-overlay" onClick={() => setOpen(null)}>
        <section className="mode-sheet" aria-labelledby="online-title" onClick={(event) => event.stopPropagation()}>
          <h2 id="online-title">Play Online</h2>
          <Choice
            label="Time"
            value={time}
            options={[["blitz", "Blitz 3+2"], ["rapid", "Rapid 5+10"]]}
            onChange={(value) => setTime(value as TimeControl)}
          />
          <Choice
            label="Stakes"
            value={rated ? "rated" : "casual"}
            options={[["rated", "Rated"], ["casual", "Casual"]]}
            onChange={(value) => setRated(value === "rated")}
          />
          <button
            type="button"
            className="hero-battle"
            disabled={!!busy}
            onClick={() => {
              if (!signedIn) {
                setNote("Sign in to play online.");
                return;
              }
              setNote(null);
              setSearching(true);
            }}
          >
            {searching ? "Pairing…" : `Find a ${control.name} game`}
          </button>
        </section>
        </div>
      )}

      {open === "bot" && (
        <div className="mode-overlay" onClick={() => setOpen(null)}>
        <section className="mode-sheet" aria-labelledby="bots-title" onClick={(event) => event.stopPropagation()}>
          <h2 id="bots-title">Play a Bot</h2>
          <SageCoach text="Choose a teacher. I will sit with you and speak after each move." />
          <p className="yd-copy">Hewa is gentle. Raja is stubborn. No connection needed. A rated game needs an account.</p>
          <Choice
            label="Bot"
            value={String(level)}
            options={([1, 2, 3, 4] as Level[]).map((id) => [String(id), ENGINES[id].name])}
            onChange={(value) => setLevel(Number(value) as Level)}
          />
          <Choice
            label="Time"
            value={time}
            options={[["blitz", "Blitz 3+2"], ["rapid", "Rapid 5+10"]]}
            onChange={(value) => setTime(value as TimeControl)}
          />
          <button
            type="button"
            className="hero-battle"
            onClick={() =>
              onPlay({
                kind: "solo",
                human: "w",
                level,
                clocks: pairClocks(time),
                increment: control.inc,
                rated: signedIn && rated,
              })
            }
          >
            Play {ENGINES[level].name}
          </button>
        </section>
        </div>
      )}

      {open === "friend" && (
        <div className="mode-overlay" onClick={() => setOpen(null)}>
        <section className="mode-sheet" aria-labelledby="friend-title" onClick={(event) => event.stopPropagation()}>
          <h2 id="friend-title">Play a Friend</h2>
          <button
            type="button"
            className="hero-battle"
            disabled={!!busy}
            onClick={() =>
              void run("invite", async () => {
                if (!signedIn) throw new Error("Sign in to make an invite.");
                const game = await createInvite(time, rated);
                setInvite(game);
              })
            }
          >
            {invite?.invite_code ? `Code ${invite.invite_code}` : "Create an invite"}
          </button>
          {invite?.id && invite.status === "waiting" && (
            <button type="button" className="quiet" onClick={() => void abortGame(invite.id!).then(() => setInvite(null))}>
              Cancel invite
            </button>
          )}
          <label className="prep-label" htmlFor="join-code">
            Invite code
          </label>
          <input
            id="join-code"
            className="name"
            value={code}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="five letters"
            onChange={(event) => setCode(event.target.value)}
          />
          <button
            type="button"
            className="quiet"
            disabled={!!busy || code.trim().length < 4}
            onClick={() =>
              void run("join", async () => {
                if (!signedIn) throw new Error("Sign in to join.");
                const game = await joinInvite(code);
                if (!game.id) throw new Error(game.error || "That code is not waiting.");
                onPlay({ kind: "online", gameId: game.id });
              })
            }
          >
            Join
          </button>
          <button
            type="button"
            className="quiet"
            onClick={() => onPlay({ kind: "pvp", clocks: pairClocks(time), increment: control.inc })}
          >
          Same phone
        </button>
        </section>
        </div>
      )}

      {note && <p className="home-note">{note}</p>}
    </div>
  );
}

function ago(at: number): string {
  const mins = Math.floor(Math.max(0, Date.now() - at) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Leaderboard() {
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    leaderboard()
      .then((next) => {
        if (on) setRows(next);
      })
      .catch((err: unknown) => {
        if (on) setError(err instanceof Error ? err.message : "The board is unavailable.");
      });
    return () => {
      on = false;
    };
  }, []);
  return (
    <section className="panel" aria-labelledby="board-title">
      <div className="panel-h">
        <h2 id="board-title">Leaderboard</h2>
      </div>
      <p className="yd-copy">Family sataranga. Updated after rated games.</p>
      {error && <p className="yd-copy">{error}</p>}
      {rows && rows.length === 0 && <p className="yd-copy">No rated games yet.</p>}
      <ol className="board-list">
        {(rows ?? []).map((row, index) => (
          <li key={row.user_id}>
            <span>{index + 1}</span>
            <strong>{row.name}</strong>
            <b>{row.rating}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ProfilePane({
  profile,
  live,
  signedIn,
  recent,
  onDeleted,
  onSignIn,
}: {
  profile: Profile;
  live: LiveRating | null;
  signedIn: boolean;
  recent: RecentGame[];
  onDeleted: () => void;
  onSignIn?: () => void;
}) {
  const user = useCurrentUser();
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const name = user?.displayName || loadCareer().name || "Guest";
  return (
    <section className="profile-card">
      <div className="profile-top">
        <span className="profile-face">
          <Face />
        </span>
        <div>
          <h2>{name}</h2>
          <p>{user?.primaryEmail || "Guest on this phone"}</p>
        </div>
      </div>
      <div className="profile-rating">
        <b>{live ? live.rating : "—"}</b>
        <em>{live ? `${live.games} rated` : "No live rating"}</em>
      </div>
      {live && (
        <p className="profile-next">
          Blitz {live.blitz} · Rapid {live.rapid} · Bot {live.bot}
        </p>
      )}
      <p className="yd-copy">
        On this phone: {profile.wins} wins, {profile.losses} losses, {profile.draws} draws.
      </p>
      {recent.length > 0 && (
        <ul className="recent-list ms-recent">
          {recent.slice(0, 3).map((row) => (
            <li key={row.id}>
              <div>
                <strong>{row.title}</strong>
                <em>{row.detail}</em>
              </div>
              <div className="recent-score">
                <b>{row.result}</b>
                <span>{ago(row.at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="login-duo profile-duo">
        This account is shared with YUDDHA.PRO. SATARANGA keeps its own games. YUDDHA.PRO only links here.
      </p>
      {!signedIn &&
        (onSignIn ? (
          <button type="button" className="hero-battle" onClick={onSignIn}>
            Sign in
          </button>
        ) : (
          <Link to="/login" className="hero-battle">
            Sign in
          </Link>
        ))}
      {signedIn && (
        <button type="button" className="quiet" onClick={() => void signOut("/")}>
          Sign out
        </button>
      )}
      {signedIn && !confirm && (
        <button type="button" className="quiet danger" onClick={() => setConfirm(true)}>
          Delete account
        </button>
      )}
      {confirm && (
        <button
          type="button"
          className="quiet danger"
          onClick={() => {
            void deleteAccount()
              .then(async (result) => {
                if (!result.ok) throw new Error(result.error || "Could not delete.");
                setNote(result.auth_deleted ? "Account deleted." : "SATARANGA data removed. The login itself still needs the owner’s delete step.");
                if (result.auth_deleted) await signOut("/");
                onDeleted();
              })
              .catch((err: unknown) => setNote(err instanceof Error ? err.message : "Could not delete."));
          }}
        >
          Delete SATARANGA data and the login
        </button>
      )}
      {note && <p className="yd-copy">{note}</p>}
      <p className="yd-fine">
        <Link to="/privacy">Privacy</Link>
        {" · "}
        <Link to="/terms">Terms</Link>
      </p>
    </section>
  );
}

export function SettingsPane({ onTutorial }: { onTutorial: () => void }) {
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(soundEnabled()), []);
  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Settings</h2>
      </div>
      <button
        type="button"
        className="sound-row"
        aria-pressed={sound}
        onClick={() => {
          const next = !sound;
          setSound(next);
          setSoundEnabled(next);
        }}
      >
        {sound ? <Volume2 strokeWidth={1.75} /> : <VolumeX strokeWidth={1.75} />}
        <span>{sound ? "Sound on" : "Sound off"}</span>
      </button>
      <button type="button" className="quiet" onClick={onTutorial}>
        How the pieces move
      </button>
      <p className="yd-fine">
        <Link to="/privacy">Privacy Policy</Link>
        {" · "}
        <Link to="/terms">Terms</Link>
      </p>
    </section>
  );
}

export function LorePane({ onPractice }: { onPractice: () => void }) {
  const order: PieceType[] = ["K", "M", "G", "A", "R", "P"];
  return (
    <section className="panel ms-lore" aria-labelledby="lore-title">
      <SageCoach text="Read the pieces once. Then sit down and try a quiet game." />
      <h2 id="lore-title">Rules and lore</h2>
      <p className="yd-copy">Old Ceylon chess. Two armies, one board, and no hurry.</p>
      <ul className="rules">
        {order.map((type) => (
          <li key={type}>
            <span className="mini" aria-hidden>
              <PieceGlyph type={type} color="w" />
            </span>
            <div>
              <strong>{PIECE_META[type].name}</strong>
              <p>{PIECE_META[type].blurb}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="yd-copy">A bare Raja loses at once, unless it can bare the other Raja on the next move. That is a draw. Stalemate loses. No castling, no en passant.</p>
      <button type="button" className="plaque" onClick={onPractice}>
        <IconQuill />
        <span>
          <strong>FIRST LESSON</strong>
          <em>WALK THE PIECES</em>
        </span>
      </button>
    </section>
  );
}

function Tutorial({ onClose }: { onClose: (skipped: boolean) => void }) {
  const order: PieceType[] = ["K", "M", "G", "A", "R", "P"];
  return (
    <div className="tutorial" role="dialog" aria-labelledby="tutorial-title">
      <div className="tutorial-card">
        <p className="yd-kicker">First game</p>
        <h2 id="tutorial-title">How SATARANGA moves</h2>
        <ul className="rules">
          {order.map((type) => (
            <li key={type}>
              <span className="mini" aria-hidden>
                <PieceGlyph type={type} color="w" />
              </span>
              <div>
                <strong>{PIECE_META[type].name}</strong>
                <p>{PIECE_META[type].blurb}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="yd-copy">A bare Raja loses at once, unless it can bare the other Raja on the next move. That is a draw. Stalemate loses. No castling, no en passant.</p>
        <button type="button" className="hero-battle" onClick={() => onClose(false)}>
          Start
        </button>
        <button type="button" className="quiet" onClick={() => onClose(true)}>
          Skip
        </button>
      </div>
    </div>
  );
}

function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="choice" role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={clsx(value === id && "on")} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  );
}

function TabBtn({
  id,
  tab,
  setTab,
  icon,
  label,
}: {
  id: Tab;
  tab: Tab;
  setTab: (t: Tab) => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button type="button" className={clsx(tab === id && "on")} aria-current={tab === id ? "page" : undefined} aria-label={label} onClick={() => setTab(id)}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Face() {
  const user = useCurrentUser();
  if (user?.profileImageUrl) return <img src={user.profileImageUrl} alt="" />;
  return <img src="/art/lanka.png" alt="" />;
}
