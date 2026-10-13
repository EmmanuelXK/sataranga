import { useEffect, useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { Leaderboard, LorePane, ProfilePane, SettingsPane, type RecentGame } from "@/components/Yuddha";
import { ENGINES, type Level } from "@/game/engine";
import { loadCareer } from "@/game/career";
import { hydrateAccount, loadProfile, type Profile } from "@/game/profile";
import { pairClocks, TIME_CONTROL, type Launch, type TimeControl } from "@/game/launch";
import {
  abortGame,
  activeGame,
  createInvite,
  enqueue,
  joinInvite,
  leaveQueue,
  myRating,
  watchGame,
  type LiveRating,
  type OnlineGame,
} from "@/game/online";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSupabase, loadAuthProviders, supabaseConfigured, type AuthProviders } from "@/lib/supabase/client";

export type DeskPanel = "play" | "board" | "profile" | "lore" | "signin";

const AFTER_KEY = "sataranga-after-auth";
const OPEN_KEY = "sataranga-open-signin";
const ERROR_KEY = "sataranga-auth-error";

function remember(panel: DeskPanel | "home") {
  try {
    sessionStorage.setItem(AFTER_KEY, panel);
  } catch {
    /* private browsing still opens the sheet */
  }
}

function takeAfter(): DeskPanel | "home" | null {
  try {
    const raw = sessionStorage.getItem(AFTER_KEY);
    sessionStorage.removeItem(AFTER_KEY);
    if (raw === "play" || raw === "board" || raw === "profile" || raw === "lore" || raw === "home") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function GameDesk({
  panel,
  onPanel,
  onPlay,
  onPractice,
  time,
  onTime,
  focus,
  recent,
  onHome,
}: {
  panel: DeskPanel | null;
  onPanel: (panel: DeskPanel | null) => void;
  onPlay: (launch: Launch) => void;
  onPractice: () => void;
  time: TimeControl;
  onTime: (time: TimeControl) => void;
  focus: "online" | "bot" | "friend" | null;
  recent: RecentGame[];
  onHome?: () => void;
}) {
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [authError, setAuthError] = useState("");
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [live, setLive] = useState<LiveRating | null>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (isPending || booted.current) return;
    booted.current = true;
    try {
      const err = sessionStorage.getItem(ERROR_KEY);
      if (err) {
        setAuthError(err);
        sessionStorage.removeItem(ERROR_KEY);
      }
      const open = sessionStorage.getItem(OPEN_KEY) === "1";
      sessionStorage.removeItem(OPEN_KEY);
      if (signedIn) {
        const after = takeAfter();
        if (after === "home") onHome?.();
        else if (after) onPanel(after);
        return;
      }
      if (open) onPanel("signin");
    } catch {
      /* the board is already up */
    }
  }, [isPending, signedIn, onPanel, onHome]);

  useEffect(() => {
    if (panel !== "profile" || isPending || signedIn) return;
    remember("profile");
    onPanel("signin");
  }, [panel, isPending, signedIn, onPanel]);

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
  }, [signedIn, panel]);

  const title =
    panel === "play"
      ? "Table"
      : panel === "board"
        ? "Leaderboard"
        : panel === "profile"
          ? "Profile"
          : panel === "lore"
            ? "Lore"
            : panel === "signin"
              ? "Sign in"
              : "";

  if (!panel) return null;

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onPanel(null); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="sheet leather">
          <div className="grabber" />
          <Dialog.Title className="sheet-title">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {panel === "signin" ? "Sign in without leaving the board." : "SATARANGA table."}
          </Dialog.Description>
          <div className="sheet-body">
            {panel === "play" && (
              <PlaySheet
                time={time}
                onTime={onTime}
                focus={focus}
                signedIn={signedIn}
                onPlay={(next) => {
                  onPanel(null);
                  onPlay(next);
                }}
                onNeedAccount={() => {
                  remember("play");
                  onPanel("signin");
                }}
              />
            )}
            {panel === "board" && <Leaderboard />}
            {panel === "profile" && signedIn && (
              <>
                <ProfilePane
                  profile={profile}
                  live={live}
                  signedIn
                  recent={recent}
                  onDeleted={() => setLive(null)}
                  onSignIn={() => {
                    remember("profile");
                    onPanel("signin");
                  }}
                />
                <SettingsPane onTutorial={onPractice} />
              </>
            )}
            {panel === "lore" && <LorePane onPractice={onPractice} />}
            {panel === "signin" && (
              <SignSheet
                error={authError}
                onDone={() => {
                  const after = takeAfter();
                  if (after === "home") {
                    onHome?.();
                    onPanel(null);
                    return;
                  }
                  onPanel(after ?? "play");
                }}
                onClose={() => onPanel(null)}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PlaySheet({
  time,
  onTime,
  focus,
  signedIn,
  onPlay,
  onNeedAccount,
}: {
  time: TimeControl;
  onTime: (time: TimeControl) => void;
  focus: "online" | "bot" | "friend" | null;
  signedIn: boolean;
  onPlay: (launch: Launch) => void;
  onNeedAccount: () => void;
}) {
  const [rated, setRated] = useState(false);
  const [level, setLevel] = useState<Level>(2);
  const [busy, setBusy] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState<OnlineGame | null>(null);
  const [resume, setResume] = useState<OnlineGame | null>(null);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const control = TIME_CONTROL[time];

  useEffect(() => {
    if (!signedIn) return;
    let on = true;
    activeGame()
      .then((game) => {
        if (on && game.id && (game.status === "live" || game.status === "waiting")) setResume(game);
      })
      .catch(() => undefined);
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
            onPlayRef.current({ kind: "online", gameId: game.id });
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
      void leaveQueue();
    };
  }, [searching, time, rated]);

  useEffect(() => {
    if (!invite?.id || invite.status !== "waiting") return;
    return watchGame(invite.id, (next) => {
      if (next.status === "live" && next.black_id) onPlayRef.current({ kind: "online", gameId: next.id! });
      else setInvite(next);
    });
  }, [invite?.id, invite?.status]);

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

  const sections = (["online", "bot", "friend"] as const).slice().sort((a, b) => {
    if (!focus) return 0;
    if (a === focus) return -1;
    if (b === focus) return 1;
    return 0;
  });

  return (
    <div className="leather-stack">
      {resume?.id && (
        <button type="button" className="leather-go" onClick={() => onPlay({ kind: "online", gameId: resume.id! })}>
          Resume {resume.time_class === "rapid" ? "Rapid" : "Blitz"}
          {resume.invite_code ? ` · ${resume.invite_code}` : ""}
        </button>
      )}
      <Picks
        label="Time"
        value={time}
        options={[
          ["blitz", "Blitz 3+2"],
          ["rapid", "Rapid 5+10"],
        ]}
        onChange={(value) => onTime(value as TimeControl)}
      />
      <Picks
        label="Stakes"
        value={rated ? "rated" : "casual"}
        options={[
          ["casual", "Casual"],
          ["rated", "Rated"],
        ]}
        onChange={(value) => setRated(value === "rated")}
      />
      {sections.map((section) => {
        if (section === "online") {
          return (
            <section key="online" aria-labelledby="online-title">
              <h2 id="online-title" className="leather-h">Play online</h2>
              <button
                type="button"
                className="leather-go"
                disabled={!!busy}
                onClick={() => {
                  if (!signedIn) {
                    onNeedAccount();
                    return;
                  }
                  setNote(null);
                  setSearching(true);
                }}
              >
                {searching ? "Pairing…" : `Find a ${control.name} game`}
              </button>
              {searching && (
                <button
                  type="button"
                  className="leather-row"
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
          );
        }
        if (section === "bot") {
          return (
            <section key="bot" aria-labelledby="bots-title">
              <h2 id="bots-title" className="leather-h">Play a bot</h2>
              <Picks
                label="Bot"
                value={String(level)}
                options={([1, 2, 3, 4] as Level[]).map((id) => [String(id), ENGINES[id].name])}
                onChange={(value) => setLevel(Number(value) as Level)}
              />
              <button
                type="button"
                className="leather-go"
                onClick={() => {
                  if (rated && !signedIn) {
                    onNeedAccount();
                    return;
                  }
                  onPlay({
                    kind: "solo",
                    human: "w",
                    level,
                    clocks: pairClocks(time),
                    increment: control.inc,
                    rated: signedIn && rated,
                  });
                }}
              >
                Play {ENGINES[level].name}
              </button>
            </section>
          );
        }
        return (
          <section key="friend" aria-labelledby="friend-title">
            <h2 id="friend-title" className="leather-h">Play a friend</h2>
            <button
              type="button"
              className="leather-go"
              disabled={!!busy}
              onClick={() => {
                if (!signedIn) {
                  onNeedAccount();
                  return;
                }
                void run("invite", async () => {
                  const game = await createInvite(time, rated);
                  setInvite(game);
                });
              }}
            >
              {invite?.invite_code ? `Code ${invite.invite_code}` : "Create an invite"}
            </button>
            {invite?.id && invite.status === "waiting" && (
              <button type="button" className="leather-row" onClick={() => void abortGame(invite.id!).then(() => setInvite(null))}>
                Cancel invite
              </button>
            )}
            <label className="leather-field" htmlFor="join-code">
              <span>Invite code</span>
              <input
                id="join-code"
                value={code}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="five letters"
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="leather-row"
              disabled={!!busy || code.trim().length < 4}
              onClick={() => {
                if (!signedIn) {
                  onNeedAccount();
                  return;
                }
                void run("join", async () => {
                  const game = await joinInvite(code);
                  if (!game.id) throw new Error(game.error || "That code is not waiting.");
                  onPlay({ kind: "online", gameId: game.id });
                });
              }}
            >
              Join
            </button>
            <button
              type="button"
              className="leather-row"
              onClick={() => onPlay({ kind: "pvp", clocks: pairClocks(time), increment: control.inc })}
            >
              Same phone
            </button>
          </section>
        );
      })}
      {note && <p className="leather-note">{note}</p>}
      <p className="leather-note">Casual games and same-phone play stay on this device. Rated games, online, and invites use your account.</p>
    </div>
  );
}

function SignSheet({ error, onDone, onClose }: { error: string; onDone: () => void; onClose: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState(error);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const ready = supabaseConfigured();
  const you = loadCareer().name;

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void loadAuthProviders().then((next) => {
      if (live) setProviders(next);
    });
    return () => {
      live = false;
    };
  }, [ready]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    const supabase = getSupabase();
    if (!supabase) return;
    if (password.length < 8) {
      setFormError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const shown = name.trim().slice(0, 24) || you || "Player";
        const { data, error: signError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: shown, full_name: shown } },
        });
        if (signError) {
          setFormError(signError.message);
          return;
        }
        if (!data.session) {
          setFormError("Check your email to confirm, then sign in.");
          setMode("in");
          return;
        }
      } else {
        const { error: signError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signError) {
          setFormError(signError.message);
          return;
        }
      }
      try {
        localStorage.setItem("yuddha-seen-v1", "1");
      } catch {
        /* still return to the board */
      }
      onDone();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "That account did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function startProvider(provider: "google" | "twitter") {
    setFormError("");
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      if (!sessionStorage.getItem(AFTER_KEY)) sessionStorage.setItem(AFTER_KEY, "play");
    } catch {
      /* the board is still here when the browser returns */
    }
    const { error: signError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
      },
    });
    if (signError) setFormError(signError.message);
  }

  if (!authEnabled) {
    return (
      <div className="leather-stack">
        <p className="leather-note">Sign-in is not available on this copy. The board is ready, and casual games stay on this phone.</p>
        <button type="button" className="leather-go" onClick={onClose}>
          Keep playing
        </button>
      </div>
    );
  }

  return (
    <div className="leather-stack">
      <p className="leather-note">
        Sign in for online games, a live rating, your profile, and invites. The board stays where you left it. This account is shared with YUDDHA.PRO. Each game keeps its own progress.
      </p>
      <button type="button" className="leather-go" disabled={!ready || !providers?.google} onClick={() => startProvider("google")}>
        Continue with Google
      </button>
      {ready && providers && !providers.google ? <p className="leather-note">Google is off in the shared account project.</p> : null}
      <button type="button" className="leather-row" disabled={!ready || !providers?.x} onClick={() => startProvider("twitter")}>
        Continue with X
      </button>
      {ready && providers && !providers.x ? <p className="leather-note">X is not enabled on the shared account project yet.</p> : null}
      <Picks
        label="Account"
        value={mode}
        options={[
          ["in", "Sign in"],
          ["up", "Create"],
        ]}
        onChange={(value) => setMode(value === "up" ? "up" : "in")}
      />
      <form className="leather-stack" onSubmit={submit}>
        {mode === "up" && (
          <label className="leather-field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you" autoComplete="name" maxLength={24} aria-label="Name" name="name" />
          </label>
        )}
        <label className="leather-field">
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@email.com" type="email" autoComplete="email" inputMode="email" required aria-label="Email" name="email" />
        </label>
        <label className="leather-field">
          <span>Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            type="password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            required
            minLength={8}
            aria-label="Password"
            name="password"
          />
        </label>
        {!ready ? <p className="leather-error">Sign-in is not set up on this copy yet. Casual games stay on this phone.</p> : null}
        {formError ? <p className="leather-error">{formError}</p> : null}
        <button type="submit" className="leather-go" disabled={busy || !ready}>
          {busy ? "One moment…" : mode === "up" ? "Create account" : "Sign in"}
        </button>
      </form>
      <button type="button" className="leather-row" onClick={onClose}>
        Keep playing as a guest
      </button>
    </div>
  );
}

function Picks({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
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
