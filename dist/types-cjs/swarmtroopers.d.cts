import type { SwarmTroopersEventMap, SwarmTroopersOptions, SwarmTroopersStats, Quality } from './types.cjs';
import { type RGB } from './palette.cjs';
export declare class SwarmTroopers {
    readonly root: Element;
    /** Speed multiplier applied to every gesture, recomputed each frame from the backlog. */
    tempo: number;
    private s;
    private q;
    private stylesOwned;
    private unsupported;
    private pluginCleanups;
    private annotationOwners;
    private taskSeq;
    private sectionSeq;
    private skipBuild;
    private plugins;
    private tasks;
    private sections;
    private sectionByKey;
    private byEl;
    /** Built elements retired while hidden (an inactive tab panel): shown again, they come back finished, not rebuilt. */
    private built;
    private agents;
    private lead;
    /** Elements wearing our soft-edge mask, to take it off when their sweep ends or is cut short. */
    private masked;
    /** Freshly built elements the orchestrator has not looked over yet, newest last. */
    private review;
    private anns;
    private overlay;
    private io;
    private ro;
    private events;
    private r;
    private bg;
    private halo;
    private ink;
    private palette;
    private raf;
    private running;
    private last;
    private clock;
    private started;
    private paused;
    private destroyed;
    private finished;
    private seq;
    private spawned;
    private doneCount;
    private t0;
    private layout;
    private geos;
    private rects;
    private sx;
    private sy;
    private pointer;
    /** Hover candidate, since when, and the element handed to the orchestrator. */
    private insp;
    private owned;
    private unlisten;
    private invalidateSoon;
    private look;
    private chat;
    private subjects;
    private leadName;
    private words;
    /** Last worker seen at work, who shares the final high five with the orchestrator. */
    private lastWorker;
    /** The closing high five, drawn over the page once everything is built. */
    private fin;
    private queue;
    constructor(options?: SwarmTroopersOptions);
    /** Current rendering budget. */
    get quality(): Quality;
    get stats(): SwarmTroopersStats;
    /** Colours read from the page, handy to style UI placed around the troopers. */
    get theme(): {
        background: string;
        text: string;
        rgb: Readonly<RGB>;
        palette: readonly string[];
    };
    on<K extends keyof SwarmTroopersEventMap>(type: K, fn: (payload: SwarmTroopersEventMap[K]) => void): () => void;
    off<K extends keyof SwarmTroopersEventMap>(type: K, fn: (payload: SwarmTroopersEventMap[K]) => void): void;
    /** Starts the build. Called for you unless trigger is "manual". */
    start(): void;
    pause(): void;
    resume(): void;
    /** Shows everything at once and sends the agents away. */
    finish(): void;
    /** Picks up elements added to the page since the troopers started (client-side navigation, lazy content). */
    refresh(): void;
    setQuality(q: Quality): void;
    private applyQuality;
    /** Ties an element (a control panel…) to the troopers: it is removed by destroy(). */
    own(el: Element): void;
    /** Removes everything the troopers added and restores the page as it was. */
    destroy(): void;
    private safe;
    private fail;
    private restoreClip;
    /**
     * Reveals the top-left part of an element. A gradient mask gives it a soft edge; an element with a mask of
     * its own, or a browser without mask compositing, gets the hard clip-path instead.
     */
    private sweep;
    private restoreClasses;
    /** `swarmtroopers-pending` is ours alone: found on an element we do not track (a DOM snapshot taken mid-build), it would hide it for good. */
    private sweepStale;
    private cancelJob;
    private revealChain;
    private prune;
    private resolveQuality;
    private paint;
    private narrow;
    private init;
    /** Scans the root and creates the tasks it does not know yet, grouped by section. */
    private collect;
    private sectionFor;
    private observe;
    private mountOverlay;
    private listen;
    private wake;
    private tick;
    /** The loop sleeps as soon as nothing moves. */
    private busy;
    private ready;
    private hasReady;
    private patience;
    private update;
    private makeAgent;
    /** The orchestrator walks in from the right edge, near the top of the screen. */
    private spawnLead;
    /**
     * The troopers follow the reader. A task whose element left the screen is settled at once: shown if the reader
     * went past it, put back for later if the reader went back up. Its worker is then free for what is in view.
     */
    private follow;
    /** The visible section with the most work waiting and room in its squad. */
    private visibleSection;
    /** A first name not worn by anyone on screen. */
    private nameFor;
    private assign;
    private stepAgent;
    /** Back to the orchestrator, then gone. Without one on screen, out by the nearest edge. */
    private regroup;
    /** A worker leaves the orchestrator's hand in turn, fanning out towards its section. */
    private depart;
    private leave;
    /** Follows a planned path. If the target moves meanwhile (sticky, marquee…), the path bends towards it. */
    private travel;
    private wait;
    /** Survey, dispatch, check, and inspect once the page is built. */
    private leadLoop;
    private building;
    /** Top right of the screen, out of the way of the content. */
    private leadHome;
    private squadOf;
    /** A section with work and nobody on it, the visible ones first. Or a squad drowning in work. */
    private nextSection;
    /** Visible part of a section, in document coordinates. */
    private sectionRect;
    private dispatch;
    /** The most recent piece of work still on screen, if any. Older ones are let go. */
    private nextReview;
    /** Between two dispatches the orchestrator looks over what a worker just finished: over, a tap, a beat. */
    private check;
    private inspectWith;
    private context;
    private complete;
    private popChain;
    private pop;
    private wrapUp;
    /** Runs the closing clap while the troopers fade out. */
    private finale;
    /** Any deliberate input closes the finale at once. Momentum scrolling does not count. */
    private dismiss;
    private onScroll;
    private line;
    private say;
    private talking;
    /**
     * The orchestrator speaks at once, its new line replacing the previous one, so what it says
     * always matches where it stands. Other lines wait their turn and are dropped if they come too late.
     */
    private speak;
    /** A short answer may overlap the line it answers. */
    private reply;
    private converse;
    private onPointer;
    /** After a short hover on a finished element, it is handed to the orchestrator. */
    private inspect;
    private mark;
    private labelFor;
    private text;
    /** Live document rectangle, read at most once per frame. */
    private rect;
    private invalidate;
}
