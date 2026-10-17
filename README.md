# Spotify Downloader

Descargador de música de Spotify que obtiene el audio, la carátula y la letra de una canción, y los embebe todo dentro de un solo archivo **MP3** con metadatos ID3v2 (título, artista, álbum, portada APIC y letra USLT).

> ⚠️ **Uso responsable:** Esta herramienta es para uso personal y educativo. Respeta los derechos de autor y los términos de servicio de Spotify y de las plataformas de origen del audio.

## ✨ Características

- 🎵 Descarga audio de Spotify en formato MP3 (calidad máxima V0)
- 🖼️ Carátula del álbum embebida dentro del MP3 (frame APIC)
- 📝 Letra de la canción embebida dentro del MP3 (frame USLT)
- 🏷️ Metadatos ID3v2: título, artista, álbum
- 🔍 Vista previa de la pista antes de descargar
- 📖 Búsqueda y visualización de letras (con fallback a subtítulos de YouTube)
- 🚀 Construido con Next.js 16, React 19, yt-dlp, ffmpeg y node-id3

## 📋 Requisitos previos

- [Node.js](https://nodejs.org/) 18 o superior
- [ffmpeg](https://ffmpeg.org/download.html) (requerido por yt-dlp para convertir a MP3)
  - Windows (winget): `winget install Gyan.FFmpeg`
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg`

## 🚀 Instalación y uso local

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/spotify-downloader.git
cd spotify-downloader

# Instalar dependencias
npm install

# Configurar variables de entorno (opcional, para API oficial de Spotify)
cp .env.example .env.local
# Editar .env.local con tus credenciales de Spotify Developer

# Iniciar en modo desarrollo
npm run dev

# Abrir en el navegador
# http://localhost:3000
```

## 📜 Scripts disponibles

| Script          | Descripción                                    |
| --------------- | ---------------------------------------------- |
| `npm run dev`   | Inicia el servidor de desarrollo con Turbopack |
| `npm run build` | Construye la aplicación para producción        |
| `npm run start` | Inicia el servidor de producción               |
| `npm run lint`  | Ejecuta ESLint sobre el proyecto               |

## 🔐 Variables de entorno

Copia `.env.example` a `.env.local` y completa:

| Variable                | Descripción                                  | Obligatorio |
| ----------------------- | -------------------------------------------- | ----------- |
| `SPOTIFY_CLIENT_ID`     | Client ID de Spotify Developer Dashboard     | No*         |
| `SPOTIFY_CLIENT_SECRET` | Client Secret de Spotify Developer Dashboard | No*         |

\* No son obligatorios porque la app usa primero el Web Embed de Spotify (público, sin token). Si se proveen, se usa la API oficial como respaldo.

## 🏗️ Estructura del proyecto

```
spotify-downloader/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── download/route.ts   # Descarga MP3 con carátula y letra embebidas
│   │   │   ├── cover/route.ts      # Descarga de carátula (legacy)
│   │   │   ├── lyrics/route.ts     # Búsqueda de letras
│   │   │   ├── preview/route.ts    # Vista previa de pista
│   │   │   └── spotify.ts          # Metadatos de Spotify (Embed + API)
│   │   ├── page.tsx                # Página principal (cliente)
│   │   ├── layout.tsx
│   │   └── globals.css
│   └── lib/
│       └── lyrics.ts               # Helper compartido de letras
├── public/
├── .github/
│   └── workflows/
│       └── ci.yml                  # Integración continua
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## 📦 Despliegue

### Vercel (recomendado)

1. Sube el código a GitHub.
2. Importa el repositorio en [Vercel](https://vercel.com).
3. Agrega las variables de entorno (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`) si las usas.
4. Despliega.

> Nota: ffmpeg y yt-dlp necesitan estar disponibles en el entorno de despliegue. En Vercel funciones serverless puede requerir capas personalizadas o binarios empaquetados.

## 🧪 Flujo de trabajo Git (Conventional Commits)

Este proyecto sigue [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     nueva funcionalidad
fix:      corrección de error
docs:     cambios en documentación
chore:    tareas de mantenimiento
refactor: refactorización sin cambios de comportamiento
```

Ejemplo de commit:

```bash
git commit -m "feat: embebe carátula y letra en el MP3 con node-id3"
```

## 📄 Licencia

MIT
