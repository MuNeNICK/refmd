/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateDocumentRequest = {
    title: string;
    content?: string;
    type?: CreateDocumentRequest.type;
    parent_id?: string | null;
};
export namespace CreateDocumentRequest {
    export enum type {
        DOCUMENT = 'document',
        FOLDER = 'folder',
        SCRAP = 'scrap',
    }
}

