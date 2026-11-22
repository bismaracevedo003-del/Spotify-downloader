# Spotify Downloader

[![CI](https://github.com/bismaracevedo003-del/Spotify-downloader/actions/workflows/ci.yml/badge.svg)](https://github.com/bismaracevedo003-del/Spotify-downloader/actions/workflows/ci.yml)

Next.js application that resolves Spotify track metadata and produces an MP3 with embedded ID3v2 tags: title, artist, album, front cover and lyrics.

> **Scope:** This project does not remove DRM and does not fetch audio from Spotify. It reads public track metadata from Spotify, searches for audio with `yt-dlp`, converts it with `ffmpeg`, and writes the resulting tags with `node-id3`. Use it only with content you are allowed to store or process, and review the terms of every source service involved.

## Stack

| Layer     | Technology                                           |
| --------- | ---------------------------------------------------- |
| Framework | Next.js 16, React 19, TypeScript                     |
| Metadata  | Spotify public embed, optional Spotify Web API       |
| Audio     | `yt-dlp-exec`, `ffmpeg`                              |
| Tagging   | `node-id3` (APIC, USLT, text frames)                 |
| Tooling   | ESLint, Prettier, Husky, lint-staged, GitHub Actions |

## Flow

1. `POST /api/preview` extracts the track ID and resolves metadata through the Spotify embed; if that fails, it falls back to the official API when credentials are present.
2. `POST /api/lyrics` returns lyrics from the shared helper, including its configured fallback sources.
3. `POST /api/download` searches for audio using the resolved title and artist, converts it to MP3, embeds the cover and lyrics, and streams the file to the browser.

## Requirements

- Node.js 20 or newer
- `ffmpeg` available on `PATH`
- Windows: `winget install Gyan.FFmpeg`
- macOS: `brew install ffmpeg`
- Debian/Ubuntu: `sudo apt install ffmpeg`

`yt-dlp` is installed as a project dependency through `yt-dlp-exec`.

## Local setup

```bash
git clone https://github.com/bismaracevedo003-del/Spotify-downloader.git
cd Spotify-downloader
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Spotify credentials are optional. Without them the app uses the public embed metadata endpoint. With them, the Web API is used as a fallback.

## Environment variables

| Variable                | Required | Description                          |
| ----------------------- | -------- | ------------------------------------ |
| `SPOTIFY_CLIENT_ID`     | No       | Spotify Developer application ID     |
| `SPOTIFY_CLIENT_SECRET` | No       | Spotify Developer application secret |
| `NEXT_PUBLIC_APP_NAME`  | No       | Display name used by the UI          |
| `NEXT_PUBLIC_APP_URL`   | No       | Public base URL of the application   |

## Scripts

| Command                | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `npm run dev`          | Start the development server            |
| `npm run build`        | Create a production build               |
| `npm run start`        | Serve the production build              |
| `npm run lint`         | Run ESLint                              |
| `npm run lint:fix`     | Fix auto-fixable lint issues            |
| `npm run format`       | Format files with Prettier              |
| `npm run format:check` | Verify formatting                       |
| `npm run typecheck`    | Generate route types and run TypeScript |

## API

| Method | Endpoint        | Payload                                 | Result         |
| ------ | --------------- | --------------------------------------- | -------------- |
| `POST` | `/api/preview`  | `{ "url": "spotify track URL or URI" }` | Track metadata |
| `POST` | `/api/lyrics`   | `{ "artist": "...", "title": "..." }`   | Lyrics text    |
| `POST` | `/api/download` | `{ "url": "spotify track URL or URI" }` | MP3 file       |

Invalid or unsupported track links return `400`. Upstream failures return `500` with an error message.

## Deployment

The current implementation is intended for local or controlled environments. A serverless deployment must provide `yt-dlp` and `ffmpeg` binaries inside the runtime, and the embed-based metadata source can change without notice. Validate those constraints before deploying.

## Repository layout

```text
src/
├── app/
│   ├── api/
│   │   ├── cover/route.ts
│   │   ├── download/route.ts
│   │   ├── lyrics/route.ts
│   │   ├── preview/route.ts
│   │   └── spotify.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
└── lib/
    └── lyrics.ts
```

## Known limitations

- The Spotify embed structure is not a stable public API.
- Audio availability depends on third-party search results.
- Serverless runtimes need bundled media binaries.
- The local ffmpeg lookup currently targets the Windows winget installation; other systems rely on `ffmpeg` being on `PATH`.

## Commits

This repository uses Conventional Commits: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.

## License

[MIT](LICENSE)
