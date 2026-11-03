// Verifies a finished game by replaying its moves from the session seed and,
// if it checks out, records the score the server computed (never the client's).
import { db, json, preflight } from "../_shared/http.ts";
import { cleanName, GAME_MS, replay } from "../_shared/rules.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Sessions older than this can't be submitted (they are swept by start-game anyway). */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** Allowance for clock differences between the database and the function. */
const CLOCK_SLACK_MS = 2_000;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { gameId, name: rawName, moves } = body ?? {};
  if (typeof gameId !== "string" || !UUID.test(gameId)) {
    return json({ error: "Invalid game" }, 400);
  }
  const name = typeof rawName === "string" ? cleanName(rawName) : null;
  if (!name) return json({ error: "Invalid name" }, 400);

  const { data: game, error: gameError } = await db
    .from("games")
    .select("seed, created_at, used_at")
    .eq("id", gameId)
    .maybeSingle();
  if (gameError) {
    console.error(gameError);
    return json({ error: "Could not verify the game" }, 500);
  }
  if (!game) return json({ error: "Unknown game" }, 404);
  if (game.used_at) return json({ error: "This game was already submitted" }, 409);

  // A session only exists before its game starts, and a game always lasts GAME_MS.
  const elapsed = Date.now() - Date.parse(game.created_at);
  if (elapsed < GAME_MS - CLOCK_SLACK_MS) {
    return json({ error: "The game can't be over yet" }, 422);
  }
  if (elapsed > SESSION_TTL_MS) return json({ error: "This game expired" }, 422);

  const result = replay(Number(game.seed), moves);
  if (!result.ok) {
    console.warn(`Rejected game ${gameId}: ${result.error}`);
    return json({ error: "Score could not be verified" }, 422);
  }
  if (result.score <= 0) return json({ error: "Nothing to submit" }, 422);

  // game_id is unique, so two concurrent submits of one game can't both land.
  const { data: entry, error: insertError } = await db
    .from("scores")
    .insert({ name, score: result.score, moves: result.moves, game_id: gameId })
    .select("id, name, score, moves")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      return json({ error: "This game was already submitted" }, 409);
    }
    console.error(insertError);
    return json({ error: "Could not save the score" }, 500);
  }

  const { error: usedError } = await db
    .from("games")
    .update({ used_at: new Date().toISOString() })
    .eq("id", gameId);
  if (usedError) console.error(usedError);

  const { count, error: rankError } = await db
    .from("scores")
    .select("id", { count: "exact", head: true })
    .gt("score", entry.score);
  if (rankError) console.error(rankError);

  return json({ ...entry, rank: (count ?? 0) + 1 });
});
