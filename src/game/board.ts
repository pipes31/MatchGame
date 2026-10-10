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

// Ids are global so tiles from a previous board never collide with new ones.
let nextId = 0;
const createTile = (type: number): Tile => ({ id: nextId++, type });

export class Board {
  readonly grid: (Tile | null)[][];

  constructor(readonly size: number, readonly types: number) {
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
      const pool = [...tiles].sort(() => Math.random() - 0.5);
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
    return Math.floor(Math.random() * this.types);
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
