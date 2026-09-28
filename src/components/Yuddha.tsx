import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { Castle, Crown, Lock, Store, Swords, Users } from "lucide-react";
import { ENGINES, type Color, type Level } from "@/game/engine";
import { PieceGlyph } from "@/components/pieces";
import { roomCode, MODE_CLOCKS, type Launch } from "@/game/launch";
import { loadCareer, saveName } from "@/game/career";
import { claimDaily, headLevel, headName, hydrateAccount, loadProfile, rankTitle, todayKey, type Profile } from "@/game/profile";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";

type Tab = "war" | "yuddha" | "heads" | "friends" | "shop";
type Mode = "ashta" | "sena" | "pro";

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
            <span className="vs-tag">
              <Hare /> Lanka
            </span>
            <img className="king-shot" src="/art/lanka.png" alt="" />
          </article>
          <span className="vs-badge">vs</span>
          <article className="vs-card ayodhya">
            <span className="vs-tag">
              <Tortoise /> Ayodhya
            </span>
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
        <p className="yd-fine">Play as a guest. Your war room stays on this device.</p>
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
  const [lane, setLane] = useState<"ranked" | "casual" | "friend">("ranked");
  const [mode, setMode] = useState<Mode>("ashta");
  const [human, setHuman] = useState<Color>(() => (typeof localStorage !== "undefined" && localStorage.getItem("yuddha-side-v1") === "b" ? "b" : "w"));
  const [join, setJoin] = useState("");
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
  const title = rankTitle(profile.rating);
  const proOpen = profile.rating >= 450 || profile.heads >= 4;
  const nextHead = Math.min(10, profile.heads + 1);
  const day = new Date().toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase();

  function battle() {
    if (lane === "friend") {
      setTab("friends");
      return;
    }
    if (mode === "pro" && !proOpen) return;
    const level: Level =
      mode === "pro" ? 4 : mode === "sena" ? 3 : profile.rating < 380 ? 1 : profile.rating < 520 ? 2 : profile.rating < 640 ? 3 : 4;
    localStorage.setItem("yuddha-side-v1", human === "w" ? "b" : "w");
    onPlay({
      kind: "solo",
      human,
      level,
      clocks: lane === "casual" ? undefined : MODE_CLOCKS[mode],
      rated: lane === "ranked",
      strict: mode === "pro",
    });
  }

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
                <span className="coins">
                  <i />
                  {profile.coins.toLocaleString()}
                </span>
                <span className="avatar" aria-hidden="true">
                  <img src="/art/lanka.png" alt="" />
                </span>
              </div>
            </header>
            <section className="hero-card">
              <div>
                <span className="pill">
                  <Hare /> You're the Hare
                </span>
                <h2>Ashtapadha</h2>
                <p>Ranked · 3:00 vs 5:00</p>
                <button type="button" className="hero-battle" onClick={() => onPlay({ kind: "solo", human: "w", level: profile.rating < 380 ? 1 : 2, clocks: MODE_CLOCKS.ashta, rated: true })}>
                  <Swords strokeWidth={2.25} /> Battle
                </button>
              </div>
              <img className="hero-king" src="/art/lanka.png" alt="" />
            </section>
            <div className="stat-grid">
              <article className="stat">
                <p className="yd-kicker">Rank</p>
                <div className="rank-row">
                  <i className="rank-ring" style={{ ["--p" as string]: `${Math.min(100, Math.round(((profile.rating - 100) / 350) * 100))}%` }} />
                  <div>
                    <h2>{title}</h2>
                    <p>{Math.min(profile.rating, 450)} / 450 to Senapati</p>
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
            <section className="panel friend-strip">
              <div>
                <h2>A friend, one code</h2>
                <p>No public ladder. Challenge someone you know.</p>
              </div>
              <button type="button" className="quiet" onClick={() => setTab("friends")}>
                Challenge
              </button>
            </section>
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
            <div className="seg3" role="tablist">
              {(
                [
                  ["ranked", "Ranked"],
                  ["casual", "Casual"],
                  ["friend", "vs Friend"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={lane === id} className={clsx(lane === id && "on")} onClick={() => setLane(id)}>
                  {label}
                </button>
              ))}
            </div>
            {lane !== "friend" ? (
              <>
                <ModeCard
                  on={mode === "ashta"}
                  title="Ashtapadha"
                  copy="Classic 8×8. Quick and sharp."
                  tone="coral"
                  art="/art/ashta.png"
                  times={["3:00", "5:00"]}
                  onClick={() => setMode("ashta")}
                />
                <ModeCard
                  on={mode === "sena"}
                  title="Maha Senaa"
                  copy="The great army. Longer battles."
                  tone="gold"
                  art="/art/sena.png"
                  times={["5:00", "8:00"]}
                  onClick={() => setMode("sena")}
                />
                <ModeCard
                  on={mode === "pro"}
                  title="Crown"
                  copy={proOpen ? "Raja engine. No takebacks." : "For champions. No takebacks."}
                  tone="green"
                  art="/art/pro.png"
                  times={["10:00", "15:00"]}
                  locked={!proOpen}
                  onClick={() => proOpen && setMode("pro")}
                />
                <div className="side-h">
                  <p className="field-label">Your side</p>
                  <p className="field-note">Auto-alternates each battle</p>
                </div>
                <div className="pace-row">
                  <button type="button" className={clsx("pace", human === "w" && "on coral")} onClick={() => setHuman("w")}>
                    <Hare /> Hare · {mode === "sena" ? "5:00" : mode === "pro" ? "10:00" : "3:00"}
                  </button>
                  <button type="button" className={clsx("pace", human === "b" && "on green")} onClick={() => setHuman("b")}>
                    <Tortoise /> Tortoise · {mode === "sena" ? "8:00" : mode === "pro" ? "15:00" : "5:00"}
                  </button>
                </div>
                <button type="button" className="yd-battle" onClick={battle} disabled={mode === "pro" && !proOpen}>
                  <Swords strokeWidth={2.25} /> Battle as {human === "w" ? "Hare" : "Tortoise"}
                </button>
                <p className="yd-fine">
                  {lane === "ranked"
                    ? `${ENGINES[mode === "pro" ? 4 : mode === "sena" ? 3 : profile.rating < 380 ? 1 : profile.rating < 520 ? 2 : profile.rating < 640 ? 3 : 4].name} plays the other side. Your rating stays on this device.`
                    : "Casual games are not rated."}
                </p>
              </>
            ) : (
              <FriendTable name={name} join={join} setJoin={setJoin} onPlay={onPlay} />
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
                          pace: "hare",
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

        {tab === "friends" && (
          <>
            <header className="yd-head">
              <div>
                <p className="yd-kicker">Friends</p>
                <h1>One table</h1>
              </div>
            </header>
            <p className="yd-copy">Share a code with one person. This is a direct game, unrated, with no referee.</p>
            <FriendTable name={name} join={join} setJoin={setJoin} onPlay={onPlay} />
            <button type="button" className="quiet wide" onClick={() => onPlay({ kind: "pvp" })}>
              Pass & play on this device
            </button>
          </>
        )}

        {tab === "shop" && (
          <>
            <AccountBar />
            <Armory name={name} onName={(v) => saveName(v)} />
          </>
        )}
      </div>
      <nav className="tabbar">
        <TabBtn id="war" tab={tab} setTab={setTab} icon={<Castle strokeWidth={1.75} />} label="War Room" />
        <TabBtn id="yuddha" tab={tab} setTab={setTab} icon={<Swords strokeWidth={1.75} />} label="Play" />
        <TabBtn id="heads" tab={tab} setTab={setTab} icon={<Crown strokeWidth={1.75} />} label="Ten Heads" />
        <TabBtn id="friends" tab={tab} setTab={setTab} icon={<Users strokeWidth={1.75} />} label="Friends" />
        <TabBtn id="shop" tab={tab} setTab={setTab} icon={<Store strokeWidth={1.75} />} label="Shop" />
      </nav>
    </main>
  );
}

function AccountBar() {
  return (
    <section className="panel account-panel">
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <div className="panel-h">
          <div>
            <h2>Guest</h2>
            <p>Sign in and your rank follows you.</p>
          </div>
          <Link to="/login" className="quiet">
            Sign in
          </Link>
        </div>
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
  on,
  title,
  copy,
  tone,
  art,
  times,
  locked,
  onClick,
}: {
  on: boolean;
  title: string;
  copy: string;
  tone: "coral" | "gold" | "green";
  art: string;
  times: [string, string];
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={clsx("mode", on && "on")} onClick={onClick} aria-pressed={on}>
      <span className={clsx("mode-art", tone)}>
        <img src={art} alt="" />
      </span>
      <span className="mode-copy">
        <strong>
          {title}
          {locked ? (
            <em>
              <Lock strokeWidth={2} /> Senapati
            </em>
          ) : on ? (
            <i className="tick" />
          ) : null}
        </strong>
        <span>{copy}</span>
        <span className="chips">
          <b>
            <Hare />
            {times[0]}
          </b>
          <b>
            <Tortoise />
            {times[1]}
          </b>
        </span>
      </span>
    </button>
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
      <p className="yd-copy">The six that take the field. Nothing here is for sale.</p>
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

function Hare() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="critter">
      <path fill="currentColor" d="M7 4c1 2 1 4 .5 6M12 3c.2 2-.2 4-1 6M6 14c0-3 2.2-5 6-5s6 2 6 5-2 6-6 6-6-3-6-6z" />
    </svg>
  );
}

function Tortoise() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="critter">
      <ellipse cx="12" cy="14" rx="6" ry="4.5" fill="currentColor" />
      <circle cx="17.2" cy="13" r="1.6" fill="currentColor" />
    </svg>
  );
}

