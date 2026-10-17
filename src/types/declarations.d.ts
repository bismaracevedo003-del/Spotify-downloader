declare module 'archiver' {
  export interface Archiver {
    pipe(dest: NodeJS.WritableStream): Archiver;
    file(filepath: string, data?: { name?: string }): Archiver;
    finalize(): void;
    on(event: string, listener: (...args: unknown[]) => void): Archiver;
  }

  export function archiver(format: string, options?: Record<string, unknown>): Archiver;
  export default archiver;
}

declare module 'yt-dlp-exec' {
  interface YtDlpExecOptions {
    extractAudio?: boolean;
    audioFormat?: string;
    audioQuality?: string;
    output?: string;
    noPlaylist?: boolean;
    ffmpegLocation?: string;
    dumpJson?: boolean;
    [key: string]: unknown;
  }

  export interface YtDlpSubtitle {
    url: string;
    ext: string;
  }

  export interface YtDlpVideoInfo {
    subtitles?: Record<string, YtDlpSubtitle[]>;
    automatic_captions?: Record<string, YtDlpSubtitle[]>;
    [key: string]: unknown;
  }

  export default function ytDlpExec(
    input: string,
    options?: YtDlpExecOptions
  ): Promise<YtDlpVideoInfo>;
}
