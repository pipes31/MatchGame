import { CANDIES } from "./candies";
import {
  Board,
  BOARD_SIZE,
  CANDY_TYPES,
  GAME_MS,
  mulberry32,
  scoreFor,
  type Fall,
  type MatchGroup,
  type Move,
  type Pos,
  type Tile,
} from "./rules";
import { sfx } from "./sound";
import { storage } from "./storage";
import { CountdownTimer } from "./timer";

if (CANDIES.length !== CANDY_TYPES) {
  throw new Error("CANDIES must have CANDY_TYPES entries, or ranked replays won't match");
}

const LOW_TIME_MS = 10_000;
const SWAP_MS = 180;
const POP_MS = 280;
const SHUFFLE_MS = 450;
const HINT_DELAY_MS = 6_000;
const BEST_KEY = "gamerz:best";

export type GameState = "ready" | "playing" | "paused" | "over";

export interface GameResult {
  score: number;
  moves: number;
  best: number;
  isRecord: boolean;
  /** Every successful swap, so the server can replay the game. */
  log: Move[];
}

export interface GameElements {
  board: HTMLElement;
  cells: HTMLElement;
  tiles: HTMLElement;
  banner: HTMLElement;
  score: HTMLElement;
  best: HTMLElement;
  moves: HTMLElement;
  time: HTMLElement;
  timeBar: HTMLElement;
  timeCard: HTMLElement;
}

export interface GameCallbacks {
  onStateChange: (state: GameState) => void;
  onGameOver: (result: GameResult) => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const samePos = (a: Pos, b: Pos) => a.row === b.row && a.col === b.col;
const clamp = (n: number) => Math.max(0, Math.min(BOARD_SIZE - 1, n));

export class Game {
  private board = new Board(BOARD_SIZE, CANDY_TYPES);
  private readonly tileEls = new Map<number, HTMLElement>();
  private readonly timer: CountdownTimer;
  private readonly cursorEl: HTMLElement;
  private state: GameState = "ready";
  /** Bumped on every new game so in-flight animations from the old one stop touching the board. */
  private round = 0;
  private busy = false;
  private timeUp = false;
  private score = 0;
  private moves = 0;
  private log: Move[] = [];
  private best = Number(storage.get(BEST_KEY)) || 0;
  private lastSecond = -1;
  private selected: Pos | null = null;
  private cursor: Pos = { row: 0, col: 0 };
  private drag: { pos: Pos; x: number; y: number; pointerId: number } | null =
    null;
  private hintTimeout: number | undefined;

  constructor(
    private readonly ui: GameElements,
    private readonly callbacks: GameCallbacks
  ) {
    this.timer = new CountdownTimer(
      GAME_MS,
      (ms) => this.renderTime(ms),
      () => this.onTimeUp()
    );
    this.buildCells();
    this.cursorEl = this.createCursor();
    this.bindInput();
    this.renderStats();
    this.renderTime(GAME_MS);
    void this.syncTiles(0);
  }

  get currentState(): GameState {
    return this.state;
  }

  /** Starts a new game; pass the server-issued seed for a ranked game. */
  start(seed?: number) {
    this.round++;
    this.clearHint();
    this.select(null);
    this.showCursor(false);
    this.busy = false;
    this.timeUp = false;
    this.score = 0;
    this.moves = 0;
    this.log = [];
    this.renderStats();

    for (const el of this.tileEls.values()) el.remove();
    this.tileEls.clear();
    this.board = new Board(
      BOARD_SIZE,
      CANDY_TYPES,
      seed === undefined ? Math.random : mulberry32(seed)
    );
    const falls: Fall[] = [];
    this.forEachTile((tile, row, col) =>
      falls.push({ tile, row, col, fromRow: row - BOARD_SIZE })
    );
    void this.animateFalls(falls, 25);

    this.timer.reset();
    this.timer.start();
    sfx.start();
    this.setState("playing");
    this.scheduleHint();
    this.ui.board.focus({ preventScroll: true });
  }

  pause() {
    if (this.state !== "playing") return;
    this.timer.pause();
    this.clearHint();
    this.drag = null;
    this.setState("paused");
  }

  resume() {
    if (this.state !== "paused") return;
    this.setState("playing");
    this.timer.start();
    this.scheduleHint();
    this.ui.board.focus({ preventScroll: true });
  }

