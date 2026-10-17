// Helper compartido para obtener metadatos de Spotify
// Prioridad 1: Web Embed de Spotify (¡100% público, no requiere tokens, NUNCA expira!)
// Prioridad 2: Spotify Web API oficial con Client Credentials

export function getSpotifyTrackId(input: string): string | null {
  const uriMatch = input.match(/spotify:track:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = input.match(/track\/([a-zA-Z0-9]+)/);
  return urlMatch ? urlMatch[1] : null;
}

export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  durationMs: number;
}

// 1. Extraer directo del Web Embed de Spotify (sin token, sin límites)
async function fetchFromEmbed(trackId: string): Promise<TrackInfo | null> {
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/
    );
    if (!match) return null;

    const data = JSON.parse(match[1]);
    const entity = data.props?.pageProps?.state?.data?.entity;
    if (!entity) return null;

    const title = entity.name || 'Unknown Track';
    const artists =
      entity.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown Artist';
    const coverUrl =
      entity.visualIdentity?.image?.[2]?.url || entity.visualIdentity?.image?.[0]?.url || '';
    const durationMs = entity.duration || 0;

    return {
      title,
      artist: artists,
      album: '',
      coverUrl,
      durationMs,
    };
  } catch {
    return null;
  }
}

// 2. Extraer de la API oficial de Spotify (con Client Credentials)
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  try {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return cachedToken.value;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) return null;

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;

    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return data.access_token;
  } catch {
    return null;
  }
}

async function fetchFromApi(trackId: string): Promise<TrackInfo | null> {
  try {
    const token = await getSpotifyToken();
    if (!token) return null;

    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;
    const track = await res.json();

    return {
      title: track.name,
      artist: track.artists?.map((a: { name: string }) => a.name).join(', ') || '',
      album: track.album?.name || '',
      coverUrl: track.album?.images?.[0]?.url || '',
      durationMs: track.duration_ms || 0,
    };
  } catch {
    return null;
  }
}

// Función principal: intenta embed (sin token) y si falla intenta API
export async function getTrackMetadata(trackId: string): Promise<TrackInfo> {
  const fromEmbed = await fetchFromEmbed(trackId);
  if (fromEmbed) return fromEmbed;

  const fromApi = await fetchFromApi(trackId);
  if (fromApi) return fromApi;

  throw new Error('No se pudo obtener información de la canción de Spotify.');
}
