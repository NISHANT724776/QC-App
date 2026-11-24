import { PhotoAttachment } from '../domain/models/inspection';

const MAX_EDGE = 1600;
const QUALITY = 0.8;

/**
 * Converts a picked file into a photo attachment. When "Optimize Image" is on the picture is
 * downscaled (max 1600 px) and re-encoded as JPEG. (Exact limits of the source app: docs Q-13.)
 */
export async function fileToPhoto(file: File, optimize: boolean): Promise<PhotoAttachment> {
  const dataUrl = optimize ? await compress(file) : await readAsDataUrl(file);
  return { id: crypto.randomUUID(), name: file.name || 'photo.jpg', dataUrl, comment: '', uploaded: false };
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function compress(file: File): Promise<string> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return canvas.toDataURL('image/jpeg', QUALITY);
  } catch {
    return readAsDataUrl(file);
  }
}
