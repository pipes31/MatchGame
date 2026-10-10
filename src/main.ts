import "./index.css";
import { Game, type GameResult, type GameState } from "./game/game";
import { sfx } from "./game/sound";

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
  for (const [key, el] of Object.entries(overlays)) {
    el.classList.toggle("hidden", key !== state);
  }
  overlays[state]?.querySelector("button")?.focus();

  const paused = state === "paused";
  pauseBtn.disabled = state !== "playing" && !paused;
  pauseBtn.innerHTML = paused ? ICONS.play : ICONS.pause;
  pauseBtn.setAttribute("aria-label", paused ? "Resume" : "Pause");
  restartBtn.disabled = state === "ready";
}

function renderResult({ score, moves, best, isRecord }: GameResult) {
  $("#final-score").textContent = score.toLocaleString();
  $("#final-moves").textContent = String(moves);
  $("#final-best").textContent = best.toLocaleString();
  $("#new-record").classList.toggle("hidden", !isRecord);
}

function renderSound() {
  soundBtn.innerHTML = sfx.muted ? ICONS.soundOff : ICONS.soundOn;
  soundBtn.setAttribute("aria-label", sfx.muted ? "Unmute sound" : "Mute sound");
  soundBtn.setAttribute("aria-pressed", String(sfx.muted));
}

$("#btn-play").addEventListener("click", () => game.start());
$("#btn-again").addEventListener("click", () => game.start());
$("#btn-resume").addEventListener("click", () => game.resume());
pauseBtn.addEventListener("click", () => game.togglePause());
restartBtn.addEventListener("click", () => game.start());
soundBtn.addEventListener("click", () => {
  sfx.setMuted(!sfx.muted);
  renderSound();
});

document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "p" && !e.repeat) game.togglePause();
});

// Never let the clock run while nobody is looking.
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.pause();
});

renderState(game.currentState);
renderSound();
