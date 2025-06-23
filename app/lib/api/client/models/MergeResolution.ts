/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type MergeResolution = {
    /**
     * Path to the file to resolve
     */
    file_path: string;
    /**
     * How to resolve the conflict
     */
    resolution_type: MergeResolution.resolution_type;
    /**
     * Manual resolution content (required if resolution_type is manual)
     */
    resolved_content?: string | null;
};
export namespace MergeResolution {
    /**
     * How to resolve the conflict
     */
    export enum resolution_type {
        USE_OURS = 'use_ours',
        USE_THEIRS = 'use_theirs',
        MANUAL = 'manual',
        DELETE = 'delete',
    }
}

