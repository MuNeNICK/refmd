/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type BacklinkInfo = {
    document_id?: string;
    title?: string;
    file_path?: string | null;
    link_type?: BacklinkInfo.link_type;
    link_text?: string | null;
    link_count?: number;
};
export namespace BacklinkInfo {
    export enum link_type {
        REFERENCE = 'reference',
        EMBED = 'embed',
        MENTION = 'mention',
    }
}

