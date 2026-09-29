import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isNative = Capacitor.isNativePlatform();

/** Descarga (web) o comparte (nativo) un archivo de texto. */
export async function saveTextFile(filename: string, text: string, mime = 'application/json') {
  if (isNative) {
    const res = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, url: res.uri, dialogTitle: 'Guardar copia de seguridad' });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Comparte texto (WhatsApp, etc.). Devuelve 'shared' | 'copied' | 'failed'. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    const can = await Share.canShare();
    if (can.value) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
  } catch (e) {
    // El usuario canceló el diálogo de compartir
    if (e instanceof Error && /cancel|abort/i.test(e.message)) return 'shared';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Descarga (web) o comparte (nativo) un archivo binario: PNG, PDF, XLSX… */
export async function saveBlob(filename: string, blob: Blob) {
  if (isNative) {
    const data = await blobToBase64(blob);
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title: filename, url: res.uri, dialogTitle: 'Guardar archivo' });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
