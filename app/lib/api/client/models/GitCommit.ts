export interface DiffStats {
    files_changed: number;
    insertions: number;
    deletions: number;
}

export interface GitCommit {
    id: string;
    message: string;
    author_name: string;
    author_email: string;
    timestamp: string;
    diff_stats?: DiffStats;
}