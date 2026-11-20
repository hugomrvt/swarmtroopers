// Generated from the vector high five by scripts/prepare-high-five.py.
import leftHand from '../assets/high-five/left-hand.svg';
import rightHand from '../assets/high-five/right-hand.svg';

export const HIGH_FIVE_SIZE = { width: 1400, height: 1400 };

/** Both bare hands share one square around the contact point; -1/1 move each hand. The right one is drawn first, the left thumb overlaps its palm. */
export const HIGH_FIVE_LAYERS = [
  { src: rightHand, x: 0, y: 0, w: 1400, h: 1400, group: 1 },
  { src: leftHand, x: 0, y: 0, w: 1400, h: 1400, group: -1 },
];
