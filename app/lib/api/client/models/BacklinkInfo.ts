/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type BacklinkInfo = {
    document_id?: string;
    title?: string;
    document_type?: BacklinkInfo.document_type;
    file_path?: string | null;
    link_type?: BacklinkInfo.link_type;
    link_text?: string | null;
    link_count?: number;
};
export namespace BacklinkInfo {
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

