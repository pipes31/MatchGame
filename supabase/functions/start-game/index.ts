// Issues a one-time ranked game session: the seed decides the board and every refill,
// so submit-score can later replay the game exactly.
import { db, json, preflight } from "../_shared/http.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const { data, error } = await db
    .from("games")
    .insert({ seed })
    .select("id, seed")
    .single();
  if (error) {
    console.error(error);
    return json({ error: "Could not start a game" }, 500);
  }

  // Now and then, sweep sessions that were never submitted.
  if (Math.random() < 0.05) {
    const { error: sweepError } = await db
      .from("games")
      .delete()
      .is("used_at", null)
      .lt("created_at", new Date(Date.now() - DAY_MS).toISOString());
    if (sweepError) console.error(sweepError);
  }

  return json(data);
});
