/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PostsByTagResponse } from '../models/PostsByTagResponse';
import type { Tag } from '../models/Tag';
import type { TagListResponse } from '../models/TagListResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class TagsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List all tags
     * @param limit
     * @param offset
     * @returns TagListResponse Tags retrieved successfully
     * @throws ApiError
     */
    public listTags(
        limit: number = 100,
        offset?: number,
    ): CancelablePromise<TagListResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tags',
            query: {
                'limit': limit,
                'offset': offset,
            },
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get posts by tag
     * @param name
     * @returns PostsByTagResponse Posts retrieved successfully
     * @throws ApiError
     */
    public getPostsByTag(
        name: string,
    ): CancelablePromise<PostsByTagResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tags/{name}/posts',
            path: {
                'name': name,
            },
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get all tags for a scrap
     * @param id
     * @returns Tag Tags retrieved successfully
     * @throws ApiError
     */
    public getScrapTags(
        id: string,
    ): CancelablePromise<Array<Tag>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tags/scraps/{id}/tags',
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
     * Get documents by tag
     * @param name
     * @param limit
     * @param offset
     * @returns any Documents retrieved successfully
     * @throws ApiError
     */
    public getDocumentsByTag(
        name: string,
        limit: number = 100,
        offset?: number,
    ): CancelablePromise<{
        tag?: string;
        document_ids?: Array<string>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tags/{name}/documents',
            path: {
                'name': name,
            },
            query: {
                'limit': limit,
                'offset': offset,
            },
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get all content (documents and scrap posts) by tag
     * @param name
     * @param limit
     * @param offset
     * @returns any Content retrieved successfully
     * @throws ApiError
     */
    public getAllByTag(
        name: string,
        limit: number = 100,
        offset?: number,
    ): CancelablePromise<{
        tag?: string;
        documents?: Array<string>;
        scrap_posts?: Array<string>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tags/{name}/all',
            path: {
                'name': name,
            },
            query: {
                'limit': limit,
                'offset': offset,
            },
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get all tags for a document
     * @param id
     * @returns Tag Tags retrieved successfully
     * @throws ApiError
     */
    public getDocumentTags(
        id: string,
    ): CancelablePromise<Array<Tag>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/tags/documents/{id}/tags',
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
}
