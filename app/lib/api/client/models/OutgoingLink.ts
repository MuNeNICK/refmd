/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type OutgoingLink = {
    document_id?: string;
    title?: string;
    document_type?: OutgoingLink.document_type;
    file_path?: string | null;
    link_type?: OutgoingLink.link_type;
    link_text?: string | null;
    position_start?: number | null;
    position_end?: number | null;
};
export namespace OutgoingLink {
    export enum document_type {
        DOCUMENT = 'document',
        SCRAP = 'scrap',
        FOLDER = 'folder',
    }
    export enum link_type {
        REFERENCE = 'reference',
        EMBED = 'embed',
        MENTION = 'mention',
    }
}

