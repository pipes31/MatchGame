// Only Supabase's REST (PostgREST) client: the full supabase-js would add auth/realtime we don't use.
import { PostgrestClient } from "@supabase/postgrest-js";
import type { Move } from "./rules";

export const TOP_LIMIT = 10;

export interface ScoreEntry {
  id: number;
  name: string;
  score: number;
  moves: number;
}

export interface SubmittedScore extends ScoreEntry {
  rank: number;
}

/** A ranked game issued by the server; its seed decides the board. */
export interface GameSession {
  id: string;
  seed: number;
}

/** A request the server refused on purpose (4xx), as opposed to a network or server failure. */
export class RejectedError extends Error {}

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const headers = { apikey: key ?? "", Authorization: `Bearer ${key}` };

// Without credentials the ranking is simply switched off; the game still works offline.
const rest = url && key ? new PostgrestClient(`${url}/rest/v1`, { headers }) : null;

async function callFunction<T>(name: string, body: unknown = {}): Promise<T> {
  if (!url || !key) throw new Error("Leaderboard is not configured");
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data as T;
  const message = typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
  throw res.status < 500 ? new RejectedError(message) : new Error(message);
}

export const leaderboard = {
  enabled: rest !== null,

  async top(limit = TOP_LIMIT): Promise<ScoreEntry[]> {
    if (!rest) throw new Error("Leaderboard is not configured");
    const { data, error } = await rest
      .from("scores")
      .select("id, name, score, moves")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  startGame: () => callFunction<GameSession>("start-game"),

  /** The server replays `log` and ranks the score it computes, not the one shown locally. */
  submit: (gameId: string, name: string, log: Move[]) =>
    callFunction<SubmittedScore>("submit-score", { gameId, name, moves: log }),
};
