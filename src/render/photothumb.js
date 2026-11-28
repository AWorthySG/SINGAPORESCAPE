import { validPhotoThumbnail } from '../game/photowalk.js';

/** Keep a small copy of the actual picture for the album, or use its stock
 * art when the browser cannot encode a suitable WebP within the save budget. */
export function compactPhoto(source, makeCanvas) {
  if (!source?.width || !source.height) return null;
  try {
    for (const size of [160, 112]) {
      const fit = Math.min(size / source.width, size / source.height, 1);
      const w = Math.max(1, Math.round(source.width * fit)), h = Math.max(1, Math.round(source.height * fit));
      const cv = makeCanvas(w, h), g = cv?.getContext('2d');
      if (!g || !cv.toDataURL) return null;
      g.drawImage(source, 0, 0, w, h);
      const data = cv.toDataURL('image/webp', .56);
      if (validPhotoThumbnail(data)) return data;
    }
  } catch { /* a canvas may not be readable in this browser */ }
  return null;
}
