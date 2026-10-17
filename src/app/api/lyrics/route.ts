import { NextRequest, NextResponse } from 'next/server';
import { getLyrics } from '@/lib/lyrics';

export async function POST(req: NextRequest) {
  try {
    const { artist, title } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Falta el título de la canción' }, { status: 400 });
    }

    const lyrics = await getLyrics(artist || '', title);

    if (!lyrics) {
      return NextResponse.json(
        { error: 'No se encontró la letra de esta canción.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ lyrics });
  } catch (error: unknown) {
    console.error('Error obteniendo letras:', error);
    return NextResponse.json({ error: 'Error al buscar la letra' }, { status: 500 });
  }
}
