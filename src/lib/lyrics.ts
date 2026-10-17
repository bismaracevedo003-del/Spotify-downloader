import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);
const YT_DLP_PATH = path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');

// 1. Intentar letras con api.lyrics.ovh (público, sin token)
async function fetchLyricsOvh(artist: string, title: string): Promise<string | null> {
  try {
    const cleanArtist = artist.split(',')[0].trim();
    const cleanTitle = title
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .trim();
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.lyrics || null;
  } catch {
    return null;
  }
}

// 2. Fallback: extraer subtítulos/transcripción del video oficial con yt-dlp
async function fetchLyricsFromYouTube(artist: string, title: string): Promise<string | null> {
  try {
    const query = `ytsearch1:${title} ${artist} audio lyrics`;
    const { stdout } = await execFileAsync(YT_DLP_PATH, ['--dump-json', '--no-playlist', query]);

    const d = JSON.parse(stdout);
    const subs =
      d.subtitles?.es || d.subtitles?.en || d.automatic_captions?.es || d.automatic_captions?.en;

    const srt = subs?.find(
      (s: { ext: string }) => s.ext === 'vtt' || s.ext === 'srv1' || s.ext === 'ttml'
    );
    if (!srt || !srt.url) return null;

    const res = await fetch(srt.url);
    const text = await res.text();

    // Limpiar marcas de tiempo y etiquetas VTT/XML
    const clean = text
      .replace(/<[^>]+>/g, '')
      .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '')
      .replace(/WEBVTT/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter(
        (l, i, arr) =>
          l && l !== arr[i - 1] && !l.startsWith('align:') && !l.startsWith('position:')
      )
      .join('\n');

    return clean || null;
  } catch {
    return null;
  }
}

/**
 * Busca la letra de una canción.
 * Intenta primero lyrics.ovh y, si falla, usa subtítulos de YouTube como fallback.
 */
export async function getLyrics(artist: string, title: string): Promise<string | null> {
  if (!title) return null;

  let lyrics = await fetchLyricsOvh(artist || '', title);
  if (!lyrics) {
    lyrics = await fetchLyricsFromYouTube(artist || '', title);
  }
  return lyrics;
}
