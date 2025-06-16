/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Share = {
    id?: string;
    document_id?: string;
    token?: string;
    permission?: Share.permission;
    created_by?: string;
    expires_at?: string | null;
    created_at?: string;
};
export namespace Share {
    export enum permission {
        VIEW = 'view',
        EDIT = 'edit',
    }
}

