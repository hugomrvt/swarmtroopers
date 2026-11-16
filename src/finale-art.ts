/** Shared by the core renderer and the optional artwork entry. No raster imports here. */
export interface FinaleArtwork {
  width: number;
  height: number;
  layers: ReadonlyArray<{ src: string; x: number; y: number; w: number; h: number; group: number }>;
}
let artwork: FinaleArtwork | null = null;
export const getFinaleArtwork = (): FinaleArtwork | null => artwork;
export function setFinaleArtwork(value: FinaleArtwork): void { artwork = value; }
