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
/** Short first names that read the same in most languages. */
export declare const NAMES: string[];
export declare function chatPack(o?: ChatOptions): Pack;
/** Reads what an element is from its tag, its role and its size. */
export declare function kindOf(el: Element, tool: string, fontSize?: number): Kind;
export declare function taskText(pack: {
    tasks: TaskVerbs;
    kinds: Record<Kind, string>;
}, tool: string, kind: Kind): string;
/** First words of a text, short enough for a bubble. */
export declare function snippet(text: string, max?: number): string;
/** A short name for a section: data-swarmtroopers-section, aria-label, id, first heading, or its role. */
export declare function sectionName(el: Element | null, subjects: Subjects): string;
export declare const fill: (template: string, s: string, n?: number) => string;
export {};
