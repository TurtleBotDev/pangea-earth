import { clampAge, MAX_AGE, MIN_AGE } from './geological-time.js';

const MAX_FRAME_SECONDS = 0.1;

/** Frame timing only; loading, rendering, and DOM updates belong to the app.
 * Negative direction advances toward today because geological age decreases.
 */
export class PlaybackClock {
  playing = false;
  direction = -1;
  previousTime = null;

  start(age) {
    this.playing = true;
    this.previousTime = null;
    // Restart from the opposite endpoint if already at the destination.
    if (this.direction < 0 && age <= MIN_AGE) {
      return MAX_AGE;
    }
    if (this.direction > 0 && age >= MAX_AGE) {
      return MIN_AGE;
    }
    return age;
  }

  stop() {
    this.playing = false;
    this.resetFrame();
  }

  resetFrame() {
    this.previousTime = null;
  }

  reverse() {
    this.direction *= -1;
  }

  advance(now, age, speed) {
    if (!this.playing) {
      return age;
    }
    if (this.previousTime === null) {
      this.previousTime = now;
      return age;
    }

    // Cap elapsed time so a stalled frame never jumps across geological ages.
    const elapsed = Math.min((now - this.previousTime) / 1000, MAX_FRAME_SECONDS);
    this.previousTime = now;
    const nextAge = clampAge(age + this.direction * elapsed * speed);
    if (nextAge === MIN_AGE || nextAge === MAX_AGE) {
      this.stop();
    }
    return nextAge;
  }
}
