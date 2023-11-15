export class CountdownTimer {
  private minutes: number;
  private seconds: number;
  private intervalId;

  constructor(minutes: number, seconds: number) {
    this.minutes = minutes;
    this.seconds = seconds;

    this.intervalId = setInterval(this.update.bind(this), 1000);

    this.update();
  }

  update() {
    if (this.minutes === 0 && this.seconds === 0) {
      this.stop();
    } else {
      if (this.seconds === 0) {
        this.minutes--;
        this.seconds = 59;
      } else {
        this.seconds--;
      }
    }
  }

  getTimeRemaining() {
    return { minutes: this.minutes, seconds: this.seconds };
  }

  stop() {
    clearInterval(this.intervalId);
  }
}