  togglePause() {
    if (this.state === "playing") this.pause();
    else this.resume();
  }

  // ---------------------------------------------------------------- turns

  private canInteract(): boolean {
    return this.state === "playing" && !this.busy && !this.timeUp;
  }

  private tap(pos: Pos) {
    if (!this.canInteract()) return;
    this.scheduleHint();
    const sel = this.selected;
    if (sel && samePos(sel, pos)) {
      this.select(null);
    } else if (sel && Board.isAdjacent(sel, pos)) {
      this.select(null);
      void this.trySwap(sel, pos);
    } else {
      this.select(pos);
      sfx.select();
    }
  }

  private async trySwap(a: Pos, b: Pos) {
    if (!this.canInteract() || !this.board.inBounds(b)) return;
    const round = this.round;
    const time = Math.round(GAME_MS - this.timer.timeLeft);
    this.busy = true;
    this.clearHint();
    sfx.swap();

    await this.animateSwap(a, b);
    if (round !== this.round) return;

    const groups = this.board.findMatches();
    if (groups.length === 0) {
      sfx.invalid();
      await this.animateSwap(a, b);
      if (round !== this.round) return;
      this.flash([a, b], "shake");
    } else {
      this.moves++;
      this.log.push([a.row, a.col, b.row, b.col, time]);
      this.renderStats();
      await this.resolve(groups, round);
      if (round !== this.round) return;
      if (!this.board.findHint()) {
        this.showBanner("Shuffle!");
        this.board.shuffle();
        await this.syncTiles(SHUFFLE_MS);
        if (round !== this.round) return;
      }
    }

    this.busy = false;
    if (this.timeUp) this.finish();
    else this.scheduleHint();
  }

  /** Clears matches, drops tiles and repeats while the refill keeps creating new matches. */
  private async resolve(groups: MatchGroup[], round: number) {
    for (let combo = 1; groups.length > 0; combo++) {
      let gained = 0;
      for (const group of groups) {
        const points = scoreFor(group.cells.length, combo);
        gained += points;
        this.floatScore(group, points);
      }
      this.addScore(gained);
      if (combo > 1) this.showBanner(`Combo x${combo}!`);
      sfx.match(combo);

      const cells = groups.flatMap((g) => g.cells);
      await this.popTiles(cells);
      if (round !== this.round) return;
      this.board.removeAt(cells);

      await this.animateFalls(this.board.collapse());
      if (round !== this.round) return;
      groups = this.board.findMatches();
    }
  }

  private onTimeUp() {
    this.timeUp = true;
    this.select(null);
    this.clearHint();
    if (!this.busy) this.finish();
  }

  private finish() {
    if (this.state === "over") return;
    this.timer.pause();
    this.clearHint();
    this.select(null);
    this.showCursor(false);
    const isRecord = this.score > this.best;
    if (isRecord) {
      this.best = this.score;
      storage.set(BEST_KEY, String(this.best));
      this.renderStats();
    }
    this.setState("over");
    sfx.gameOver();
    this.callbacks.onGameOver({
      score: this.score,
      moves: this.moves,
      best: this.best,
      isRecord,
      log: this.log,
    });
  }

  private setState(state: GameState) {
    this.state = state;
    this.ui.board.dataset.state = state;
    this.callbacks.onStateChange(state);
  }

  // ---------------------------------------------------------------- hints

  private scheduleHint() {
    this.clearHint();
    this.hintTimeout = window.setTimeout(() => {
      if (!this.canInteract()) return;
      for (const p of this.board.findHint() ?? []) {
        this.elAt(p)?.classList.add("hint");
      }
    }, HINT_DELAY_MS);
  }

  private clearHint() {
    clearTimeout(this.hintTimeout);
    for (const el of this.tileEls.values()) el.classList.remove("hint");
  }

  // ---------------------------------------------------------------- input

  private bindInput() {
    const board = this.ui.board;

    board.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary || !this.canInteract()) return;
      const pos = this.posFromPoint(e.clientX, e.clientY);
      if (!pos) return;
      e.preventDefault();
      board.focus({ preventScroll: true });
      this.showCursor(false);
      this.drag = { pos, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
      board.setPointerCapture(e.pointerId);
    });

