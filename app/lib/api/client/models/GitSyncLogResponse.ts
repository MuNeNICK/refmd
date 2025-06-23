/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GitSyncLogResponse = {
    id?: string;
    user_id?: string;
    operation?: GitSyncLogResponse.operation;
    status?: GitSyncLogResponse.status;
    message?: string | null;
    commit_hash?: string | null;
    created_at?: string;
};
export namespace GitSyncLogResponse {
    export enum operation {
        INIT = 'init',
        COMMIT = 'commit',
        PUSH = 'push',
        PULL = 'pull',
    }
    export enum status {
        SUCCESS = 'success',
        ERROR = 'error',
    }
}

