/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ConflictInfo } from '../models/ConflictInfo';
import type { CreateGitConfigRequest } from '../models/CreateGitConfigRequest';
import type { DiffResult } from '../models/DiffResult';
import type { GitCommit } from '../models/GitCommit';
import type { GitConfigResponse } from '../models/GitConfigResponse';
import type { GitStatus } from '../models/GitStatus';
import type { GitSyncLogResponse } from '../models/GitSyncLogResponse';
import type { GitSyncResponse } from '../models/GitSyncResponse';
import type { MergeResolution } from '../models/MergeResolution';
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
    /**
     * Get commit history
     * @param limit Maximum number of commits to return
     * @returns GitCommit Commit history retrieved successfully
     * @throws ApiError
     */
    public getCommitHistory(
        limit: number = 50,
    ): CancelablePromise<Array<GitCommit>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/commits',
            query: {
                'limit': limit,
            },
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get file commit history
     * @param filePath Path to the file relative to the repository root
     * @param limit Maximum number of commits to return
     * @returns GitCommit File commit history retrieved successfully
     * @throws ApiError
     */
    public getFileCommitHistory(
        filePath: string,
        limit: number = 50,
    ): CancelablePromise<Array<GitCommit>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/commits/file/{file_path}',
            path: {
                'file_path': filePath,
            },
            query: {
                'limit': limit,
            },
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get file diff
     * Get uncommitted changes for a specific file
     * @param filePath Path to the file relative to the repository root
     * @returns DiffResult File diff retrieved successfully
     * @throws ApiError
     */
    public getFileDiff(
        filePath: string,
    ): CancelablePromise<DiffResult> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/diff/files/{file_path}',
            path: {
                'file_path': filePath,
            },
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
                404: `Not found`,
            },
        });
    }
    /**
     * Get commit diff
     * Get diff between two commits
     * @param from From commit hash
     * @param to To commit hash
     * @returns DiffResult Commit diff retrieved successfully
     * @throws ApiError
     */
    public getCommitDiff(
        from: string,
        to: string,
    ): CancelablePromise<Array<DiffResult>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/diff/commits/{from}/{to}',
            path: {
                'from': from,
                'to': to,
            },
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get file diff between commits
     * Get diff for a specific file between two commits
     * @param from From commit hash
     * @param to To commit hash
     * @param filePath Path to the file relative to the repository root
     * @returns DiffResult File commit diff retrieved successfully
     * @throws ApiError
     */
    public getFileCommitDiff(
        from: string,
        to: string,
        filePath: string,
    ): CancelablePromise<DiffResult> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/diff/commits/{from}/{to}/file/{file_path}',
            path: {
                'from': from,
                'to': to,
                'file_path': filePath,
            },
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get staged diff
     * Get diff of staged changes
     * @returns DiffResult Staged diff retrieved successfully
     * @throws ApiError
     */
    public getStagedDiff(): CancelablePromise<Array<DiffResult>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/diff/staged',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get working directory diff
     * Get diff of working directory changes
     * @returns DiffResult Working directory diff retrieved successfully
     * @throws ApiError
     */
    public getWorkingDiff(): CancelablePromise<Array<DiffResult>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/diff/working',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Pull from remote
     * Pull changes from remote repository
     * @returns any Pull completed
     * @throws ApiError
     */
    public pullFromRemote(): CancelablePromise<{
        success?: boolean;
        message?: string;
        has_conflicts?: boolean;
        conflicts?: ConflictInfo;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/pull',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get conflicts
     * Get current merge conflicts
     * @returns ConflictInfo Conflicts retrieved successfully
     * @throws ApiError
     */
    public getConflicts(): CancelablePromise<ConflictInfo> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/conflicts',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Resolve conflict
     * Resolve a merge conflict for a specific file
     * @param requestBody
     * @returns any Conflict resolved successfully
     * @throws ApiError
     */
    public resolveConflict(
        requestBody: MergeResolution,
    ): CancelablePromise<{
        success?: boolean;
        message?: string;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/conflicts/resolve',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Abort merge
     * Abort the current merge operation
     * @returns any Merge aborted successfully
     * @throws ApiError
     */
    public abortMerge(): CancelablePromise<{
        success?: boolean;
        message?: string;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/conflicts/abort',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Create default gitignore
     * Create a default .gitignore file
     * @returns any Gitignore created successfully
     * @throws ApiError
     */
    public createGitignore(): CancelablePromise<{
        success?: boolean;
        message?: string;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/gitignore',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get gitignore patterns
     * Get current .gitignore patterns
     * @returns any Patterns retrieved successfully
     * @throws ApiError
     */
    public getGitignorePatterns(): CancelablePromise<{
        patterns?: Array<string>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/git/gitignore/patterns',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Add gitignore patterns
     * Add patterns to .gitignore
     * @param requestBody
     * @returns any Patterns added successfully
     * @throws ApiError
     */
    public addGitignorePatterns(
        requestBody: {
            patterns: Array<string>;
        },
    ): CancelablePromise<{
        success?: boolean;
        message?: string;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/gitignore/patterns',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Check if path is ignored
     * Check if a path is ignored by .gitignore
     * @param requestBody
     * @returns any Check completed successfully
     * @throws ApiError
     */
    public checkPathIgnored(
        requestBody: {
            path: string;
        },
    ): CancelablePromise<{
        path?: string;
        is_ignored?: boolean;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/git/gitignore/check',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
}
