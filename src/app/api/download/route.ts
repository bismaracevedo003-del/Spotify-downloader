import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ID3 from 'node-id3';
import type { Tags } from 'node-id3';
import { getSpotifyTrackId, getTrackMetadata } from '../spotify';
import { getLyrics } from '@/lib/lyrics';

const execFileAsync = promisify(execFile);

const YT_DLP_PATH = path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe');

function resolveFfmpegDir(): string | null {
  const ffmpegDir = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft',
    'WinGet',
    'Packages',
    'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe',
    'ffmpeg-9.0.2-full_build',
    'bin'
  );
  if (fs.existsSync(path.join(ffmpegDir, 'ffmpeg.exe'))) {
    return ffmpegDir;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    const trackId = getSpotifyTrackId(url);

    if (!trackId) {
      return NextResponse.json(
        { error: 'Enlace de Spotify no válido. Asegúrate de pegar un enlace de pista (track).' },
        { status: 400 }
      );
    }

    const metadata = await getTrackMetadata(trackId);
    const searchQuery = `ytsearch1:${metadata.title} ${metadata.artist} audio`;

    const lyrics = await getLyrics(metadata.artist, metadata.title);

    let coverBuffer: Buffer | null = null;
    if (metadata.coverUrl) {
      try {
        const coverRes = await fetch(metadata.coverUrl);
        if (coverRes.ok) {
          coverBuffer = Buffer.from(await coverRes.arrayBuffer());
        }
      } catch {
        coverBuffer = null;
      }
    }

    const tempFileName = `song_${Date.now()}`;
    const tmpDir = os.tmpdir();
    const tempMp3 = path.join(tmpDir, `${tempFileName}.mp3`);
    const outputPattern = path.join(tmpDir, `${tempFileName}.%(ext)s`);

    const ffmpegDir = resolveFfmpegDir();

    const ytArgs = [
      searchQuery,
      '--extract-audio',
      '--audio-format',
      'mp3',
      '--audio-quality',
      '0',
      '--output',
      outputPattern,
      '--no-playlist',
    ];

    if (ffmpegDir) {
      ytArgs.push('--ffmpeg-location', ffmpegDir);
    }

    await execFileAsync(YT_DLP_PATH, ytArgs);

    if (!fs.existsSync(tempMp3)) {
      return NextResponse.json(
        { error: 'No se pudo descargar el audio. Intenta con otra pista.' },
        { status: 500 }
      );
    }

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
        language: 'eng',

        text: lyrics,
      };
    }

    ID3.write(tags, tempMp3);

    const fileBuffer = fs.readFileSync(tempMp3);
    fs.unlinkSync(tempMp3);

    const safeTitle = `${metadata.artist} - ${metadata.title}`.replace(
      /[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_\-\. ]/g,
      ''
    );
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
  }
}
