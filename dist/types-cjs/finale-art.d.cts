/** Shared by the core renderer and the optional artwork entry. No raster imports here. */
export interface FinaleArtwork {
    width: number;
    height: number;
    layers: ReadonlyArray<{
        src: string;
        x: number;
        y: number;
        w: number;
        h: number;
        group: number;
    }>;
}
export declare const getFinaleArtwork: () => FinaleArtwork | null;
export declare function setFinaleArtwork(value: FinaleArtwork): void;
