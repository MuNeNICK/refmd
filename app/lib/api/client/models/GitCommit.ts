/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DiffStats } from './DiffStats';
export type GitCommit = {
    /**
     * Commit hash
     */
    id?: string;
    /**
     * Commit message
     */
    message?: string;
    /**
     * Author name
     */
    author_name?: string;
    /**
     * Author email
     */
    author_email?: string;
    /**
     * Commit timestamp
     */
    timestamp?: string;
    diff_stats?: DiffStats | null;
};

