export interface FormatOption {
    id: string;
    ext: string;
    resolution: string;
    height: number;
    filesize: number;
    vcodec: string;
    acodec: string;
    note: string;
    type: 'video+audio' | 'video-only' | 'audio-only';
}
export interface PlaylistEntry {
    id: string;
    title: string;
    duration: number;
    index: number;
    url: string;
}
export interface VideoInfo {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    duration: number;
    webpageUrl: string;
    uploader: string;
    isPlaylist: boolean;
    playlistTitle?: string;
    entries: PlaylistEntry[];
    formats: FormatOption[];
    site: 'bilibili' | 'youtube' | 'unknown';
}
export type TaskStatus = 'pending' | 'downloading' | 'completed' | 'failed';
export interface DownloadProgress {
    taskId: string;
    status: TaskStatus;
    percent: number;
    speed: string;
    eta: string;
    downloaded: string;
    totalSize: string;
}
export interface DownloadTask {
    id: string;
    url: string;
    title: string;
    formatId: string;
    formatNote: string;
    status: TaskStatus;
    progress: DownloadProgress | null;
    outputPath: string;
    filename?: string;
    error?: string;
    createdAt: number;
}
export interface ParseRequest {
    url: string;
}
export interface ParseResponse {
    video: VideoInfo;
}
export interface DownloadRequest {
    url: string;
    formatId: string;
    playlistItems?: number[];
}
export interface DownloadResponse {
    taskId: string;
}
export type WsMessage = {
    type: 'progress';
    data: DownloadProgress;
} | {
    type: 'complete';
    data: {
        taskId: string;
        filePath: string;
        filename: string;
    };
} | {
    type: 'error';
    data: {
        taskId: string;
        error: string;
    };
};
