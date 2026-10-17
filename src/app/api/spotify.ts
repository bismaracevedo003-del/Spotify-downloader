// Helper compartido para obtener metadatos de Spotify
// Prioridad 1: Web Embed de Spotify (¡100% público, no requiere tokens, NUNCA expira!)
// Prioridad 2: Spotify Web API oficial con Client Credentials

export function getSpotifyTrackId(input: string): string | null {
  const uriMatch = input.match(/spotify:track:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = input.match(/track\/([a-zA-Z0-9]+)/);
  return urlMatch ? urlMatch[1] : null;
}

export function getSpotifyPlaylistId(input: string): string | null {
  const uriMatch = input.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = input.match(/playlist\/([a-zA-Z0-9]+)/);
  return urlMatch ? urlMatch[1] : null;
}

export type SpotifyInputType = 'track' | 'playlist' | 'unknown';

export interface SpotifyInput {
  type: SpotifyInputType;
  id: string | null;
}

export interface TrackInfo {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  durationMs: number;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  description?: string;
  owner: string;
  coverUrl: string;
  totalTracks: number;
  tracks: TrackInfo[];
}

export function detectSpotifyInput(input: string): SpotifyInput {
  const trackId = getSpotifyTrackId(input);
  if (trackId) return { type: 'track', id: trackId };

  const playlistId = getSpotifyPlaylistId(input);
  if (playlistId) return { type: 'playlist', id: playlistId };

  return { type: 'unknown', id: null };
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

// ------------------------------------------------------------
// Playlists
// ------------------------------------------------------------

// 1. Obtener info completa de una playlist desde la API oficial de Spotify
async function fetchPlaylistFromApi(playlistId: string): Promise<PlaylistInfo | null> {
  try {
    const token = await getSpotifyToken();
    if (!token) return null;

    // Datos generales de la playlist
    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const playlist = await res.json();

    const name = playlist.name || 'Playlist de Spotify';
    const owner = playlist.owner?.display_name || playlist.owner?.id || 'Desconocido';
    const description = playlist.description || undefined;
    const coverUrl = playlist.images?.[0]?.url || '';
    const totalTracks = playlist.tracks?.total || 0;

    // Obtener todas las pistas con paginación (máx. 100 por request)
    const tracks: TrackInfo[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const tracksRes = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}&fields=items(track(name,artists(name),album(name,images),duration_ms),is_local),next,total`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!tracksRes.ok) break;
      const data = await tracksRes.json();

      const items = data.items || [];
      for (const item of items) {
        if (item.is_local || !item.track) continue;
        const t = item.track as Record<string, unknown>;
        const artists =
          (Array.isArray(t.artists)
            ? t.artists.map((a: { name: string }) => a.name).join(', ')
            : '') || 'Unknown Artist';
        tracks.push({
          title: (t.name as string) || 'Unknown Track',
          artist: artists,
          album: (t.album as { name?: string })?.name || '',
          coverUrl: (t.album as { images?: { url?: string }[] })?.images?.[0]?.url || coverUrl,
          durationMs: (t.duration_ms as number) || 0,
        });
      }

      offset += items.length;
      hasMore = !!data.next && tracks.length < totalTracks;
      if (items.length === 0) hasMore = false;
    }

    return {
      id: playlistId,
      name,
      description,
      owner,
      coverUrl,
      totalTracks: tracks.length,
      tracks,
    };
  } catch {
    return null;
  }
}

// 2. Fallback: intentar extraer datos del Web Embed de playlist
async function fetchPlaylistFromEmbed(playlistId: string): Promise<PlaylistInfo | null> {
  try {
    const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
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
    const state = data.props?.pageProps?.state;
    if (!state) return null;

    // Intentar localizar la entidad de playlist en varias rutas posibles
    const entity =
      state.data?.entity ||
      state.data?.playlist ||
      state.data?.playlistV2 ||
      state.data?.collection;

    if (!entity) return null;

    const name = entity.name || entity.title || 'Playlist de Spotify';
    const owner = entity.owner?.name || entity.owner?.display_name || 'Desconocido';
    const coverUrl =
      entity.images?.[0]?.url ||
      entity.visualIdentity?.image?.[0]?.url ||
      entity.cover?.sources?.[0]?.url ||
      '';

    // Las pistas pueden venir en distintas formas según la versión del embed
    const rawItems = entity.tracks?.items || entity.content?.items || entity.items || [];

    const tracks: TrackInfo[] = [];
    for (const item of rawItems) {
      const t = item.track || item;
      if (!t) continue;
      const artists =
        t.artists?.map((a: { name: string }) => a.name).join(', ') || t.artist || 'Unknown Artist';
      tracks.push({
        title: t.name || t.title || 'Unknown Track',
        artist: artists,
        album: t.album?.name || t.album || '',
        coverUrl: t.album?.images?.[0]?.url || coverUrl,
        durationMs: t.duration_ms || t.duration || 0,
      });
    }

    return {
      id: playlistId,
      name,
      coverUrl,
      totalTracks: tracks.length,
      tracks,
      owner,
    };
  } catch {
    return null;
  }
}

// Función principal para playlists: intenta API (con credenciales) y fallback embed
export async function getPlaylistInfo(playlistId: string): Promise<PlaylistInfo> {
  const fromApi = await fetchPlaylistFromApi(playlistId);
  if (fromApi) return fromApi;

  const fromEmbed = await fetchPlaylistFromEmbed(playlistId);
  if (fromEmbed) return fromEmbed;

  throw new Error('No se pudo obtener información de la playlist de Spotify.');
}
