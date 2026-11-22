/** Shared by the core renderer and the optional artwork entry. No image imports here. */
export interface FinaleArtwork {
    /** One square image per hand, both framed around the contact point. `group` is the side it moves from: -1 left, 1 right. */
    layers: ReadonlyArray<{
        src: string;
        group: number;
    }>;
}
export declare const getFinaleArtwork: () => FinaleArtwork | null;
export declare function setFinaleArtwork(value: FinaleArtwork): void;
