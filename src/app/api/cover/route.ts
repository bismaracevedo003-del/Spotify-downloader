import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { url, filename } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'Falta la URL de la imagen.' }, { status: 400 });
    }

    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'No se pudo descargar la carátula.' }, { status: 500 });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const safeFilename = filename || 'cover.jpg';

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Type': contentType,
      },
    });
  } catch (error: unknown) {
    console.error('Error al descargar carátula:', error);
    return NextResponse.json({ error: 'Error procesando la carátula' }, { status: 500 });
  }
}
