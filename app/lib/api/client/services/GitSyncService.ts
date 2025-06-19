/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateGitConfigRequest } from '../models/CreateGitConfigRequest';
import type { GitConfigResponse } from '../models/GitConfigResponse';
import type { GitStatus } from '../models/GitStatus';
import type { GitSyncLogResponse } from '../models/GitSyncLogResponse';
import type { GitSyncResponse } from '../models/GitSyncResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class GitSyncService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create or update Git configuration
     * @param requestBody
     * @returns GitConfigResponse Git configuration created or updated successfully
     * @throws ApiError
     */
    public createOrUpdateGitConfig(
        requestBody: CreateGitConfigRequest,
    ): CancelablePromise<GitConfigResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/config',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get Git configuration
     * @returns GitConfigResponse Git configuration retrieved successfully
     * @throws ApiError
     */
    public getGitConfig(): CancelablePromise<GitConfigResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/config',
            errors: {
                401: `Unauthorized`,
                404: `Not found`,
            },
        });
    }
    /**
     * Delete Git configuration
     * @returns void
     * @throws ApiError
     */
    public deleteGitConfig(): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/git/config',
            errors: {
                401: `Unauthorized`,
                404: `Not found`,
            },
        });
    }
    /**
     * Initialize Git repository
     * @returns any Repository initialized successfully
     * @throws ApiError
     */
    public initGitRepository(): CancelablePromise<{
        success?: boolean;
        message?: string;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/init',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Manual sync
     * @returns GitSyncResponse Sync completed successfully
     * @throws ApiError
     */
    public manualGitSync(): CancelablePromise<GitSyncResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/sync',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get Git status
     * @returns GitStatus Git status retrieved successfully
     * @throws ApiError
     */
    public getGitStatus(): CancelablePromise<GitStatus> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/status',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get sync logs
     * @returns GitSyncLogResponse Sync logs retrieved successfully
     * @throws ApiError
     */
    public getGitSyncLogs(): CancelablePromise<Array<GitSyncLogResponse>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/logs',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
}
