export type ChatKey = 'plan' | 'ready' | 'reply' | 'rush' | 'done';
export type ChatLines = Record<ChatKey, string[]>;
export type Subjects = Record<'header' | 'footer' | 'part', string>;
/** What an element is, as said in the task shown next to a worker. */
export type Kind = 'title' | 'text' | 'label' | 'item' | 'button' | 'link' | 'image' | 'card' | 'line' | 'list' | 'block';
/** Verb templates per tool, "{k}" being the element ("Writing {k}"). */
export type TaskVerbs = Record<'type' | 'frame' | 'rule' | 'stamp' | 'other', string>;

export interface ChatOptions {
  /** "en", "fr"… Defaults to the lang attribute of the page. */
  locale?: string;
  /** Replace some or all lines. "{s}" is the section name, "{n}" the number of agents sent. */
  lines?: Partial<ChatLines>;
  subjects?: Partial<Subjects>;
  /** Task shown next to a worker, per tool. "{k}" is the element. */
  tasks?: Partial<TaskVerbs>;
  /** Words for each kind of element, as used in tasks. */
  kinds?: Partial<Record<Kind, string>>;
  /** Show the bubbles. Defaults to true when options are given, so `{ bubbles: false, tasks }` only rewrites the tasks. */
  bubbles?: boolean;
}

interface Pack {
  lines: ChatLines;
  subjects: Subjects;
  tasks: TaskVerbs;
  kinds: Record<Kind, string>;
  lead: string;
}

/** Short Fullmetal Alchemist names, lower case like cursor tags. */
export const NAMES = ['ed', 'al', 'win', 'roy', 'riza', 'maes', 'izumi', 'ling', 'mei', 'scar', 'havoc', 'fuery', 'breda', 'ross', 'sig', 'greed'];

const EN: Pack = {
  lines: {
    plan: ['{s}, {n} on it', '{n} for {s}', 'Taking {s}'],
    ready: ['{s} is ready', '{s} checked', '{s}, done'],
    reply: ['OK', 'On it', 'Got it'],
    rush: ['More hands, they scroll fast', 'Speeding up'],
    done: ['Page complete'],
  },
  subjects: { header: 'the header', footer: 'the footer', part: 'this part' },
  tasks: { type: 'Writing {k}', frame: 'Framing {k}', rule: 'Drawing {k}', stamp: 'Copying {k}', other: 'Building {k}' },
  kinds: {
    title: 'the title',
    text: 'the text',
    label: 'a label',
    item: 'an item',
    button: 'the button',
    link: 'the link',
    image: 'the image',
    card: 'the card',
    line: 'a divider',
    list: 'the list',
    block: 'a block',
  },
  lead: 'Orchestrator',
};

const FR: Pack = {
  lines: {
    plan: ['{s}, {n} dessus', '{n} sur {s}', 'Je prends {s}'],
    ready: ['{s}, c’est bon', 'Fini pour {s}', '{s}, validé'],
    reply: ['Ok', 'Reçu', 'J’y vais'],
    rush: ['Du renfort, ça scrolle vite', 'On accélère'],
    done: ['Page terminée'],
  },
  subjects: { header: 'l’en-tête', footer: 'le pied de page', part: 'cette partie' },
  tasks: { type: 'Écrit {k}', frame: 'Cadre {k}', rule: 'Trace {k}', stamp: 'Duplique {k}', other: 'Construit {k}' },
  kinds: {
    title: 'le titre',
    text: 'le texte',
    label: 'un label',
    item: 'un élément',
    button: 'le bouton',
    link: 'le lien',
    image: 'l’image',
    card: 'la carte',
    line: 'un séparateur',
    list: 'la liste',
    block: 'un bloc',
  },
  lead: 'Orchestrateur',
};

const LOCALES: Record<string, Pack> = { en: EN, fr: FR };

export function chatPack(o: ChatOptions = {}): Pack {
  const lang = (o.locale || (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'en').toLowerCase().slice(0, 2);
  const base = LOCALES[lang] ?? EN;
  return {
    lines: { ...base.lines, ...o.lines },
    subjects: { ...base.subjects, ...o.subjects },
    tasks: { ...base.tasks, ...o.tasks },
    kinds: { ...base.kinds, ...o.kinds },
    lead: base.lead,
  };
}

/** Reads what an element is from its tag, its role and its size. */
export function kindOf(el: Element, tool: string, fontSize = 16): Kind {
  const tag = el.localName;
  if (tool === 'rule' || tag === 'hr') return 'line';
  if (/^h[1-6]$/.test(tag)) return 'title';
  if (tag === 'li' || tag === 'dt' || tag === 'dd' || tool === 'stamp') return 'item';
  if (tag === 'button' || el.getAttribute('role') === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (/^(img|svg|picture|video|canvas|figure|iframe)$/.test(tag)) return 'image';
  if (tag === 'ul' || tag === 'ol' || tag === 'dl') return 'list';
  if (tool === 'type') return fontSize < 13.5 ? 'label' : 'text';
  if (tool === 'frame') return 'card';
  return 'block';
}

export function taskText(pack: { tasks: TaskVerbs; kinds: Record<Kind, string> }, tool: string, kind: Kind): string {
  const verb = (pack.tasks as Record<string, string>)[tool] ?? pack.tasks.other;
  return verb.replace('{k}', pack.kinds[kind]);
}

/** First words of a text, short enough for a bubble. */
export function snippet(text: string, max = 22): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[,.;:]$/, '') + '…';
}

const human = (id: string): string => {
  const s = id.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** A short name for a section: data-swarmtroopers-section, aria-label, id, first heading, or its role. */
export function sectionName(el: Element | null, subjects: Subjects): string {
  if (!el) return subjects.part;
  const named = el.getAttribute('data-swarmtroopers-section') || el.getAttribute('aria-label');
  if (named) return snippet(named);
  if (el.id && !/^\d|[0-9a-f]{8}/.test(el.id)) return snippet(human(el.id));
  const heading = el.querySelector('h1, h2, h3');
  // innerText keeps the space a <br> stands for, textContent glues the words.
  const title = heading ? (heading as HTMLElement).innerText || heading.textContent : '';
  if (title) return snippet(title);
  if (el.localName === 'header') return subjects.header;
  if (el.localName === 'footer') return subjects.footer;
  return subjects.part;
}

export const fill = (template: string, s: string, n = 0): string => template.replace('{s}', s).replace('{n}', String(n));
