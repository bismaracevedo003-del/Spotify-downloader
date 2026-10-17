import { NextRequest, NextResponse } from 'next/server';
import { getSpotifyTrackId, getTrackMetadata } from '../spotify';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    const trackId = getSpotifyTrackId(url);

    if (!trackId) {
      return NextResponse.json({ error: 'Enlace o URI de Spotify no válido.' }, { status: 400 });
    }

    const metadata = await getTrackMetadata(trackId);
    return NextResponse.json(metadata);
  } catch (error: unknown) {
    console.error('Error obteniendo metadatos:', error);
    const message = error instanceof Error ? error.message : 'Error obteniendo metadatos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
