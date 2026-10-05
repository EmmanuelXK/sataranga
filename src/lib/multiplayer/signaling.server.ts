/**
 * WebRTC signaling over the app database (Neon deployed, PGLite in preview).
 * Only rendezvous traffic passes through here — roster + SDP/ICE relay while a
 * mesh forms; game data then flows peer-to-peer.
 */
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { pairRoom } from "./match";
import type { PeerRow, RtcPollResponse, SignalRow } from "./p2p";

const ID = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const signalSchema = z.object({
  op: z.literal("signal"),
  room: ID,
  from: ID,
  to: ID,
  kind: z.enum(["offer", "answer", "ice"]),
  payload: z.unknown().refine((v) => v !== undefined && JSON.stringify(v).length <= 32_768, {
    message: "payload too large",
  }),
});
const leaveSchema = z.object({ op: z.literal("leave"), room: ID, peer: ID });
const pairSchema = z.object({
  op: z.literal("pair"),
  peer: ID,
  name: z.string().max(64).default(""),
});
const unpairSchema = z.object({ op: z.literal("unpair"), peer: ID });
const postSchema = z.discriminatedUnion("op", [signalSchema, leaveSchema, pairSchema, unpairSchema]);

const BLITZ_QUEUE = "sataranga-blitz";

const PEER_TTL_SECONDS = 30;
const SIGNAL_TTL_SECONDS = 60;

const globalRef = globalThis as typeof globalThis & {
  __rtcSchemaPromise__?: Promise<void>;
  __rtcQueuePromise__?: Promise<void>;
};

