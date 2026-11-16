// Generated from the user-supplied positioned-layers.zip by scripts/prepare-high-five.py.
import layer2 from '../assets/high-five/blue-forearm.webp';
import layer3 from '../assets/high-five/orange-forearm.webp';
import layer4 from '../assets/high-five/purple-wrist-cuff.webp';
import layer5 from '../assets/high-five/beige-wrist-cuff.webp';
import layer6 from '../assets/high-five/blue-high-five-hand.webp';
import layer7 from '../assets/high-five/orange-high-five-hand.webp';
import layer8 from '../assets/high-five/top-yellow-sparkle.webp';
import layer9 from '../assets/high-five/right-yellow-sparkle.webp';
import layer10 from '../assets/high-five/purple-sparkle-group.webp';

export const HIGH_FIVE_SIZE = { width: 2048, height: 1360 };

/** Original coordinates and stacking; -1/1 move each complete arm, 0 marks the impact sparkles. */
export const HIGH_FIVE_LAYERS = [
  { src: layer2, x: 31, y: 1003, w: 624, h: 343, group: -1 },
  { src: layer3, x: 1362, y: 1003, w: 643, h: 343, group: 1 },
  { src: layer4, x: 447, y: 911, w: 307, h: 315, group: -1 },
  { src: layer5, x: 1268, y: 923, w: 317, h: 318, group: 1 },
  { src: layer6, x: 539, y: 233, w: 497, h: 879, group: -1 },
  { src: layer7, x: 1008, y: 239, w: 491, h: 886, group: 1 },
  { src: layer8, x: 805, y: 54, w: 180, h: 193, group: 0 },
  { src: layer9, x: 1339, y: 411, w: 156, h: 169, group: 0 },
  { src: layer10, x: 545, y: 362, w: 749, h: 208, group: 0 },
];
