import type { SwarmTroopersElement, CursorShape } from './types.js';
import type { Persona } from './motion.js';

/** A part of the page (section, header, footer…) built by one squad. */
export interface Section {
  id: number;
  el: Element | null;
  name: string;
  /** Colour of the section survey outline. Workers keep their own identity colours. */
  color: string;
  order: number;
  tasks: Task[];
  /** The orchestrator has surveyed it once. */
  planned: boolean;
  /** "Ready" has been said. */
  announced: boolean;
  /** Outline drawn while it is being built. */
  zone: { done(): void } | null;
}

export interface Task {
  id: number;
  el: SwarmTroopersElement;
  tool: string;
  /** Document order, used as reading order. */
  order: number;
  /** Nearest ancestor task: it must be finished before this one starts. */
  parent: Task | null;
  /** For a stamp, the previous item of the list it is copied from. */
  source: Task | null;
  deps: Task[];
  section: Section;
  state: 'pending' | 'active' | 'done';
  /** Has been in the viewport at least once. */
  seen: boolean;
  /** Currently in the viewport. */
  inView: boolean;
  /** Clock time at which it became ready and visible, for the patience rule. */
  waitingSince: number;
  /** Inline clip-path found on the element, restored at the end. */
  prevClip: string;
  prevClipPriority: string;
  prevPop: boolean;
}

export interface Agent {
  id: number;
  color: string;
  /** The orchestrator: dispatches squads, talks, inspects. */
  lead: boolean;
  /** Section of a worker. */
  squad: Section | null;
  /** Name shown in the tag next to the pointer, empty to hide it. */
  name: string;
  /** Current task, shown next to the name for a moment. */
  doing: { text: string; age: number } | null;
  /** Hand drawn mirrored, facing left. */
  flip: boolean;
  /** Current speech bubble. */
  say: { text: string; age: number; ttl: number } | null;
  /** Pointer position in document coordinates. */
  x: number;
  y: number;
  shape: CursorShape;
  /** Press feedback, 0 to 1. */
  press: number;
  /** Mouse button held down (dragging). */
  hold: boolean;
  /** Pointer faded while typing, like a desktop OS hides it. */
  dim: boolean;
  alpha: number;
  /** Nothing moves: the render loop may sleep. */
  rest: boolean;
  task: Task | null;
  job: Generator<void, void, number> | null;
  idle: number;
  leaving: boolean;
  persona: Persona;
}
