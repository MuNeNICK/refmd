/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SearchResult = {
    id?: string;
    title?: string;
    document_type?: SearchResult.document_type;
    path?: string;
    updated_at?: string;
};
export namespace SearchResult {
    export enum document_type {
        DOCUMENT = 'document',
        SCRAP = 'scrap',
        FOLDER = 'folder',
    }
}

