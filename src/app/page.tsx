'use client';

import { useState } from 'react';

interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  durationMs: number;
}

interface PlaylistMetadata {
  id: string;
  name: string;
  description?: string;
  owner: string;
  coverUrl: string;
  totalTracks: number;
  tracks: TrackMetadata[];
}

// Pistas de ejemplo predefinidas
const EXAMPLE_TRACKS = [
  { uri: 'spotify:track:5ITV0zqzjOYfFWpW0xBmRa', label: 'Show Me Love – WizTheMc' },
  { uri: 'spotify:track:367Cb3sFU9yiHJ9T3vciHk', label: 'Esta Vida – Jorge Celedón' },
  { uri: 'spotify:track:4OjJAGDDZTLlTNeOMBl7UM', label: 'Volare – Gipsy Kings' },
  { uri: 'spotify:track:2zTIoTRV6fIB39WKg2kxVF', label: 'Ella – Rata Blanca' },
  { uri: 'spotify:track:1Ufko1bwIbsNhGvNDDKFTG', label: 'Como Abeja al Panal – Juan Luis Guerra' },
];

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPlaylist, setDownloadingPlaylist] = useState(false);
  const [fetchingLyrics, setFetchingLyrics] = useState(false);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<TrackMetadata | null>(null);
  const [playlist, setPlaylist] = useState<PlaylistMetadata | null>(null);
  const [progress, setProgress] = useState('');

  // Paso 1: Vista previa de la pista
  const handlePreview = async (e?: React.FormEvent, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = overrideUrl || url;
    if (!targetUrl) return;

    setPreviewing(true);
    setError(null);
    setTrack(null);
    setLyrics(null);
    setLyricsOpen(false);

    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'No se pudo obtener la información');
      }

      const data = await response.json();

      if (data.type === 'playlist' && data.playlist) {
        setPlaylist(data.playlist);
        setTrack(null);
      } else if (data.type === 'track' && data.metadata) {
        setTrack({ id: data.id, ...data.metadata });
        setPlaylist(null);
      } else {
        setTrack(data as TrackMetadata);
        setPlaylist(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setPreviewing(false);
    }
  };

  // Seleccionar una pista de ejemplo
  const handleSelectExample = (uri: string) => {
    setUrl(uri);
    setTrack(null);
    setPlaylist(null);
    setError(null);
    handlePreview(undefined, uri);
  };

  // Paso 2: Descargar MP3
  const handleDownload = async () => {
    setDownloading(true);
    setLoading(true);
    setError(null);
    setProgress('Buscando audio y convirtiendo...');

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fallo en la descarga');
      }

      setProgress('Preparando archivo MP3...');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      const disposition = response.headers.get('content-disposition');
      let filename = `${track?.artist || 'audio'} - ${track?.title || 'cancion'}.mp3`;
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename="')[1]?.split('"')[0] || filename;
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setProgress('¡Audio MP3 descargado!');
      setTimeout(() => setProgress(''), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      setProgress('');
    } finally {
      setDownloading(false);
      setLoading(false);
    }
  };

  // Paso 2: Descargar playlist completa (ZIP con todos los MP3)
  const handleDownloadPlaylist = async () => {
    if (!playlist) return;
    setDownloadingPlaylist(true);
    setLoading(true);
    setError(null);
    setProgress('Descargando playlist completa...');

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `spotify:playlist:${playlist.id}`, type: 'playlist' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fallo al descargar la playlist');
      }

      setProgress('Preparando archivo ZIP...');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      const disposition = response.headers.get('content-disposition');
      let filename = `${safeFilename(playlist.owner, playlist.name)}.zip`;
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename="')[1]?.split('"')[0] || filename;
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setProgress(`¡Playlist "${playlist.name}" descargada!`);
      setTimeout(() => setProgress(''), 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
      setProgress('');
    } finally {
      setDownloadingPlaylist(false);
      setLoading(false);
    }
  };

  // Sanitizar nombre de archivo (compartido con handleDownloadLyricsFile)
  function safeFilename(artist: string, title: string): string {
    return `${artist} - ${title}`.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_\-\. ]/g, '');
  }

  // Obtener y ver / descargar Letra
  const handleGetLyrics = async () => {
    if (!track) return;
    if (lyrics) {
      setLyricsOpen(!lyricsOpen);
      return;
    }

    setFetchingLyrics(true);
    setError(null);
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist: track.artist, title: track.title }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se encontró la letra de esta canción.');
      }

      setLyrics(data.lyrics);
      setLyricsOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al buscar la letra';
      setError(msg);
    } finally {
      setFetchingLyrics(false);
    }
  };

  // Guardar letra como archivo .txt
  const handleDownloadLyricsFile = () => {
    if (!lyrics || !track) return;
    const safeTitle = `${track.artist} - ${track.title} Letra.txt`.replace(
      /[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_\-\. ]/g,
      ''
    );
    const blob = new Blob([`${track.artist} - ${track.title}\n\n${lyrics}`], {
      type: 'text/plain;charset=utf-8',
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = safeTitle;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  const handleReset = () => {
    setUrl('');
    setTrack(null);
    setPlaylist(null);
    setLyrics(null);
    setLyricsOpen(false);
    setError(null);
    setProgress('');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
            <svg className="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Spotify Downloader</h1>
          <p className="text-gray-400 text-sm">
            Descarga la música en MP3 con carátula y letra embebidas
          </p>
        </div>

        {/* Card principal */}
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-2xl">
          {/* Input + Search */}
          <form onSubmit={handlePreview} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                required
                placeholder="https://open.spotify.com/track/... o spotify:track:..."
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (track) setTrack(null);
                  if (error) setError(null);
                }}
                disabled={loading || downloading}
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={previewing || loading || downloading || !url}
                className="px-5 py-3 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-xl text-sm transition-all flex items-center gap-2"
              >
                {previewing ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                )}
                Buscar
              </button>
            </div>
          </form>

          {/* Pistas de ejemplo */}
          {!track && !playlist && !loading && (
            <div className="mb-4">
              <p className="text-gray-500 text-xs mb-2 uppercase tracking-wider font-medium">
                Pistas rápidas
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_TRACKS.map((t) => (
                  <button
                    key={t.uri}
                    onClick={() => handleSelectExample(t.uri)}
                    disabled={previewing}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 hover:border-green-500/50 rounded-lg text-gray-300 text-xs transition-all"
                  >
                    🎵 {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Track Preview Card */}
          {track && (
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 mb-4">
              <div className="flex gap-4 items-start">
                {/* Cover Art */}
                {track.coverUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={track.coverUrl}
                      alt={`${track.title} cover`}
                      className="w-24 h-24 rounded-lg object-cover shadow-lg border border-gray-700"
                    />
                  </div>
                )}
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-base truncate">{track.title}</h3>
                  <p className="text-gray-400 text-sm truncate">{track.artist}</p>
                  {track.album && (
                    <p className="text-gray-500 text-xs truncate mt-0.5">{track.album}</p>
                  )}
                  {track.durationMs > 0 && (
                    <p className="text-gray-500 text-xs mt-1">
                      ⏱ {formatDuration(track.durationMs)}
                    </p>
                  )}
                </div>
              </div>

              {/* Botón principal: Descargar MP3 */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full mt-4 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/30"
              >
                {downloading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span>{progress || 'Procesando...'}</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Descargar MP3 con carátula y letra
                  </>
                )}
              </button>

              {/* Botón secundario: Letra */}
              <button
                onClick={handleGetLyrics}
                disabled={fetchingLyrics}
                className="w-full px-3 py-2 bg-gray-700/60 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-medium rounded-lg border border-gray-600 flex items-center justify-center gap-1.5 transition-colors"
              >
                {fetchingLyrics ? (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                )}
                {lyricsOpen ? 'Ocultar Letra' : 'Ver / Bajar Letra'}
              </button>

              {/* Panel de Letras expandible */}
              {lyricsOpen && lyrics && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                      Letra de la canción
                    </span>
                    <button
                      onClick={handleDownloadLyricsFile}
                      className="text-xs text-green-400 hover:text-green-300 font-medium flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded border border-green-500/20 transition-colors"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Descargar .txt
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-3 bg-gray-900/90 rounded-lg text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-sans border border-gray-800">
                    {lyrics}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Playlist Preview Card */}
          {playlist && (
            <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 mb-4">
              <div className="flex gap-4 items-start mb-4">
                {/* Playlist Cover */}
                {playlist.coverUrl && (
                  <div className="flex-shrink-0">
                    <img
                      src={playlist.coverUrl}
                      alt={`${playlist.name} cover`}
                      className="w-24 h-24 rounded-lg object-cover shadow-lg border border-gray-700"
                    />
                  </div>
                )}
                {/* Playlist Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-base truncate">{playlist.name}</h3>
                  <p className="text-gray-400 text-sm truncate">por {playlist.owner}</p>
                  {playlist.description && (
                    <p className="text-gray-500 text-xs truncate mt-0.5">{playlist.description}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">🎵 {playlist.totalTracks} pistas</p>
                </div>
              </div>

              {/* Botón principal: Descargar playlist completa (ZIP) */}
              <button
                onClick={handleDownloadPlaylist}
                disabled={downloadingPlaylist}
                className="w-full mt-2 mb-4 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-900/30"
              >
                {downloadingPlaylist ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span>{progress || 'Procesando playlist...'}</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Descargar playlist completa (ZIP)
                  </>
                )}
              </button>

              {/* Lista de pistas individuales */}
              <div className="max-h-96 overflow-y-auto border border-gray-700 rounded-lg bg-gray-900/50">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-3 py-2 border-b border-gray-700">
                  Pistas individuales
                </p>
                <div className="py-1">
                  {playlist.tracks.map((t, idx) => (
                    <div
                      key={t.id}
                      className="flex gap-3 items-center px-3 py-2 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 last:border-0"
                    >
                      <span className="text-gray-500 text-xs w-4 text-center">{idx + 1}.</span>
                      {t.coverUrl && (
                        <img
                          src={t.coverUrl}
                          alt={t.title}
                          className="w-10 h-10 rounded object-cover border border-gray-700 flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-200 text-sm truncate">{t.title}</p>
                        <p className="text-gray-500 text-xs truncate">{t.artist}</p>
                        {t.durationMs > 0 && (
                          <p className="text-gray-600 text-xs">{formatDuration(t.durationMs)}</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setUrl(`spotify:track:${t.id}`);
                          handlePreview(undefined, `spotify:track:${t.id}`);
                        }}
                        className="text-xs text-gray-500 hover:text-green-400 transition-colors"
                        title="Vista previa de esta pista"
                      >
                        🔍
                      </button>
                      <button
                        onClick={async () => {
                          setDownloading(true);
                          setLoading(true);
                          setError(null);
                          setProgress(`Descargando ${t.title}...`);
                          try {
                            const response = await fetch('/api/download', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ url: `spotify:track:${t.id}`, type: 'track' }),
                            });
                            if (!response.ok) {
                              const data = await response.json();
                              throw new Error(data.error || 'Fallo en la descarga');
                            }
                            const blob = await response.blob();
                            const downloadUrl = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = downloadUrl;
                            const disposition = response.headers.get('content-disposition');
                            let filename = `${safeFilename(t.artist, t.title)}.mp3`;
                            if (disposition && disposition.includes('filename=')) {
                              filename =
                                disposition.split('filename="')[1]?.split('"')[0] || filename;
                            }
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(downloadUrl);
                            setProgress(`¡${t.title} descargado!`);
                            setTimeout(() => setProgress(''), 3000);
                          } catch (err: unknown) {
                            const message =
                              err instanceof Error ? err.message : 'Error desconocido';
                            setError(message);
                            setProgress('');
                          } finally {
                            setDownloading(false);
                            setLoading(false);
                          }
                        }}
                        disabled={downloading}
                        className="text-xs text-green-400 hover:text-green-300 transition-colors flex-shrink-0"
                        title="Descargar este MP3"
                      >
                        ⬇
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Progress / Success message */}
          {progress && !downloading && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 mb-4">
              <svg
                className="w-4 h-4 text-green-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-400 text-sm">{progress}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
              <svg
                className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Reset Button */}
          {(track || error) && !downloading && (
            <button
              onClick={handleReset}
              className="w-full text-center text-gray-500 hover:text-gray-300 text-xs transition-colors py-2"
            >
              Buscar otra canción
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-gray-600 text-xs">
            Descarga directa de audio en MP3 con carátula y letra embebidas
          </p>
        </div>
      </div>
    </main>
  );
}
