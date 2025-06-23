/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConflictedFile } from './ConflictedFile';
export type ConflictInfo = {
    /**
     * Whether there are any conflicts
     */
    has_conflicts?: boolean;
    conflicted_files?: Array<ConflictedFile>;
    /**
     * Whether conflicts can be auto-merged
     */
    can_auto_merge?: boolean;
    /**
     * Message about the merge status
     */
    merge_message?: string | null;
};

