/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateScrapPostRequest } from '../models/CreateScrapPostRequest';
import type { CreateScrapRequest } from '../models/CreateScrapRequest';
import type { Scrap } from '../models/Scrap';
import type { ScrapPost } from '../models/ScrapPost';
import type { ScrapWithPosts } from '../models/ScrapWithPosts';
import type { ShareDocumentRequest } from '../models/ShareDocumentRequest';
import type { ShareResponse } from '../models/ShareResponse';
import type { UpdateScrapPostRequest } from '../models/UpdateScrapPostRequest';
import type { UpdateScrapRequest } from '../models/UpdateScrapRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ScrapsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create a new scrap
     * @param requestBody
     * @returns Scrap Scrap created successfully
     * @throws ApiError
     */
    public createScrap(
        requestBody: CreateScrapRequest,
    ): CancelablePromise<Scrap> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/scraps',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get user's scraps
     * @returns Scrap List of scraps
     * @throws ApiError
     */
    public getScraps(): CancelablePromise<Array<Scrap>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/scraps',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get scrap with posts
     * @param id
     * @param token Share token for accessing the scrap
     * @returns ScrapWithPosts Scrap with posts
     * @throws ApiError
     */
    public getScrap(
        id: string,
        token?: string,
    ): CancelablePromise<ScrapWithPosts> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/scraps/{id}',
            path: {
                'id': id,
            },
            query: {
                'token': token,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * Update scrap
     * @param id
     * @param requestBody
     * @returns Scrap Scrap updated
     * @throws ApiError
     */
    public updateScrap(
        id: string,
        requestBody: UpdateScrapRequest,
    ): CancelablePromise<Scrap> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/scraps/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * Delete scrap
     * @param id
     * @returns void
     * @throws ApiError
     */
    public deleteScrap(
        id: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/scraps/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * Create share link for scrap
     * @param id
     * @param requestBody
     * @returns any Share link created
     * @throws ApiError
     */
    public createScrapShare(
        id: string,
        requestBody: ShareDocumentRequest,
    ): CancelablePromise<{
        data?: ShareResponse;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/scraps/{id}/share',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * List share links for scrap
     * @param id
     * @returns any List of share links
     * @throws ApiError
     */
    public listScrapShares(
        id: string,
    ): CancelablePromise<{
        data?: Array<{
            id?: string;
            token?: string;
            document_id?: string;
            permission_level?: string;
            created_by?: string;
            expires_at?: string | null;
            created_at?: string;
            url?: string;
        }>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/scraps/{id}/shares',
            path: {
                'id': id,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * Delete scrap share link
     * @param token
     * @returns void
     * @throws ApiError
     */
    public deleteScrapShare(
        token: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/scraps/shares/{token}',
            path: {
                'token': token,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * Get scrap posts
     * @param id
     * @param token Share token for accessing the scrap posts
     * @returns ScrapPost List of posts
     * @throws ApiError
     */
    public getScrapPosts(
        id: string,
        token?: string,
    ): CancelablePromise<Array<ScrapPost>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/scraps/{id}/posts',
            path: {
                'id': id,
            },
            query: {
                'token': token,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * Add post to scrap
     * @param id
     * @param requestBody
     * @returns ScrapPost Post created
     * @throws ApiError
     */
    public createScrapPost(
        id: string,
        requestBody: CreateScrapPostRequest,
    ): CancelablePromise<ScrapPost> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/scraps/{id}/posts',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * Update scrap post
     * @param id
     * @param postId
     * @param requestBody
     * @returns ScrapPost Post updated
     * @throws ApiError
     */
    public updateScrapPost(
        id: string,
        postId: string,
        requestBody: UpdateScrapPostRequest,
    ): CancelablePromise<ScrapPost> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/scraps/{id}/posts/{postId}',
            path: {
                'id': id,
                'postId': postId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * Delete scrap post
     * @param id
     * @param postId
     * @returns void
     * @throws ApiError
     */
    public deleteScrapPost(
        id: string,
        postId: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/scraps/{id}/posts/{postId}',
            path: {
                'id': id,
                'postId': postId,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
}
