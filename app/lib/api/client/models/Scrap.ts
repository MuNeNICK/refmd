/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Scrap = {
    id: string;
    owner_id: string;
    title: string;
    file_path?: string | null;
    parent_id?: string | null;
    created_at: string;
    updated_at: string;
    last_edited_by?: string | null;
    last_edited_at?: string | null;
    /**
     * Scrap visibility (private, unlisted, public)
     */
    visibility?: Scrap.visibility;
    /**
     * Published date (only set when scrap is published)
     */
    published_at?: string | null;
    /**
     * Owner username (only included for published scraps)
     */
    owner_username?: string | null;
};
export namespace Scrap {
    /**
     * Scrap visibility (private, unlisted, public)
     */
    export enum visibility {
        PRIVATE = 'private',
        UNLISTED = 'unlisted',
        PUBLIC = 'public',
    }
}

