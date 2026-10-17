import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ID3 from 'node-id3';
import type { Tags } from 'node-id3';
import ytDlpExec from 'yt-dlp-exec';
import archiver from 'archiver';
import { detectSpotifyInput, getTrackMetadata, getPlaylistInfo, TrackInfo } from '../spotify';
import { getLyrics } from '@/lib/lyrics';

// ------------------------------------------------------------
// ffmpeg: resolución portable (PATH > variable de entorno > rutas comunes)
// ------------------------------------------------------------
function resolveFfmpegPath(): string | null {
  // 1. Variable de entorno explícita
  const envPath = process.env.FFMPEG_LOCATION;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  // 2. Rutas comunes (Windows winget, Linux, macOS)
  const commonPaths = [
    path.join(
      process.env.LOCALAPPDATA || '',
      'Microsoft',
      'WinGet',
      'Packages',
      'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
      'ffmpeg-9.0.2-full_build',
      'bin',
      'ffmpeg.exe'
    ),
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    '/usr/bin/ffmpeg',
    '/usr/local/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      return p;
    }
  }

  // 3. null => yt-dlp usará ffmpeg del PATH del sistema
  return null;
}

// ------------------------------------------------------------
// Helpers de archivos temporales
// ------------------------------------------------------------
function safeFilename(artist: string, title: string): string {
  return `${artist} - ${title}`.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_\-\. ]/g, '');
}

function detectLanguageCode(text: string): string {
  // Heurística muy simple: si contiene caracteres típicos del español, usar 'esp'
  const hasSpanish = /[áéíóúñ¿¡]/.test(text);
  return hasSpanish ? 'esp' : 'eng';
}

async function downloadTrackToMp3(
  searchQuery: string,
  tmpDir: string,
  tempFileName: string,
  ffmpegPath: string | null
): Promise<string | null> {
  const outputPattern = path.join(tmpDir, `${tempFileName}.%(ext)s`);

  const ytOptions: Record<string, unknown> = {
    extractAudio: true,
    audioFormat: 'mp3',
    audioQuality: '0',
    output: outputPattern,
    noPlaylist: true,
  };

  if (ffmpegPath) {
    ytOptions.ffmpegLocation = ffmpegPath;
  }

  await ytDlpExec(searchQuery, ytOptions);

  // Buscar el archivo generado por yt-dlp en el directorio temporal
  const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith(tempFileName));
  const mp3File = files.find((f) => f.toLowerCase().endsWith('.mp3'));
  if (!mp3File) return null;

  return path.join(tmpDir, mp3File);
}

async function embedMetadata(
  mp3Path: string,
  metadata: TrackInfo,
  coverBuffer: Buffer | null,
  lyrics: string | null
): Promise<void> {
  const tags: Tags = {
    title: metadata.title || undefined,
    artist: metadata.artist || undefined,
    album: metadata.album || undefined,
  };

  if (coverBuffer) {
    tags.image = {
      mime: 'image/jpeg',
      type: {
        id: ID3.TagConstants.AttachedPicture.PictureType.FRONT_COVER,
        name: 'Front cover',
      },
      description: 'Cover',
      imageBuffer: coverBuffer,
    };
  }

  if (lyrics) {
    tags.unsynchronisedLyrics = {
      language: detectLanguageCode(lyrics),
      text: lyrics,
    };
  }

  // node-id3 escribe de forma síncrona; envolver en try/catch para no fallar la descarga
  try {
    ID3.write(tags, mp3Path);
  } catch (err) {
    console.warn('No se pudieron escribir los metadatos ID3:', err);
  }
}

async function fetchCoverBuffer(coverUrl: string): Promise<Buffer | null> {
  try {
    const res = await fetch(coverUrl);
    if (res.ok) {
      return Buffer.from(await res.arrayBuffer());
    }
  } catch {
    // Si falla la carátula, seguimos sin ella
  }
  return null;
}

