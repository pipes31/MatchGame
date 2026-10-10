/** Deadline-based countdown: stays accurate even when ticks are delayed or the tab is throttled. */
export class CountdownTimer {
  private remaining: number;
  private deadline = 0;
  private intervalId: number | undefined;

  constructor(
    private readonly duration: number,
    private readonly onTick: (msLeft: number) => void,
    private readonly onEnd: () => void
  ) {
    this.remaining = duration;
  }

  get running(): boolean {
    return this.intervalId !== undefined;
  }

  get timeLeft(): number {
    return this.running
      ? Math.max(0, this.deadline - performance.now())
      : this.remaining;
  }

  start() {
    if (this.running || this.remaining <= 0) return;
    this.deadline = performance.now() + this.remaining;
    this.intervalId = window.setInterval(() => this.tick(), 100);
    this.tick();
  }

  pause() {
    if (!this.running) return;
    this.remaining = this.timeLeft;
    this.clear();
  }

  reset() {
    this.clear();
    this.remaining = this.duration;
    this.onTick(this.remaining);
  }

  private tick() {
    const left = this.timeLeft;
    this.onTick(left);
    if (left <= 0) {
      this.remaining = 0;
      this.clear();
      this.onEnd();
    }
  }

  private clear() {
    clearInterval(this.intervalId);
    this.intervalId = undefined;
  }
}
