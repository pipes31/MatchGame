import sun from "../assets/image/1.webp";
import wrapped from "../assets/image/2.webp";
import swirl from "../assets/image/3.webp";
import cookie from "../assets/image/4.webp";

export interface Candy {
  src: string;
  name: string;
  /** Accent used for the floating score text. */
  color: string;
}

export const CANDIES: Candy[] = [
  { src: sun, name: "Sun drop", color: "#ffd23f" },
  { src: wrapped, name: "Wrapped candy", color: "#ff4d5e" },
  { src: swirl, name: "Swirl lollipop", color: "#ff7ab6" },
  { src: cookie, name: "Choco cookie", color: "#e0a46a" },
];

// Warm the cache so the first board renders without pop-in.
for (const candy of CANDIES) new Image().src = candy.src;
