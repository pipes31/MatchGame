# Global ranking (Supabase)

Scores can't be written from the browser. Each ranked game works like this:

1. `start-game` issues a session with a random seed. The board and every refill come from that seed.
2. The browser plays with that seed and records each successful swap.
3. `submit-score` replays those swaps with the same rules (`functions/_shared/rules.ts`, also used by the
   game in `src/game`), computes the score itself and saves it. Each session can be submitted once, and
   not before the 2-minute game could have ended.

## Setup

1. Run `schema.sql` in the Supabase SQL editor.
2. Deploy the functions (from the project root):

   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy start-game --no-verify-jwt
   npx supabase functions deploy submit-score --no-verify-jwt
   ```

   `--no-verify-jwt` is fine: both functions are public on purpose and do their own validation.
   They use the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets Supabase provides automatically.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.

## Rules change = ranking change

If you change anything in `functions/_shared/rules.ts` (board size, candy count, scoring, refills),
redeploy **both** the site and `submit-score` together, otherwise games played on the old
version will fail verification.