// ------------------------------------------------------------
// Route handler
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const tmpDir = os.tmpdir();
  const tempFileName = `song_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tempFiles: string[] = []; // para limpieza en finally

  try {
    const { url, type: inputType } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'Falta la URL o URI de Spotify.' }, { status: 400 });
    }

    const detected = detectSpotifyInput(url);
    const type = inputType || detected.type;

    if (type === 'unknown' || detected.type === 'unknown') {
      return NextResponse.json(
        { error: 'Enlace de Spotify no válido. Usa un enlace de pista (track) o playlist.' },
        { status: 400 }
      );
    }

    const ffmpegPath = resolveFfmpegPath();

    // ------------------------------------------------------------
    // PLAYLIST: descargar todas las pistas y empaquetar en ZIP
    // ------------------------------------------------------------
    if (type === 'playlist' && detected.id) {
      const playlist = await getPlaylistInfo(detected.id);
      const zipFileName = `${safeFilename(playlist.owner, playlist.name)}.zip`;
      const zipPath = path.join(tmpDir, `${tempFileName}_playlist.zip`);

      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(output);

      let completed = 0;
      for (const track of playlist.tracks) {
        completed++;
        const searchQuery = `ytsearch1:${track.title} ${track.artist} audio`;

        // Buscar letra
        const lyrics = await getLyrics(track.artist, track.title);

        // Descargar carátula
        const coverBuffer = track.coverUrl ? await fetchCoverBuffer(track.coverUrl) : null;

        // Descargar y convertir a MP3
        const mp3Path = await downloadTrackToMp3(
          searchQuery,
          tmpDir,
          `${tempFileName}_${completed}`,
          ffmpegPath
        );
        if (!mp3Path) {
          continue; // saltar pista si falla la descarga de audio
        }
        tempFiles.push(mp3Path);

        // Embebir metadatos
        await embedMetadata(mp3Path, track, coverBuffer, lyrics);

        // Agregar al ZIP
        const entryName = `${safeFilename(track.artist, track.title)}.mp3`;
        archive.file(mp3Path, { name: entryName });
      }

      archive.finalize();

      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        output.on('error', (err) => reject(err));
      });

      const zipBuffer = fs.readFileSync(zipPath);
      tempFiles.push(zipPath);

      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Disposition': `attachment; filename="${zipFileName}"`,
          'Content-Type': 'application/zip',
          'Content-Length': zipBuffer.length.toString(),
          'X-Playlist-Name': playlist.name,
          'X-Playlist-Tracks': String(playlist.tracks.length),
        },
      });
    }

    // ------------------------------------------------------------
    // TRACK individual
    // ------------------------------------------------------------
    if (!detected.id) {
      return NextResponse.json(
        { error: 'No se pudo extraer el ID de la pista de Spotify.' },
        { status: 400 }
      );
    }

    // Obtener metadatos de la pista (incluye carátula de Spotify)
    const metadata = await getTrackMetadata(detected.id);
    const searchQuery = `ytsearch1:${metadata.title} ${metadata.artist} audio`;

    // Buscar letra
    const lyrics = await getLyrics(metadata.artist, metadata.title);

    // Descargar carátula de Spotify
    const coverBuffer = metadata.coverUrl ? await fetchCoverBuffer(metadata.coverUrl) : null;

    // Descargar y convertir a MP3
    const mp3Path = await downloadTrackToMp3(searchQuery, tmpDir, tempFileName, ffmpegPath);
    if (!mp3Path) {
      return NextResponse.json(
        { error: 'No se pudo descargar el audio. Intenta con otra pista.' },
        { status: 500 }
      );
    }
    tempFiles.push(mp3Path);

    // Embebir tags ID3v2 (título, artista, álbum, carátula APIC, letra USLT)
    await embedMetadata(mp3Path, metadata, coverBuffer, lyrics);

    const fileBuffer = fs.readFileSync(/*turbopackIgnore: true*/ mp3Path);

    const safeTitle = safeFilename(metadata.artist, metadata.title);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Disposition': `attachment; filename="${safeTitle}.mp3"`,
        'Content-Type': 'audio/mpeg',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error al procesar la descarga:', error);
    const message = error instanceof Error ? error.message : 'Error procesando la pista';
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Limpieza de archivos temporales (incluye partes de yt-dlp)
    for (const file of tempFiles) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {
        // Ignorar errores de limpieza
      }
    }
    // También limpiar cualquier archivo residual del patrón tempFileName
    try {
      const residuals = fs.readdirSync(tmpDir).filter((f) => f.startsWith(tempFileName));
      for (const f of residuals) {
        fs.unlinkSync(path.join(tmpDir, f));
      }
    } catch {
      // Ignorar
    }
  }
}
