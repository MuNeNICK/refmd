/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Document = {
    id?: string;
    title?: string;
    /**
     * Document content (only included in certain endpoints)
     */
    content?: string;
    type?: Document.type;
    parent_id?: string | null;
    /**
     * File system path for the document
     */
    file_path?: string | null;
    owner_id?: string;
    created_at?: string;
    updated_at?: string;
    /**
     * Document visibility (private, unlisted, public)
     */
    visibility?: Document.visibility;
    /**
     * Published date (only set when document is published)
     */
    published_at?: string | null;
    /**
     * Owner name (only included for published documents)
     */
    owner_username?: string | null;
};
export namespace Document {
    export enum type {
        DOCUMENT = 'document',
        FOLDER = 'folder',
        SCRAP = 'scrap',
    }
    /**
     * Document visibility (private, unlisted, public)
     */
    export enum visibility {
        PRIVATE = 'private',
        UNLISTED = 'unlisted',
        PUBLIC = 'public',
    }
}

