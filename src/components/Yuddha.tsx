import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Bot, Castle, Swords, Trophy, UserRound, Users, Volume2, VolumeX } from "lucide-react";
import { ENGINES, type Level } from "@/game/engine";
import { pairClocks, TIME_CONTROL, type Launch, type TimeControl } from "@/game/launch";
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

type Tab = "play" | "board" | "profile" | "settings";

const SEEN = "yuddha-seen-v1";
const TUTORIAL = "sataranga-tutorial-v1";

export function Yuddha({ onPlay }: { onPlay: (launch: Launch) => void }) {
  const { user } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [welcome, setWelcome] = useState(() => {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(SEEN) !== "1";
  });
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
  return <Camp tab={tab} setTab={setTab} onPlay={onPlay} enter={enter} signedIn={signedIn} />;
}

function Welcome({ onPlay }: { onPlay: () => void }) {
  return (
    <main className="yd">
      <div className="yd-welcome">
        <p className="yd-kicker brand-kicker">Old Ceylon Chess</p>
        <h1 className="yd-logo">SATARANGA</h1>
        <p className="yd-lead">
          Play online.
          <br />
          Or sit down with a bot.
        </p>
        <button type="button" className="yd-play" onClick={onPlay}>
          <Swords strokeWidth={2.25} /> Play now · no account
        </button>
        <p className="yd-fine">Guest games stay on this phone. A rating needs an account.</p>
        <SignedOut>
          <Link to="/login" className="login-quiet">
            Sign in · Google or email
          </Link>
        </SignedOut>
      </div>
    </main>
  );
}

function Camp({
  tab,
  setTab,
  onPlay,
  enter,
  signedIn,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  onPlay: (launch: Launch) => void;
  enter: boolean;
  signedIn: boolean;
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
  const day = new Date().toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase();
  const ratingLabel = live ? String(live.rating) : signedIn ? "…" : "Guest";

  return (
    <main className={clsx("yd", enter && "yd-enter")}>
      <div className="yd-body">
        <header className="yd-head">
          <div>
            <p className="yd-kicker">{day} · Old Ceylon Chess</p>
            <h1 className="hub-name">SATARANGA</h1>
          </div>
          <div className="yd-head-side">
            <span className="rating-pill">
              <b>{ratingLabel}</b>
              <em>{live ? "sataranga" : signedIn ? "rating" : "local"}</em>
            </span>
            <button type="button" className="avatar" aria-label="Profile" onClick={() => setTab("profile")}>
              <Face />
            </button>
          </div>
        </header>

        {tab === "play" && <PlayHome onPlay={onPlay} signedIn={signedIn} profile={profile} />}
        {tab === "board" && <Leaderboard />}
        {tab === "profile" && (
          <ProfilePane
            profile={profile}
            live={live}
            signedIn={signedIn}
            onDeleted={() => {
              setLive(null);
              setTab("play");
            }}
          />
        )}
        {tab === "settings" && <SettingsPane onTutorial={() => setShowTutorial(true)} />}
      </div>
      <nav className="tabbar" aria-label="SATARANGA">
        <TabBtn id="play" tab={tab} setTab={setTab} icon={<Castle strokeWidth={1.75} />} label="Play" />
        <TabBtn id="board" tab={tab} setTab={setTab} icon={<Trophy strokeWidth={1.75} />} label="Board" />
        <TabBtn id="profile" tab={tab} setTab={setTab} icon={<UserRound strokeWidth={1.75} />} label="Profile" />
        <TabBtn id="settings" tab={tab} setTab={setTab} icon={<Volume2 strokeWidth={1.75} />} label="Settings" />
      </nav>
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
  profile,
}: {
  onPlay: (launch: Launch) => void;
  signedIn: boolean;
  profile: Profile;
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
    <div className="play-stack">
      {resume?.id && (
        <button type="button" className="resume-banner" onClick={() => onPlay({ kind: "online", gameId: resume.id! })}>
          Resume {resume.time_class === "rapid" ? "Rapid" : "Blitz"}
          {resume.invite_code ? ` · ${resume.invite_code}` : ""}
        </button>
      )}

      <section className="panel" aria-labelledby="online-title">
        <div className="panel-h">
          <h2 id="online-title">Play online</h2>
          <Users strokeWidth={1.75} aria-hidden />
        </div>
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
          <Swords strokeWidth={2.25} /> {searching ? "Pairing…" : `Find a ${control.name} game`}
        </button>
        {searching && (
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setSearching(false);
              setNote(null);
              void leaveQueue();
            }}
          >
            Cancel search
          </button>
        )}
      </section>

      <section className="panel" aria-labelledby="bots-title">
        <div className="panel-h">
          <h2 id="bots-title">Play bots</h2>
          <Bot strokeWidth={1.75} aria-hidden />
        </div>
        <p className="yd-copy">Works with no connection. A rated bot game needs an account.</p>
        <Choice
          label="Bot"
          value={String(level)}
          options={( [1, 2, 3, 4] as Level[]).map((id) => [String(id), ENGINES[id].name])}
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

      <section className="panel" aria-labelledby="friend-title">
        <div className="panel-h">
          <h2 id="friend-title">Play a friend</h2>
        </div>
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
          onClick={() =>
            onPlay({ kind: "pvp", clocks: pairClocks(time), increment: control.inc })
          }
        >
          Same phone
        </button>
      </section>
      {note && <p className="yd-copy">{note}</p>}
      <p className="yd-fine">Local record {profile.wins}–{profile.losses}–{profile.draws}. Online rating is the sataranga family.</p>
    </div>
  );
}

function Leaderboard() {
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

function ProfilePane({
  profile,
  live,
  signedIn,
  onDeleted,
}: {
  profile: Profile;
  live: LiveRating | null;
  signedIn: boolean;
  onDeleted: () => void;
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
      <p className="login-duo profile-duo">
        This account is shared with YUDDHA.PRO. SATARANGA keeps its own games. YUDDHA.PRO only links here.
      </p>
      {!signedIn && (
        <Link to="/login" className="hero-battle">
          Sign in
        </Link>
      )}
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

function SettingsPane({ onTutorial }: { onTutorial: () => void }) {
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
