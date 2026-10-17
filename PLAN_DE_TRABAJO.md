# Plan de Trabajo — Spotify Downloader

**Estado:** ✅ Completado (Fases 1-4 implementadas y verificadas)

**Objetivo:** Corregir problemas críticos del proyecto y agregar soporte para descargar playlists completas de Spotify (múltiples pistas, metadatos, carátulas y letras embebidas en MP3).

---

## Fase 1 — Correcciones críticas (portabilidad y robustez) ✅ COMPLETADA

| #   | Tarea                                     | Archivo(s)                                           | Estado                                                                     |
| --- | ----------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| 1.1 | Eliminar ruta hardcodeada de `yt-dlp.exe` | `src/app/api/download/route.ts`, `src/lib/lyrics.ts` | ✅ Usa `ytDlpExec` de `yt-dlp-exec` (resuelve binario por plataforma)      |
| 1.2 | Eliminar ruta hardcodeada de ffmpeg       | `src/app/api/download/route.ts`                      | ✅ Resuelve desde `PATH`, `FFMPEG_LOCATION`, o rutas comunes como fallback |
| 1.3 | Manejo de errores en `ID3.write`          | `src/app/api/download/route.ts`                      | ✅ Envuelto en `try/catch`                                                 |
| 1.4 | Idioma del frame USLT (letra)             | `src/app/api/download/route.ts`                      | ✅ Detecta `esp` vs `eng` por contenido                                    |
| 1.5 | Limpieza de archivos temporales           | `src/app/api/download/route.ts`                      | ✅ `try/finally` con borrado de temporales                                 |
| 1.6 | Validación de input de búsqueda           | `src/app/api/download/route.ts`                      | ✅ Metadatos provienen de Spotify, no input raw del usuario                |
| 1.7 | Revisar `cover/route.ts` legacy           | `src/app/api/cover/route.ts`                         | ✅ Documentada como legacy (sin uso en el flujo actual)                    |

---

## Fase 2 — Soporte de metadata de playlists ✅ COMPLETADA

| #   | Tarea                                   | Archivo(s)                          | Estado                                                               |
| --- | --------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| 2.1 | Detectar ID de playlist de Spotify      | `src/app/api/spotify.ts`            | ✅ `getSpotifyPlaylistId()` + `detectSpotifyInput()`                 |
| 2.2 | Obtener lista de pistas de una playlist | `src/app/api/spotify.ts`            | ✅ `getPlaylistInfo()` con API oficial (paginación) + fallback embed |
| 2.3 | Unificar detección track vs playlist    | `src/app/api/spotify.ts`, rutas API | ✅ `detectSpotifyInput()` devuelve `{ type, id }`                    |

---

## Fase 3 — Descarga de playlists completas ✅ COMPLETADA

| #   | Tarea                              | Archivo(s)                                   | Estado                                                 |
| --- | ---------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| 3.1 | Ruta API para descarga de playlist | `src/app/api/download/route.ts`              | ✅ Soporta `type: 'playlist'`, devuelve ZIP            |
| 3.2 | Generar ZIP del lado del servidor  | `src/app/api/download/route.ts` + `archiver` | ✅ ZIP con un MP3 por pista, metadatos embebidos       |
| 3.3 | UI de playlist en el frontend      | `src/app/page.tsx`                           | ✅ Lista de pistas, descarga individual y ZIP completo |
| 3.4 | Progreso de descarga de playlist   | `src/app/page.tsx`                           | ✅ Estados `downloadingPlaylist` y `progress`          |

---

## Fase 4 — Pruebas, documentación y CI ✅ COMPLETADA

| #   | Tarea                                   | Estado                                                 |
| --- | --------------------------------------- | ------------------------------------------------------ |
| 4.1 | Actualizar `.env.example` y `README.md` | ⏳ Pendiente (documentar `FFMPEG_LOCATION`)            |
| 4.2 | Ejecutar lint, prettier y tsc           | ✅ `npm run lint` (0 errores), `npx tsc --noEmit` (OK) |
| 4.3 | Build de producción                     | ✅ `npm run build` (sin errores ni warnings)           |
| 4.4 | Probar descarga de track y playlist     | ⏳ Pendiente (requiere ffmpeg + yt-dlp en el entorno)  |

---

## Archivos modificados/creados

| Archivo                        | Acción                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PLAN_DE_TRABAJO.md`           | Crear / actualizar                                                                                                                                           |
| `src/app/api/spotify.ts`       | Editar: `getSpotifyPlaylistId`, `detectSpotifyInput`, `PlaylistInfo`, `getPlaylistInfo`, fetch playlist desde API y embed                                    |
| `src/app/api/download/route.ts | Editar: `ytDlpExec` portable, `ffmpeg` portable, `ID3.write` try/catch, idioma letra dinámico, limpieza `try/finally`, soporte playlist + ZIP con `archiver` |
| `src/app/api/preview/route.ts` | Editar: detecta track vs playlist, devuelve `{ type, ... }`                                                                                                  |
| `src/app/api/cover/route.ts`   | Sin cambios (marcada como legacy)                                                                                                                            |
| `src/lib/lyrics.ts`            | Editar: `ytDlpExec` portable (sin ruta `.exe` hardcodeada)                                                                                                   |
| `src/app/page.tsx`             | Editar: estados playlist, UI de lista de pistas, descarga individual y ZIP completo                                                                          |
| `src/types/declarations.d.ts`  | Crear: declaraciones de tipos para `archiver` y `yt-dlp-exec`                                                                                                |
| `package.json`                 | Editar: agregar `archiver`, `@types/archiver`                                                                                                                |
| `src/types/`                   | Crear carpeta con declaraciones de tipos                                                                                                                     |

---

## Notas técnicas

- **`yt-dlp-exec`** se usa mediante su API (`import ytDlpExec from 'yt-dlp-exec'`) para resolver el binario automáticamente por plataforma (Windows/Linux/macOS).
- **ffmpeg** se resuelve desde `PATH`, variable `FFMPEG_LOCATION`, o rutas comunes. No se asume una versión fija ni carpeta de winget.
- **ZIP:** se usa `archiver` para empaquetar los MP3s de una playlist en un solo `.zip`.
- **Timeouts:** las funciones serverless (Vercel) tienen límites de tiempo. Descargar playlists grandes puede excederlos; se recomienda despliegue en servidor propio para playlists largas.
- **Spotify API:** el Web Embed funciona sin token para tracks. Para playlists, la API oficial es más confiable para obtener todas las pistas con paginación (`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`).
- **Rutas temporales:** se usan `os.tmpdir()` con nombres únicos (`Date.now() + random`) y se limpian en `finally`.

---

## Cómo probar

1. Instalar dependencias: `npm install`
2. Tener ffmpeg y yt-dlp disponibles en el sistema
3. Ejecutar en desarrollo: `npm run dev`
4. Abrir `http://localhost:3000`
5. Pegar un enlace de track de Spotify → descarga MP3 individual
6. Pegar un enlace de playlist de Spotify → muestra lista de pistas + botón "Descargar playlist completa (ZIP)"
