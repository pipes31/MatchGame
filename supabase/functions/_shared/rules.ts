// Game rules shared by the browser (src/game) and the submit-score Edge Function,
// which replays every ranked game to compute its score itself.
// Keep this file free of DOM, Deno and Node APIs, and keep the browser's
// Game.trySwap/resolve doing the same board calls, in the same order, as `replay` below.

export const BOARD_SIZE = 8;
export const CANDY_TYPES = 4;
export const GAME_MS = 120_000;
export const NAME_MAX = 12;
/** Every move animates for ~0.6s, so no human gets near this many in one game. */
export const MAX_MOVES = Math.floor(GAME_MS / 400);

export interface Pos {
  row: number;
  col: number;
}

export interface Tile {
  id: number;
  type: number;
}

/** A tile moving from `fromRow` to `row` in column `col` (negative `fromRow` = spawned above the board). */
export interface Fall {
  tile: Tile;
  row: number;
  col: number;
  fromRow: number;
}

export interface MatchGroup {
  cells: Pos[];
}

/** One successful swap: [row1, col1, row2, col2, game time in ms when it was made]. */
export type Move = [number, number, number, number, number];

export type Rng = () => number;

/** Small seeded PRNG: the same seed gives the same board and refills on client and server. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points for one cleared run: 10 per tile, bonus for 4 and 5+, multiplied by the cascade depth. */
export const scoreFor = (length: number, combo: number) =>
  (length * 10 + (length >= 5 ? 50 : length === 4 ? 20 : 0)) * combo;

/** Trims and collapses whitespace; returns null if nothing usable is left. */
export function cleanName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  return name.length > 0 ? name : null;
}

// Ids are global so tiles from a previous board never collide with new ones.
let nextId = 0;
const createTile = (type: number): Tile => ({ id: nextId++, type });

export class Board {
  readonly grid: (Tile | null)[][];
  readonly size: number;
  readonly types: number;
  private readonly rng: Rng;

  constructor(size: number, types: number, rng: Rng = Math.random) {
    this.size = size;
    this.types = types;
    this.rng = rng;
    this.grid = Array.from({ length: size }, () =>
      Array<Tile | null>(size).fill(null)
    );
    this.fill();
  }

