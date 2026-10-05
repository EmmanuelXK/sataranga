import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Castle, Crown, Lock, Swords, UserRound } from "lucide-react";
import { ENGINES } from "@/game/engine";
import { PieceGlyph } from "@/components/pieces";
import { pairClocks, roomCode, TIME_CONTROL, type Launch } from "@/game/launch";
import { readPieceSet, writePieceSet, type PieceSet } from "@/game/chaturaji";
import { loadCareer, saveName } from "@/game/career";
import { claimDaily, headLevel, headName, hydrateAccount, loadProfile, mahaUnlocked, rankProgress, todayKey, type Profile } from "@/game/profile";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";

type Tab = "war" | "yuddha" | "heads" | "profile";

const SEEN = "yuddha-seen-v1";

export function Yuddha({ onPlay }: { onPlay: (launch: Launch) => void }) {
  const [welcome, setWelcome] = useState(() => {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(SEEN) !== "1";
  });
  const [tab, setTab] = useState<Tab>("war");
  if (welcome) {
    return (
      <Welcome
        onPlay={() => {
          localStorage.setItem(SEEN, "1");
          setWelcome(false);
        }}
      />
    );
  }
  return <Camp tab={tab} setTab={setTab} onPlay={onPlay} />;
}

function Welcome({ onPlay }: { onPlay: () => void }) {
  return (
    <main className="yd">
      <div className="yd-welcome">
        <div className="vs-stage">
          <article className="vs-card lanka">
            <span className="vs-tag">Lanka</span>
            <img className="king-shot" src="/art/lanka.png" alt="" />
          </article>
          <span className="vs-badge">vs</span>
          <article className="vs-card ayodhya">
            <span className="vs-tag">Ayodhya</span>
            <img className="king-shot" src="/art/ayodhya.png" alt="" />
          </article>
        </div>
        <p className="yd-kicker brand-kicker">Old Ceylon Chess</p>
        <h1 className="yd-logo">SATARANGA</h1>
        <p className="yd-lead">
          The old board.
          <br />
          Sharp enough for a phone.
        </p>
        <button type="button" className="yd-play" onClick={onPlay}>
          <Swords strokeWidth={2.25} /> Play now · no account
        </button>
        <p className="yd-fine">Guest play keeps the rating on this phone.</p>
        <SignedOut>
          <Link to="/login" className="login-quiet">
            Sign in · Google or X
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
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  onPlay: (launch: Launch) => void;
}) {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [pieceSet, setPieceSet] = useState<PieceSet>(readPieceSet);
  const [join, setJoin] = useState("");
  const [lockNote, setLockNote] = useState(false);
  useEffect(() => {
    let live = true;
    hydrateAccount().then((next) => {
      if (live && next) setProfile(next);
    });
    return () => {
      live = false;
    };
  }, []);
  const name = loadCareer().name;
  const rank = rankProgress(profile.rating);
  const title = rank.title;
  const proOpen = mahaUnlocked(profile);
  const nextHead = Math.min(10, profile.heads + 1);
  const day = new Date().toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase();

  return (
    <main className="yd">
      <div className="yd-body">
        {tab === "war" && (
          <>
            <header className="yd-head">
              <div>
                <p className="yd-kicker">{day} · Old Ceylon Chess</p>
                <h1>War Room</h1>
              </div>
              <div className="yd-head-side">
                <span className="rating-pill">
                  <b>{profile.rating}</b>
                  <em>{title}</em>
                </span>
                <span className="coins">
                  <i />
                  {profile.coins.toLocaleString()}
                </span>
                <button type="button" className="avatar" aria-label="Profile" onClick={() => setTab("profile")}>
                  <Face />
                </button>
              </div>
            </header>
            <section className="hero-card">
              <div>
                <span className="pill">Blitz · 3+2</span>
                <h2>Ashtapadha</h2>
                <p>Ranked · 3:00 + 2s</p>
                <button type="button" className="hero-battle" onClick={() => onPlay({ kind: "solo", human: "w", level: profile.rating < 380 ? 1 : 2, clocks: pairClocks("blitz"), increment: TIME_CONTROL.blitz.inc, rated: true })}>
                  <Swords strokeWidth={2.25} /> Battle
                </button>
              </div>
              <img className="hero-king" src="/art/lanka.png" alt="" />
            </section>
            <div className="stat-grid">
              <article className="stat">
                <p className="yd-kicker">Rank</p>
                <div className="rank-row">
                  <i
                    className="rank-ring"
                    style={{
                      ["--p" as string]: `${
                        rank.next
                          ? Math.min(100, Math.round(((profile.rating - rank.floor) / (rank.ceil - rank.floor)) * 100))
                          : 100
                      }%`,
                    }}
                  />
                  <div>
                    <h2>{profile.rating}</h2>
                    <p>{rank.next ? `${title} · ${rank.ceil - profile.rating} to ${rank.next}` : title}</p>
                  </div>
                </div>
              </article>
              <article className="stat">
                <p className="yd-kicker">Ten heads</p>
                <div className="heads-mini" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => (
                    <b key={i} className={clsx(i < profile.heads && "done", i === profile.heads && "now")} />
                  ))}
                </div>
                <h2>{headName(nextHead)}</h2>
                <p className="hot">Boss ready · head {["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][nextHead - 1]}</p>
              </article>
            </div>
            <section className="panel">
              <div className="panel-h">
                <h2>Daily reward</h2>
                <button
                  type="button"
                  className="claim"
                  disabled={profile.lastClaim === todayKey()}
                  onClick={() => setProfile(claimDaily())}
                >
                  {profile.lastClaim === todayKey() ? `Day ${profile.streak} claimed` : `Claim day ${Math.min(7, profile.streak + 1)}`}
                </button>
              </div>
              <div className="days">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <span key={n} className={clsx(n <= profile.streak && "got", n === profile.streak && "today")}>
                    {n}
                  </span>
                ))}
              </div>
            </section>
            <BlitzSeat name={name} onPlay={onPlay} />
          </>
        )}

        {tab === "yuddha" && (
          <>
            <header className="yd-head">
              <div>
                <p className="yd-kicker">SATARANGA</p>
                <h1>Play</h1>
              </div>
            </header>
            <ModeCard
              title="SATARANGA"
              copy="Ashtapadha. Classic 8×8."
              tone="coral"
              art="/art/ashta.png"
              times={["Blitz", "Rapid"]}
              onClick={() => onPlay({ kind: "prep", game: "ashta" })}
            />
            <ModeCard
              title="SENAA"
              copy="Chathuraja. Four kings."
              tone="gold"
              art="/art/sena.png"
              times={["4 kings", "Dice"]}
              onClick={() => onPlay({ kind: "prep", game: "sena" })}
            />
            <ModeCard
              title="MAHA YUDDHA"
              copy={proOpen ? "Raja engine. No takebacks." : `${profile.wins}/5 SATARANGA · ${profile.senaWins ?? 0}/5 SENAA`}
              tone="green"
              art="/art/pro.png"
              times={["Blitz", "Rapid"]}
              locked={!proOpen}
              onClick={() => {
                if (!proOpen) {
                  setLockNote(true);
                  return;
                }
                onPlay({ kind: "prep", game: "pro" });
              }}
            />
            {lockNote && !proOpen && (
              <p className="yd-fine">Unlock with 5 wins in SATARANGA and 5 wins in SENAA.</p>
            )}
          </>
        )}

        {tab === "heads" && (
          <>
            <header className="yd-head">
              <div>
                <p className="yd-kicker">Ten heads</p>
                <h1>{profile.heads} fallen</h1>
              </div>
            </header>
            <p className="yd-copy">Win the head in front of you. Each one searches harder. No rating change.</p>
            <ol className="head-list">
              {Array.from({ length: 10 }, (_, i) => {
                const n = i + 1;
                const open = n === profile.heads + 1;
                const done = n <= profile.heads;
                return (
                  <li key={n}>
                    <button
                      type="button"
                      disabled={!open}
                      onClick={() =>
                        onPlay({
                          kind: "solo",
                          human: "w",
                          level: headLevel(n),
                          clocks: pairClocks("blitz"),
                          increment: TIME_CONTROL.blitz.inc,
                          head: n,
                        })
                      }
                    >
                      <span className={clsx("head-mark", done && "done", open && "open")}>{done ? "✓" : n}</span>
                      <span>
                        <strong>{headName(n)}</strong>
                        <em>{done ? "Fallen" : open ? `${ENGINES[headLevel(n)].name} · ready` : "Locked"}</em>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {tab === "profile" && (
          <>
            <header className="yd-head">
              <div>
                <p className="yd-kicker">Account</p>
                <h1>Profile</h1>
              </div>
            </header>
            <ProfileCard profile={profile} />
            <section className="panel">
              <div className="panel-h">
                <h2>Piece set</h2>
              </div>
              <div className="pace-row">
                <button
                  type="button"
                  className={clsx("pace", pieceSet === "retro" && "on coral")}
                  onClick={() => {
                    setPieceSet("retro");
                    writePieceSet("retro");
                  }}
                >
                  Retro
                </button>
                <button
                  type="button"
                  className={clsx("pace", pieceSet === "neo" && "on green")}
                  onClick={() => {
                    setPieceSet("neo");
                    writePieceSet("neo");
                  }}
                >
                  Neo
                </button>
              </div>
            </section>
            <section className="panel">
              <h2>One table</h2>
              <p>Share a code with one person. Unrated.</p>
              <FriendTable name={name} join={join} setJoin={setJoin} onPlay={onPlay} />
            </section>
            <Armory name={name} onName={(v) => saveName(v)} />
          </>
        )}
      </div>
      <nav className="tabbar">
        <TabBtn id="war" tab={tab} setTab={setTab} icon={<Castle strokeWidth={1.75} />} label="War Room" />
        <TabBtn id="yuddha" tab={tab} setTab={setTab} icon={<Swords strokeWidth={1.75} />} label="Play" />
        <TabBtn id="heads" tab={tab} setTab={setTab} icon={<Crown strokeWidth={1.75} />} label="Ten Heads" />
        <TabBtn id="profile" tab={tab} setTab={setTab} icon={<UserRound strokeWidth={1.75} />} label="Profile" />
      </nav>
    </main>
  );
}

function Face() {
  const user = useCurrentUser();
  if (user?.profileImageUrl) return <img src={user.profileImageUrl} alt="" />;
  return <img src="/art/lanka.png" alt="" />;
}

function ProfileCard({ profile }: { profile: Profile }) {
  const user = useCurrentUser();
  const rank = rankProgress(profile.rating);
  const name = user?.displayName || loadCareer().name || "Guest";
  const detail = user ? user.primaryEmail || "Signed in" : "Guest on this phone";
  return (
    <section className="profile-card">
      <div className="profile-top">
        <span className="profile-face">
          <Face />
        </span>
        <div>
          <h2>{name}</h2>
          {detail ? <p>{detail}</p> : <p>Guest on this phone</p>}
        </div>
      </div>
      <div className="profile-rating">
        <b>{profile.rating}</b>
        <em>{rank.title}</em>
      </div>
      <p className="profile-next">
        {rank.next ? `${rank.ceil - profile.rating} points to ${rank.next}` : "Highest rank on the board."}
      </p>
      <div className="record-row">
        <span>
          <b>{profile.wins}</b>
          <small>Wins</small>
        </span>
        <span>
          <b>{profile.losses}</b>
          <small>Losses</small>
        </span>
        <span>
          <b>{profile.draws}</b>
          <small>Draws</small>
        </span>
      </div>
      <p className="profile-note">Ranked games only move the number. Win +18. Loss −12.</p>
      <SignedIn>
        <div className="login-user">
          <UserButton />
        </div>
      </SignedIn>
      <SignedOut>
        <Link to="/login" className="yd-play profile-signin">
          Sign in · keep this rating
        </Link>
      </SignedOut>
    </section>
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
    <button type="button" className={clsx(tab === id && "on")} onClick={() => setTab(id)}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ModeCard({
  title,
  copy,
  tone,
  art,
  times,
  locked,
  onClick,
}: {
  title: string;
  copy: string;
  tone: "coral" | "gold" | "green";
  art: string;
  times: [string, string];
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="mode" onClick={onClick}>
      <span className={clsx("mode-art", tone)}>
        <img src={art} alt="" />
      </span>
      <span className="mode-copy">
        <strong>
          {title}
          {locked ? (
            <em>
              <Lock strokeWidth={2} /> Locked
            </em>
          ) : null}
        </strong>
        <span>{copy}</span>
        <span className="chips">
          <b>{times[0]}</b>
          <b>{times[1]}</b>
        </span>
      </span>
    </button>
  );
}

function BlitzSeat({ name, onPlay }: { name: string; onPlay: (launch: Launch) => void }) {
  const peer = useRef(`p${Math.random().toString(36).slice(2, 12)}`);
  const cancelRef = useRef(false);
  const hold = useRef(false);
  const running = useRef(false);
  const [phase, setPhase] = useState<"idle" | "wait" | "down">("idle");

  useEffect(() => {
    const id = peer.current;
    return () => {
      cancelRef.current = true;
      if (hold.current) return;
      void fetch("/api/rtc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "unpair", peer: id }),
        keepalive: true,
      }).catch(() => {});
    };
  }, []);

  async function find() {
    if (running.current) return;
    running.current = true;
    cancelRef.current = false;
    setPhase("wait");
    while (!cancelRef.current) {
      try {
        const res = await fetch("/api/rtc", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ op: "pair", peer: peer.current, name: name.trim() || "You" }),
        });
        if (!res.ok) throw new Error("pair");
        const data = (await res.json()) as { status?: string; room?: string };
        if (cancelRef.current) return;
        if (data.status === "matched" && data.room) {
          hold.current = true;
          onPlay({
            kind: "live",
            room: data.room,
            name: name.trim() || "You",
            clocks: pairClocks("blitz"),
            increment: TIME_CONTROL.blitz.inc,
            auto: true,
          });
          return;
        }
      } catch {
        if (!cancelRef.current) setPhase("down");
        running.current = false;
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    }
    running.current = false;
  }

  function cancel() {
    cancelRef.current = true;
    setPhase("idle");
    void fetch("/api/rtc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "unpair", peer: peer.current }),
    }).catch(() => {});
  }

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>SATARANGA Blitz</h2>
      </div>
      <p>3+2 with whoever is free. No friend code.</p>
      {phase === "wait" ? (
        <button type="button" className="quiet wide" onClick={cancel}>
          Waiting for a player · Cancel
        </button>
      ) : (
        <button type="button" className="yd-battle" onClick={() => void find()}>
          <Swords strokeWidth={2.25} /> {phase === "down" ? "Try again" : "Find a game"}
        </button>
      )}
      {phase === "down" && <p>The table could not be reached. Try again.</p>}
    </section>
  );
}

function FriendTable({
  name,
  join,
  setJoin,
  onPlay,
}: {
  name: string;
  join: string;
  setJoin: (v: string) => void;
  onPlay: (launch: Launch) => void;
}) {
  return (
    <section className="panel">
      <label className="yd-field">
        Name
        <input
          defaultValue={name}
          maxLength={18}
          onBlur={(e) => saveName(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="yd-battle"
        onClick={() => onPlay({ kind: "live", room: roomCode(), name: name.trim() || "You" })}
      >
        Open a table
      </button>
      <form
        className="join-dark"
        onSubmit={(e) => {
          e.preventDefault();
          const room = join.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
          if (room.length < 4) return;
          onPlay({ kind: "live", room, name: name.trim() || "You" });
        }}
      >
        <input value={join} placeholder="Enter a code" aria-label="Table code" maxLength={12} onChange={(e) => setJoin(e.target.value)} />
        <button type="submit">Join</button>
      </form>
    </section>
  );
}

function Armory({ name, onName }: { name: string; onName: (v: string) => void }) {
  const pieces = ["K", "M", "G", "A", "R", "P"] as const;
  return (
    <>
      <header className="yd-head">
        <div>
          <p className="yd-kicker">Armory</p>
          <h1>Your pieces</h1>
        </div>
      </header>
      <p className="yd-copy">Maha-Sena (මහසේනා), the sixteen pieces. Eight Hewa (හේවා) make a Sena (සේනා).</p>
      <label className="yd-field">
        Name on the board
        <input defaultValue={name} maxLength={18} onBlur={(e) => onName(e.target.value)} />
      </label>
      <div className="armory">
        {pieces.map((type, i) => (
          <div key={type} className="arm">
            <PieceGlyph type={type} color={i % 2 === 0 ? "b" : "w"} />
          </div>
        ))}
      </div>
    </>
  );
}


