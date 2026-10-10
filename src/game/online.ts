import { applyMove, legalMoves, startPosition, type Color, type Move } from "@/game/engine";
import { getSupabase } from "@/lib/supabase/client";
import { displayClocks } from "@/game/clocks";

export type WireMove = { from: number; to: number; promotion: boolean };

export type OnlineGame = {
  ok: boolean;
  error?: string;
  queued?: boolean;
  id?: string;
  white_id?: string;
  black_id?: string | null;
  time_class?: "blitz" | "rapid";
  rated?: boolean;
  initial_ms?: number;
  increment_ms?: number;
  white_ms?: number;
  black_ms?: number;
  clock_updated_at?: string;
  side_to_move?: Color;
  ply?: number;
  moves?: WireMove[];
  status?: "waiting" | "live" | "finished" | "aborted";
  result?: string | null;
  result_kind?: string | null;
  invite_code?: string | null;
  draw_offer?: Color | null;
  you?: Color | null;
  white_name?: string;
  black_name?: string;
  server_now?: string;
};

export type RatingChange = {
  ok: boolean;
  error?: string;
  applied?: boolean;
  before?: number;
  after?: number;
  delta?: number;
  pool?: string;
  family?: string;
};

export type LiveRating = {
  rating: number;
  games: number;
  blitz: number;
  rapid: number;
  bot: number;
};

export type BoardRow = { user_id: string; name: string; rating: number; games_played: number };

type Rpc = Record<string, unknown>;

async function call<T>(fn: string, args?: Rpc): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Sign-in is not configured on this build.");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function replayWire(wire: WireMove[]): Move[] | null {
  let pos = startPosition();
  const out: Move[] = [];
  for (const step of wire) {
    const move = legalMoves(pos).find(
      (item) => item.from === step.from && item.to === step.to && item.promotion === !!step.promotion,
    );
    if (!move) return null;
    out.push(move);
    pos = applyMove(pos, move);
  }
  return out;
}

export function shownClocks(game: OnlineGame, clientNow = Date.now()): { w: number; b: number } {
  const updated = Date.parse(game.clock_updated_at ?? "");
  const server = Date.parse(game.server_now ?? "");
  return displayClocks({
    whiteMs: game.white_ms ?? 0,
    blackMs: game.black_ms ?? 0,
    side: game.side_to_move === "b" ? "b" : "w",
    clockUpdatedAt: Number.isFinite(updated) ? updated : clientNow,
    serverNow: Number.isFinite(server) ? server : clientNow,
    clientNow,
    running: game.status === "live" && Boolean(game.black_id),
  });
}

export function enqueue(time: "blitz" | "rapid", rated: boolean): Promise<OnlineGame> {
  return call("sataranga_enqueue", { p_time: time, p_rated: rated });
}

export function leaveQueue(): Promise<{ ok: boolean }> {
  return call("sataranga_leave_queue");
}

export function createInvite(time: "blitz" | "rapid", rated: boolean): Promise<OnlineGame> {
  return call("sataranga_invite", { p_time: time, p_rated: rated });
}

export function joinInvite(code: string): Promise<OnlineGame> {
  return call("sataranga_join", { p_code: code });
}

export function activeGame(): Promise<OnlineGame> {
  return call("sataranga_active");
}

export function openGame(id: string): Promise<OnlineGame> {
  return call("sataranga_open", { p_id: id });
}

export function pushMove(id: string, from: number, to: number, promotion: boolean): Promise<OnlineGame> {
  return call("sataranga_commit_move", { p_id: id, p_from: from, p_to: to, p_promotion: promotion });
}

export function resignGame(id: string): Promise<OnlineGame> {
  return call("sataranga_resign", { p_id: id });
}

export function offerDraw(id: string): Promise<OnlineGame> {
  return call("sataranga_offer_draw", { p_id: id });
}

export function answerDraw(id: string, accept: boolean): Promise<OnlineGame> {
  return call("sataranga_answer_draw", { p_id: id, p_accept: accept });
}

export function abortGame(id: string): Promise<OnlineGame> {
  return call("sataranga_abort", { p_id: id });
}

export function claimTime(id: string): Promise<OnlineGame> {
  return call("sataranga_claim_time", { p_id: id });
}

export function rateGame(id: string): Promise<RatingChange> {
  return call("sataranga_rate", { p_id: id });
}

export function rateBot(input: {
  gameId: string;
  level: number;
  side: Color;
  result: "1-0" | "0-1" | "1/2-1/2";
  kind: string;
}): Promise<RatingChange> {
  return call("sataranga_rate_bot", {
    p_game_id: input.gameId,
    p_level: input.level,
    p_side: input.side,
    p_result: input.result,
    p_kind: input.kind,
  });
}

export async function myRating(): Promise<LiveRating | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;
  const row = await call<LiveRating & { ok: boolean; error?: string }>("sataranga_rating");
  if (!row.ok) return null;
  return row;
}

export async function leaderboard(): Promise<BoardRow[]> {
  const body = await call<{ ok: boolean; rows: BoardRow[] }>("sataranga_leaderboard");
  return body.rows ?? [];
}

export function deleteAccount(): Promise<{ ok: boolean; auth_deleted?: boolean; auth_error?: string | null; error?: string }> {
  return call("sataranga_delete_account");
}

export function watchGame(id: string, onGame: (game: OnlineGame) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`sataranga:${id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sataranga_games", filter: `id=eq.${id}` },
      () => {
        void openGame(id).then(onGame).catch(() => undefined);
      },
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "sataranga_moves", filter: `game_id=eq.${id}` },
      () => {
        void openGame(id).then(onGame).catch(() => undefined);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        void openGame(id).then(onGame).catch(() => undefined);
      }
    });
  return () => {
    void supabase.removeChannel(channel);
  };
}
