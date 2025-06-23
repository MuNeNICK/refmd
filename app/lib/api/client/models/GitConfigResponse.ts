/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GitConfigResponse = {
    id?: string;
    user_id?: string;
    repository_url?: string;
    branch_name?: string;
    auth_type?: GitConfigResponse.auth_type;
    auto_sync?: boolean;
    created_at?: string;
    updated_at?: string;
};
export namespace GitConfigResponse {
    export enum auth_type {
        SSH = 'ssh',
        TOKEN = 'token',
    }
}