    board.addEventListener("pointermove", (e) => {
      const drag = this.drag;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const threshold = (board.clientWidth / BOARD_SIZE) * 0.35;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      this.drag = null;
      const target =
        Math.abs(dx) > Math.abs(dy)
          ? { row: drag.pos.row, col: drag.pos.col + Math.sign(dx) }
          : { row: drag.pos.row + Math.sign(dy), col: drag.pos.col };
      this.select(null);
      void this.trySwap(drag.pos, target);
    });

    board.addEventListener("pointerup", (e) => {
      const drag = this.drag;
      if (!drag || e.pointerId !== drag.pointerId) return;
      this.drag = null;
      this.tap(drag.pos);
    });

    board.addEventListener("pointercancel", () => (this.drag = null));

    board.addEventListener("keydown", (e) => {
      if (!this.canInteract()) return;
      const steps: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const step = steps[e.key];
      if (step) {
        e.preventDefault();
        this.cursor = {
          row: clamp(this.cursor.row + step[0]),
          col: clamp(this.cursor.col + step[1]),
        };
        this.showCursor(true);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.showCursor(true);
        this.tap(this.cursor);
      } else if (e.key === "Escape") {
        this.select(null);
      }
    });
  }

  private posFromPoint(x: number, y: number): Pos | null {
    const rect = this.ui.tiles.getBoundingClientRect();
    const pos = {
      row: Math.floor(((y - rect.top) / rect.height) * BOARD_SIZE),
      col: Math.floor(((x - rect.left) / rect.width) * BOARD_SIZE),
    };
    return this.board.inBounds(pos) ? pos : null;
  }

  private select(pos: Pos | null) {
    if (this.selected) this.elAt(this.selected)?.classList.remove("selected");
    this.selected = pos;
    if (pos) this.elAt(pos)?.classList.add("selected");
  }

  private showCursor(visible: boolean) {
    this.cursorEl.classList.toggle("hidden", !visible);
    this.setPosition(this.cursorEl, this.cursor.row, this.cursor.col);
  }

  // ---------------------------------------------------------------- rendering

  private buildCells() {
    const frag = document.createDocumentFragment();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = document.createElement("div");
        cell.className =
          (row + col) % 2 ? "bg-white/[0.04]" : "bg-white/[0.10]";
        frag.appendChild(cell);
      }
    }
    this.ui.cells.replaceChildren(frag);
  }

  private createCursor(): HTMLElement {
    const el = document.createElement("div");
    el.className = "board-cursor hidden";
    el.style.width = el.style.height = `${100 / BOARD_SIZE}%`;
    this.ui.tiles.appendChild(el);
    return el;
  }

  private createTileEl(tile: Tile): HTMLElement {
    const candy = CANDIES[tile.type];
    const el = document.createElement("div");
    el.className = "tile";
    el.style.width = el.style.height = `${100 / BOARD_SIZE}%`;
    const img = document.createElement("img");
    img.className = "tile-img";
    img.src = candy.src;
    img.alt = candy.name;
    img.draggable = false;
    el.appendChild(img);
    this.ui.tiles.appendChild(el);
    this.tileEls.set(tile.id, el);
    return el;
  }

  private elAt(p: Pos): HTMLElement | undefined {
    const tile = this.board.get(p);
    return tile ? this.tileEls.get(tile.id) : undefined;
  }

  private forEachTile(fn: (tile: Tile, row: number, col: number) => void) {
    this.board.grid.forEach((cells, row) =>
      cells.forEach((tile, col) => tile && fn(tile, row, col))
    );
  }

  private setPosition(el: HTMLElement, row: number, col: number) {
    el.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
  }

  /** Moves every tile element to its board cell and drops elements for tiles that no longer exist. */
  private async syncTiles(duration: number) {
    const live = new Set<number>();
    this.forEachTile((tile, row, col) => {
      live.add(tile.id);
      const el = this.tileEls.get(tile.id) ?? this.createTileEl(tile);
      el.style.setProperty("--dur", `${duration}ms`);
      this.setPosition(el, row, col);
    });
    for (const [id, el] of this.tileEls) {
      if (!live.has(id)) {
        el.remove();
        this.tileEls.delete(id);
      }
    }
    await wait(duration);
    for (const el of this.tileEls.values()) el.style.removeProperty("--dur");
  }

  private async animateSwap(a: Pos, b: Pos) {
    this.board.swap(a, b);
    for (const p of [a, b]) {
      const el = this.elAt(p);
      if (el) this.setPosition(el, p.row, p.col);
    }
    await wait(SWAP_MS);
  }

  private async popTiles(cells: Pos[]) {
    const els = cells
      .map((p) => this.board.get(p))
      .filter((t): t is Tile => t !== null)
      .map((t) => {
        const el = this.tileEls.get(t.id);
        this.tileEls.delete(t.id);
        return el;
      });
    for (const el of els) el?.classList.add("popping");
    await wait(POP_MS);
    for (const el of els) el?.remove();
  }

  private async animateFalls(falls: Fall[], staggerMs = 0) {
    // New tiles start above the board; one reflow lets them transition from there.
    for (const f of falls) {
      if (this.tileEls.has(f.tile.id)) continue;
      this.setPosition(this.createTileEl(f.tile), f.fromRow, f.col);
    }
    void this.ui.tiles.offsetHeight;

    let longest = 0;
    for (const f of falls) {
      const el = this.tileEls.get(f.tile.id)!;
      const duration = Math.min(120 + 50 * (f.row - f.fromRow), 520);
      const delay = staggerMs * f.col;
      longest = Math.max(longest, duration + delay);
      el.style.setProperty("--dur", `${duration}ms`);
      el.style.setProperty("--delay", `${delay}ms`);
      el.style.setProperty("--ease", "cubic-bezier(0.5, 0, 0.75, 0.3)");
      this.setPosition(el, f.row, f.col);
    }
    await wait(longest);

    for (const f of falls) {
      const el = this.tileEls.get(f.tile.id);
      if (!el) continue;
      el.style.removeProperty("--dur");
      el.style.removeProperty("--delay");
      el.style.removeProperty("--ease");
      el.classList.remove("landed");
      void el.offsetWidth;
      el.classList.add("landed");
    }
  }

  private flash(cells: Pos[], className: string) {
    for (const p of cells) {
      const el = this.elAt(p);
      if (!el) continue;
      el.classList.remove(className);
      void el.offsetWidth;
      el.classList.add(className);
      el.addEventListener("animationend", () => el.classList.remove(className), {
        once: true,
      });
    }
  }

  private floatScore(group: MatchGroup, points: number) {
    const type = this.board.get(group.cells[0])?.type ?? 0;
    const avg = (pick: (p: Pos) => number) =>
      group.cells.reduce((sum, p) => sum + pick(p), 0) / group.cells.length;
    const el = document.createElement("div");
    el.className = "float-score";
    el.textContent = `+${points}`;
    el.style.left = `${((avg((p) => p.col) + 0.5) / BOARD_SIZE) * 100}%`;
    el.style.top = `${((avg((p) => p.row) + 0.5) / BOARD_SIZE) * 100}%`;
    el.style.color = CANDIES[type].color;
    el.addEventListener("animationend", () => el.remove(), { once: true });
    this.ui.tiles.appendChild(el);
  }

  private showBanner(text: string) {
    const banner = this.ui.banner;
    banner.textContent = text;
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");
  }

  private addScore(points: number) {
    this.score += points;
    this.renderStats();
    this.ui.score.classList.remove("bump");
    void this.ui.score.offsetWidth;
    this.ui.score.classList.add("bump");
  }

  private renderStats() {
    this.ui.score.textContent = this.score.toLocaleString();
    this.ui.moves.textContent = String(this.moves);
    this.ui.best.textContent = this.best.toLocaleString();
  }

  private renderTime(ms: number) {
    const seconds = Math.ceil(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, "0");
    this.ui.time.textContent = `${m}:${s}`;
    this.ui.timeBar.style.width = `${(ms / GAME_MS) * 100}%`;
    this.ui.timeCard.classList.toggle("low", ms > 0 && ms <= LOW_TIME_MS);
    if (seconds !== this.lastSecond) {
      if (this.state === "playing" && seconds > 0 && seconds <= 5) sfx.tick();
      this.lastSecond = seconds;
    }
  }
}
