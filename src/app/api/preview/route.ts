import { NextRequest, NextResponse } from 'next/server';
import { detectSpotifyInput, getTrackMetadata, getPlaylistInfo } from '../spotify';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    const detected = detectSpotifyInput(url);

    if (detected.type === 'unknown' || !detected.id) {
      return NextResponse.json({ error: 'Enlace o URI de Spotify no válido.' }, { status: 400 });
    }

    // ------------------------------------------------------------
    // PLAYLIST: devolver info completa con todas las pistas
    // ------------------------------------------------------------
    if (detected.type === 'playlist') {
      const playlist = await getPlaylistInfo(detected.id);
      return NextResponse.json({ type: 'playlist', playlist });
    }

    // ------------------------------------------------------------
    // TRACK individual
    // ------------------------------------------------------------
    const metadata = await getTrackMetadata(detected.id);
    return NextResponse.json({ type: 'track', id: detected.id, metadata });
  } catch (error: unknown) {
    console.error('Error obteniendo metadatos:', error);
    const message = error instanceof Error ? error.message : 'Error obteniendo metadatos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
