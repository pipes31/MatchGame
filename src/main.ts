import "./index.css";
import { Game, type GameResult, type GameState } from "./game/game";
import {
  leaderboard,
  RejectedError,
  type GameSession,
  type ScoreEntry,
  type SubmittedScore,
} from "./game/leaderboard";
import { cleanName, type Move } from "./game/rules";
import { sfx } from "./game/sound";
import { storage } from "./game/storage";

const NAME_KEY = "gamerz:name";

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
};

const icon = (path: string) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${path}</svg>`;
const ICONS = {
  pause: icon('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  play: icon('<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5Z"/>'),
  soundOn: icon('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  soundOff: icon('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
};

const overlays: Partial<Record<GameState, HTMLElement>> = {
  ready: $("#overlay-start"),
  paused: $("#overlay-paused"),
  over: $("#overlay-over"),
};
const pauseBtn = $<HTMLButtonElement>("#btn-pause");
const restartBtn = $<HTMLButtonElement>("#btn-restart");
const soundBtn = $<HTMLButtonElement>("#btn-sound");

const game = new Game(
  {
    board: $("#board"),
    cells: $("#cells"),
    tiles: $("#tiles"),
    banner: $("#banner"),
    score: $("#score"),
    best: $("#best"),
    moves: $("#moves"),
    time: $("#time"),
    timeBar: $("#time-bar"),
    timeCard: $("#time-card"),
  },
  { onStateChange: renderState, onGameOver: renderResult }
);

function renderState(state: GameState) {
  closeRanking(false);
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle("hidden", key !== state);
  }
  focusOverlay(state);

  const paused = state === "paused";
  pauseBtn.disabled = state !== "playing" && !paused;
  pauseBtn.innerHTML = paused ? ICONS.play : ICONS.pause;
  pauseBtn.setAttribute("aria-label", paused ? "Resume" : "Pause");
  restartBtn.disabled = state === "ready";
}

function renderResult({ score, moves, best, isRecord, log }: GameResult) {
  $("#final-score").textContent = score.toLocaleString();
  $("#final-moves").textContent = String(moves);
  $("#final-best").textContent = best.toLocaleString();
  $("#new-record").classList.toggle("hidden", !isRecord);
  resetSubmitForm(score, log);
}

// ---------------------------------------------------------------- sessions

/** How long Play waits for a ranked session before starting an unranked game. */
const SESSION_WAIT_MS = 2_500;

/** Session of the game being played (null = unranked: offline or no server). */
let session: GameSession | null = null;
/** Requested ahead of time so pressing Play doesn't wait on the network. */
let nextSession: Promise<GameSession | null> | null = null;
let starting = false;

function prefetchSession() {
  if (!leaderboard.enabled) return;
  nextSession = leaderboard.startGame().catch((err) => {
    console.error(err);
    return null;
  });
}

async function startGame() {
  if (starting) return;
  starting = true;
  try {
    const upcoming = nextSession;
    nextSession = null;
    session = upcoming
      ? await Promise.race([
          upcoming,
          new Promise<null>((r) => setTimeout(() => r(null), SESSION_WAIT_MS)),
        ])
      : null;
    game.start(session?.seed);
    prefetchSession();
  } finally {
    starting = false;
  }
}

function focusOverlay(state: GameState) {
  const overlay = overlays[state];
  if (!overlay) return;
  // On game over, jump straight to the name field if this score can still be sent.
  const target =
    state === "over" && pending && !nameInput.disabled
      ? nameInput
      : overlay.querySelector<HTMLElement>(".btn") ?? overlay.querySelector("button");
  target?.focus();
}

// ---------------------------------------------------------------- ranking

const submitForm = $<HTMLFormElement>("#submit-form");
const nameInput = $<HTMLInputElement>("#player-name");
const submitBtn = $<HTMLButtonElement>("#btn-submit");
const submitStatus = $("#submit-status");
const unrankedNote = $("#unranked-note");
const rankingOverlay = $("#overlay-ranking");
const rankingList = $("#ranking-list");
const rankingStatus = $("#ranking-status");

/** The finished ranked game waiting to be sent; cleared once it has been submitted. */
let pending: { gameId: string; log: Move[] } | null = null;
/** Bumped per finished game so a slow submit can't touch the UI of a later one. */
let gameOverCount = 0;
/** Ignores responses from a ranking request that was superseded by a newer one. */
let rankingRequest = 0;

const MEDALS = ["#ffd23f", "#d6e2f0", "#ff9f5a"];

function resetSubmitForm(score: number, log: Move[]) {
  gameOverCount++;
  const scored = leaderboard.enabled && score > 0;
  pending = scored && session ? { gameId: session.id, log } : null;
  submitForm.classList.toggle("hidden", !pending);
  unrankedNote.classList.toggle("hidden", !scored || pending !== null);
  nameInput.disabled = submitBtn.disabled = false;
  nameInput.value = storage.get(NAME_KEY) ?? "";
  submitStatus.textContent = "";
}

async function submitScore() {
  if (!pending) return;
  const name = cleanName(nameInput.value);
  if (!name) {
    submitStatus.textContent = "Type a name first";
    nameInput.focus();
    return;
  }

  const { gameId, log } = pending;
  const thisGame = gameOverCount;
  // Still looking at this game's results, not at a newer game.
  const current = () => thisGame === gameOverCount && game.currentState === "over";

  nameInput.value = name;
  storage.set(NAME_KEY, name);
  nameInput.disabled = submitBtn.disabled = true;
  submitStatus.textContent = "Sending…";

  try {
    const entry = await leaderboard.submit(gameId, name, log);
    if (thisGame === gameOverCount) pending = null;
    if (!current()) return;
    submitStatus.textContent = `You're #${entry.rank} worldwide!`;
    void openRanking(entry);
  } catch (err) {
    console.error(err);
    // The server refused this game for good; only network/server failures are worth retrying.
    const rejected = err instanceof RejectedError;
    if (rejected && thisGame === gameOverCount) pending = null;
    if (!current()) return;
    if (rejected) {
      submitStatus.textContent = err.message;
    } else {
      nameInput.disabled = submitBtn.disabled = false;
      submitStatus.textContent = "Couldn't send it. Try again.";
    }
  }
}

