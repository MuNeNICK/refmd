/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateGitConfigRequest = {
    /**
     * Git repository URL
     */
    repository_url: string;
    /**
     * Branch name to sync with
     */
    branch_name?: string;
    /**
     * Authentication type
     */
    auth_type: CreateGitConfigRequest.auth_type;
    /**
     * Authentication data (SSH key path or token)
     */
    auth_data: Record<string, any>;
    /**
     * Enable automatic sync on document save
     */
    auto_sync?: boolean;
};
export namespace CreateGitConfigRequest {
    /**
     * Authentication type
     */
    export enum auth_type {
        SSH = 'ssh',
        TOKEN = 'token',
    }
}

