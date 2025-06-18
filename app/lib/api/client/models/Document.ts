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
};
export namespace Document {
    export enum type {
        DOCUMENT = 'document',
        FOLDER = 'folder',
        SCRAP = 'scrap',
    }
}

