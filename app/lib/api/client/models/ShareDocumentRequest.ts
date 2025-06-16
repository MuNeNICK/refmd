/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ShareDocumentRequest = {
    permission: ShareDocumentRequest.permission;
    expires_at?: string | null;
};
export namespace ShareDocumentRequest {
    export enum permission {
        VIEW = 'view',
        EDIT = 'edit',
    }
}

