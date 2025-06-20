/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConflictMarker } from './ConflictMarker';
export type ConflictedFile = {
    /**
     * Path to the conflicted file
     */
    file_path?: string;
    /**
     * Type of conflict
     */
    conflict_type?: ConflictedFile.conflict_type;
    /**
     * Our version of the file content
     */
    our_version?: string | null;
    /**
     * Their version of the file content
     */
    their_version?: string | null;
    /**
     * Base version of the file content
     */
    base_version?: string | null;
    markers?: Array<ConflictMarker>;
};
export namespace ConflictedFile {
    /**
     * Type of conflict
     */
    export enum conflict_type {
        BOTH_MODIFIED = 'both_modified',
        BOTH_ADDED = 'both_added',
        DELETED_BY_US = 'deleted_by_us',
        DELETED_BY_THEM = 'deleted_by_them',
        UNKNOWN = 'unknown',
    }
}