function ensureSchema(sql: Sql): Promise<void> {
  globalRef.__rtcSchemaPromise__ ??= (async () => {
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_peers (
         room TEXT NOT NULL,
         peer_id TEXT NOT NULL,
         name TEXT NOT NULL DEFAULT '',
         last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (room, peer_id)
       )`,
    );
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_signals (
         id BIGSERIAL PRIMARY KEY,
         room TEXT NOT NULL,
         to_peer TEXT NOT NULL,
         from_peer TEXT NOT NULL,
         kind TEXT NOT NULL,
         payload JSONB NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
    await sql.query(
      `CREATE INDEX IF NOT EXISTS webrtc_signals_inbox
         ON webrtc_signals (room, to_peer, id)`,
    );
  })().catch((err) => {
    globalRef.__rtcSchemaPromise__ = undefined;
    throw err;
  });
  return globalRef.__rtcSchemaPromise__;
}

function ensureQueue(sql: Sql): Promise<void> {
  globalRef.__rtcQueuePromise__ ??= sql
    .query(
      `CREATE TABLE IF NOT EXISTS webrtc_queue (
         queue_id TEXT NOT NULL,
         peer_id TEXT NOT NULL,
         name TEXT NOT NULL DEFAULT '',
         last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
         room TEXT,
         PRIMARY KEY (queue_id, peer_id)
       )`,
    )
    .then(() => undefined)
    .catch((err) => {
      globalRef.__rtcQueuePromise__ = undefined;
      throw err;
    });
  return globalRef.__rtcQueuePromise__;
}

async function roster(sql: Sql, room: string): Promise<PeerRow[]> {
  const rows = await sql.query<{ peer_id: string; name: string }>(
    `SELECT peer_id, name FROM webrtc_peers
     WHERE room = $1 AND last_seen > now() - make_interval(secs => $2)
     ORDER BY peer_id LIMIT 32`,
    [room, PEER_TTL_SECONDS],
  );
  return rows.map((r) => ({ id: r.peer_id, name: r.name }));
}

async function touchPeer(sql: Sql, room: string, peer: string, name: string) {
  await sql.query(
    `INSERT INTO webrtc_peers (room, peer_id, name, last_seen)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (room, peer_id)
     DO UPDATE SET last_seen = now(), name = EXCLUDED.name`,
    [room, peer, name],
  );
}

async function prune(sql: Sql) {
  await Promise.all([
    sql.query(`DELETE FROM webrtc_signals WHERE created_at < now() - make_interval(secs => $1)`, [
      SIGNAL_TTL_SECONDS,
    ]),
    sql.query(`DELETE FROM webrtc_peers WHERE last_seen < now() - make_interval(secs => $1)`, [
      PEER_TTL_SECONDS,
    ]),
    sql.query(`DELETE FROM webrtc_queue WHERE last_seen < now() - make_interval(secs => $1)`, [60]),
  ]);
}

/** Pair two fresh SATARANGA Blitz waiters onto one room. Game traffic stays on the existing relay. */
async function pairBlitz(sql: Sql, peer: string, name: string): Promise<{ status: "waiting" | "matched"; room?: string }> {
  await ensureQueue(sql);
  const label = name.slice(0, 64);
  await sql.query(
    `INSERT INTO webrtc_queue (queue_id, peer_id, name, last_seen)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (queue_id, peer_id)
     DO UPDATE SET last_seen = now(), name = EXCLUDED.name`,
    [BLITZ_QUEUE, peer, label],
  );

  const mine = await sql.query<{ room: string | null }>(
    `SELECT room FROM webrtc_queue WHERE queue_id = $1 AND peer_id = $2`,
    [BLITZ_QUEUE, peer],
  );
  const existing = mine[0]?.room ?? null;
  if (existing) {
    const mates = await sql.query<{ n: number }>(
      `SELECT count(*) AS n FROM webrtc_queue
       WHERE queue_id = $1 AND room = $2 AND peer_id <> $3
         AND last_seen > now() - make_interval(secs => $4)`,
      [BLITZ_QUEUE, existing, peer, 45],
    );
    if (Number(mates[0]?.n ?? 0) > 0) return { status: "matched", room: existing };
    await sql.query(`UPDATE webrtc_queue SET room = NULL WHERE queue_id = $1 AND peer_id = $2 AND room = $3`, [
      BLITZ_QUEUE,
      peer,
      existing,
    ]);
  }

  const others = await sql.query<{ peer_id: string }>(
    `SELECT peer_id FROM webrtc_queue
     WHERE queue_id = $1 AND peer_id <> $2 AND room IS NULL
       AND last_seen > now() - make_interval(secs => $3)
     ORDER BY last_seen ASC
     LIMIT 1`,
    [BLITZ_QUEUE, peer, 20],
  );
  const other = others[0]?.peer_id;
  if (!other) return { status: "waiting" };

  const room = pairRoom(peer, other);
  const updated = await sql.query<{ peer_id: string }>(
    `UPDATE webrtc_queue
     SET room = $1, last_seen = now()
     WHERE queue_id = $2 AND room IS NULL AND peer_id IN ($3, $4)
     RETURNING peer_id`,
    [room, BLITZ_QUEUE, peer, other],
  );
  if (updated.length === 2) return { status: "matched", room };
  if (updated.length === 1) {
    await sql.query(
      `UPDATE webrtc_queue SET room = NULL
       WHERE queue_id = $1 AND room = $2 AND peer_id IN ($3, $4)`,
      [BLITZ_QUEUE, room, peer, other],
    );
  }
  const again = await sql.query<{ room: string | null }>(
    `SELECT room FROM webrtc_queue WHERE queue_id = $1 AND peer_id = $2`,
    [BLITZ_QUEUE, peer],
  );
  if (again[0]?.room) return { status: "matched", room: again[0].room };
  return { status: "waiting" };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function handleGet(url: URL): Promise<Response> {
  const parsed = z
    .object({
      room: ID,
      peer: ID,
      name: z.string().max(64).default(""),
      since: z.coerce.number().int().min(0).default(0),
    })
    .safeParse({
      room: url.searchParams.get("room"),
      peer: url.searchParams.get("peer"),
      name: url.searchParams.get("name") ?? "",
      since: url.searchParams.get("since") ?? 0,
    });
  if (!parsed.success) return json({ error: "invalid query" }, 400);
  const { room, peer, name, since } = parsed.data;

  const sql = await getSql();
  await ensureSchema(sql);
  await ensureQueue(sql);
  if (since === 0 || Math.random() < 0.02) await prune(sql);
  await touchPeer(sql, room, peer, name);
  const rows = await sql.query<{
    id: number;
    from_peer: string;
    kind: SignalRow["kind"];
    payload: unknown;
  }>(
    `SELECT id, from_peer, kind, payload FROM webrtc_signals
     WHERE room = $1 AND to_peer = $2 AND id > $3
     ORDER BY id LIMIT 200`,
    [room, peer, since],
  );
  const body: RtcPollResponse = {
    peers: await roster(sql, room),
    signals: rows.map((r) => ({
      id: r.id,
      from: r.from_peer,
      kind: r.kind,
      payload: r.payload,
    })),
  };
  return json(body);
}

async function handlePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid request" }, 400);
  const msg = parsed.data;
  const sql = await getSql();
  await ensureSchema(sql);
  await ensureQueue(sql);

  if (msg.op === "signal") {
    await sql.query(
      `INSERT INTO webrtc_signals (room, to_peer, from_peer, kind, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [msg.room, msg.to, msg.from, msg.kind, JSON.stringify(msg.payload)],
    );
    return json({ ok: true });
  }
  if (msg.op === "leave") {
    await sql.query(`DELETE FROM webrtc_peers WHERE room = $1 AND peer_id = $2`, [msg.room, msg.peer]);
    return json({ ok: true });
  }
  if (msg.op === "unpair") {
    await ensureQueue(sql);
    await sql.query(`DELETE FROM webrtc_queue WHERE queue_id = $1 AND peer_id = $2`, [BLITZ_QUEUE, msg.peer]);
    return json({ ok: true });
  }
  return json(await pairBlitz(sql, msg.peer, msg.name));
}

export async function handleSignaling(request: Request): Promise<Response> {
  try {
    if (request.method === "GET") return await handleGet(new URL(request.url));
    if (request.method === "POST") return await handlePost(request);
    return json({ error: "method not allowed" }, 405);
  } catch (error) {
    console.error("[rtc] signaling error:", error);
    return json({ error: "signaling failed" }, 500);
  }
}
