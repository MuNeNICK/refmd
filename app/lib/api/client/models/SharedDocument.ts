/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SharedDocument = {
    id?: string;
    title?: string;
    content?: string;
    permission?: SharedDocument.permission;
};
export namespace SharedDocument {
    export enum permission {
        VIEW = 'view',
        EDIT = 'edit',
    }
}