  static isAdjacent(a: Pos, b: Pos): boolean {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  inBounds(p: Pos): boolean {
    return p.row >= 0 && p.row < this.size && p.col >= 0 && p.col < this.size;
  }

  get(p: Pos): Tile | null {
    return this.grid[p.row]?.[p.col] ?? null;
  }

  swap(a: Pos, b: Pos) {
    const tmp = this.grid[a.row][a.col];
    this.grid[a.row][a.col] = this.grid[b.row][b.col];
    this.grid[b.row][b.col] = tmp;
  }

  /** Every horizontal and vertical run of 3 or more tiles of the same type. */
  findMatches(): MatchGroup[] {
    const groups: MatchGroup[] = [];
    const scan = (at: (i: number, j: number) => Pos) => {
      for (let i = 0; i < this.size; i++) {
        let start = 0;
        while (start < this.size) {
          const type = this.get(at(i, start))?.type;
          let end = start + 1;
          while (
            type !== undefined &&
            end < this.size &&
            this.get(at(i, end))?.type === type
          ) {
            end++;
          }
          if (type !== undefined && end - start >= 3) {
            const cells: Pos[] = [];
            for (let j = start; j < end; j++) cells.push(at(i, j));
            groups.push({ cells });
          }
          start = end;
        }
      }
    };
    scan((row, col) => ({ row, col }));
    scan((col, row) => ({ row, col }));
    return groups;
  }

  /** A swap that would produce a match, or null if the board is stuck. */
  findHint(): [Pos, Pos] | null {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const a = { row, col };
        for (const b of [
          { row, col: col + 1 },
          { row: row + 1, col },
        ]) {
          if (!this.inBounds(b)) continue;
          this.swap(a, b);
          const works = this.hasMatchAt(a) || this.hasMatchAt(b);
          this.swap(a, b);
          if (works) return [a, b];
        }
      }
    }
    return null;
  }

  removeAt(cells: Pos[]) {
    for (const p of cells) this.grid[p.row][p.col] = null;
  }

  /** Drops tiles into empty cells and refills from the top. Returns every tile that moved. */
  collapse(): Fall[] {
    const falls: Fall[] = [];
    for (let col = 0; col < this.size; col++) {
      let write = this.size - 1;
      for (let row = this.size - 1; row >= 0; row--) {
        const tile = this.grid[row][col];
        if (!tile) continue;
        if (row !== write) {
          this.grid[write][col] = tile;
          this.grid[row][col] = null;
          falls.push({ tile, row: write, col, fromRow: row });
        }
        write--;
      }
      const empty = write + 1;
      for (let row = write; row >= 0; row--) {
        const tile = createTile(this.randomType());
        this.grid[row][col] = tile;
        falls.push({ tile, row, col, fromRow: row - empty });
      }
    }
    return falls;
  }

  /** Rearranges the existing tiles into a layout with no matches and at least one move. */
  shuffle() {
    const tiles = this.grid.flat().filter((t): t is Tile => t !== null);
    for (let attempt = 0; attempt < 50; attempt++) {
      const pool = [...tiles];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      let ok = true;
      for (let row = 0; row < this.size && ok; row++) {
        for (let col = 0; col < this.size; col++) {
          const i = pool.findIndex((t) => !this.wouldMatch(row, col, t.type));
          if (i < 0) {
            ok = false;
            break;
          }
          this.grid[row][col] = pool.splice(i, 1)[0];
        }
      }
      if (ok && this.findHint()) return;
    }
    this.fill();
  }

  private fill() {
    do {
      for (let row = 0; row < this.size; row++) {
        for (let col = 0; col < this.size; col++) {
          let type: number;
          do {
            type = this.randomType();
          } while (this.wouldMatch(row, col, type));
          this.grid[row][col] = createTile(type);
        }
      }
    } while (!this.findHint());
  }

  private randomType(): number {
    return Math.floor(this.rng() * this.types);
  }

  /** Whether placing `type` at (row, col) completes a run with the two tiles to its left or above. */
  private wouldMatch(row: number, col: number, type: number): boolean {
    const t = (r: number, c: number) => this.grid[r]?.[c]?.type;
    return (
      (col >= 2 && t(row, col - 1) === type && t(row, col - 2) === type) ||
      (row >= 2 && t(row - 1, col) === type && t(row - 2, col) === type)
    );
  }

  private hasMatchAt(p: Pos): boolean {
    return this.runLength(p, 0, 1) >= 3 || this.runLength(p, 1, 0) >= 3;
  }

  private runLength(p: Pos, dr: number, dc: number): number {
    const type = this.get(p)?.type;
    if (type === undefined) return 0;
    let length = 1;
    for (const dir of [1, -1]) {
      let q = { row: p.row + dr * dir, col: p.col + dc * dir };
      while (this.inBounds(q) && this.get(q)?.type === type) {
        length++;
        q = { row: q.row + dr * dir, col: q.col + dc * dir };
      }
    }
    return length;
  }
}

export type ReplayResult =
  | { ok: true; score: number; moves: number }
  | { ok: false; error: string };

const isMove = (m: unknown): m is Move =>
  Array.isArray(m) && m.length === 5 && m.every(Number.isInteger);

/** Replays a game from its seed and move log and returns the score it really earned. */
export function replay(seed: number, moves: unknown): ReplayResult {
  const fail = (error: string): ReplayResult => ({ ok: false, error });
  if (!Array.isArray(moves)) return fail("moves must be an array");
  if (moves.length > MAX_MOVES) return fail("too many moves");

  const board = new Board(BOARD_SIZE, CANDY_TYPES, mulberry32(seed));
  let score = 0;
  let lastTime = 0;

  for (const [i, move] of moves.entries()) {
    if (!isMove(move)) return fail(`move ${i} is malformed`);
    const [r1, c1, r2, c2, time] = move;
    if (time < lastTime || time > GAME_MS) return fail(`move ${i} has a bad time`);
    lastTime = time;

    const a = { row: r1, col: c1 };
    const b = { row: r2, col: c2 };
    if (!board.inBounds(a) || !board.inBounds(b) || !Board.isAdjacent(a, b)) {
      return fail(`move ${i} is not a legal swap`);
    }

    board.swap(a, b);
    let groups = board.findMatches();
    if (groups.length === 0) return fail(`move ${i} makes no match`);
    for (let combo = 1; groups.length > 0; combo++) {
      for (const group of groups) score += scoreFor(group.cells.length, combo);
      board.removeAt(groups.flatMap((g) => g.cells));
      board.collapse();
      groups = board.findMatches();
    }
    if (!board.findHint()) board.shuffle();
  }

  return { ok: true, score, moves: moves.length };
}
