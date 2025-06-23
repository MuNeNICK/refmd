/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DiffLine } from './DiffLine';
export type DiffResult = {
    /**
     * Path to the file being diffed
     */
    file_path?: string;
    diff_lines?: Array<DiffLine>;
    /**
     * Original file content (optional)
     */
    old_content?: string | null;
    /**
     * New file content (optional)
     */
    new_content?: string | null;
};