function rankRow(rank: number, entry: ScoreEntry, isMe: boolean): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "rank-row";
  li.classList.toggle("me", isMe);

  const pos = document.createElement("span");
  pos.textContent = `#${rank}`;
  pos.style.color = MEDALS[rank - 1] ?? "rgb(255 255 255 / 0.5)";

  const name = document.createElement("span");
  name.className = "truncate";
  name.textContent = entry.name; // textContent: names are user input.

  const score = document.createElement("span");
  score.className = "tabular-nums text-[#ffd23f]";
  score.textContent = entry.score.toLocaleString();

  li.append(pos, name, score);
  return li;
}

async function openRanking(me?: SubmittedScore) {
  if (!leaderboard.enabled) return;
  game.pause();
  rankingOverlay.classList.remove("hidden");
  $("#btn-ranking-close").focus();

  const request = ++rankingRequest;
  rankingList.replaceChildren();
  rankingStatus.textContent = "Loading…";

  try {
    const top = await leaderboard.top();
    if (request !== rankingRequest) return;

    const rows = top.map((entry, i) => rankRow(i + 1, entry, entry.id === me?.id));
    if (me && !top.some((e) => e.id === me.id)) {
      const gap = document.createElement("li");
      gap.className = "text-center text-white/30";
      gap.textContent = "···";
      rows.push(gap, rankRow(me.rank, me, true));
    }
    rankingList.replaceChildren(...rows);
    rankingStatus.textContent = top.length ? "" : "No scores yet. Be the first!";
  } catch (err) {
    console.error(err);
    if (request !== rankingRequest) return;
    rankingStatus.textContent = "Couldn't load the ranking.";
  }
}

function closeRanking(restoreFocus = true) {
  if (rankingOverlay.classList.contains("hidden")) return;
  rankingRequest++;
  rankingOverlay.classList.add("hidden");
  if (restoreFocus) focusOverlay(game.currentState);
}

if (leaderboard.enabled) {
  for (const el of document.querySelectorAll("[data-ranking]")) {
    if (el !== submitForm) el.classList.remove("hidden");
  }
}

for (const btn of document.querySelectorAll("[data-open-ranking], #btn-ranking")) {
  btn.addEventListener("click", () => void openRanking());
}
$("#btn-ranking-close").addEventListener("click", () => closeRanking());
submitForm.addEventListener("submit", (e) => {
  e.preventDefault();
  void submitScore();
});

function renderSound() {
  soundBtn.innerHTML = sfx.muted ? ICONS.soundOff : ICONS.soundOn;
  soundBtn.setAttribute("aria-label", sfx.muted ? "Unmute sound" : "Mute sound");
  soundBtn.setAttribute("aria-pressed", String(sfx.muted));
}

$("#btn-play").addEventListener("click", () => void startGame());
$("#btn-again").addEventListener("click", () => void startGame());
$("#btn-resume").addEventListener("click", () => game.resume());
pauseBtn.addEventListener("click", () => game.togglePause());
restartBtn.addEventListener("click", () => void startGame());
soundBtn.addEventListener("click", () => {
  sfx.setMuted(!sfx.muted);
  renderSound();
});

document.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === "Escape" && !rankingOverlay.classList.contains("hidden")) {
    closeRanking();
  } else if (e.key.toLowerCase() === "p" && !e.repeat) {
    game.togglePause();
  }
});

// Never let the clock run while nobody is looking.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.pause();
});

renderState(game.currentState);
renderSound();
prefetchSession();
