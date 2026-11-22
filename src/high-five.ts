// The SVG hands are written by scripts/prepare-high-five.py.
import leftHand from '../assets/high-five/left-hand.svg';
import rightHand from '../assets/high-five/right-hand.svg';

/** Both bare hands share one square around the contact point. The right one is drawn first, the left thumb overlaps its palm. */
export const HIGH_FIVE_LAYERS = [
  { src: rightHand, group: 1 },
  { src: leftHand, group: -1 },
];
