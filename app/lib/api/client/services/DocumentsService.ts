/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BacklinksResponse } from '../models/BacklinksResponse';
import type { CreateDocumentRequest } from '../models/CreateDocumentRequest';
import type { Document } from '../models/Document';
import type { DocumentListResponse } from '../models/DocumentListResponse';
import type { LinkStatsResponse } from '../models/LinkStatsResponse';
import type { OutgoingLinksResponse } from '../models/OutgoingLinksResponse';
import type { SearchResult } from '../models/SearchResult';
import type { UpdateDocumentRequest } from '../models/UpdateDocumentRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class DocumentsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List user documents
     * @param page Page number
     * @param limit Items per page
     * @param sort Sort field
     * @param order Sort order
     * @returns DocumentListResponse Documents retrieved successfully
     * @throws ApiError
     */
    public listDocuments(
        page: number = 1,
        limit: number = 20,
        sort: 'created_at' | 'updated_at' | 'title' = 'updated_at',
        order: 'asc' | 'desc' = 'desc',
    ): CancelablePromise<DocumentListResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/documents',
            query: {
                'page': page,
                'limit': limit,
                'sort': sort,
                'order': order,
            },
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Create a new document
     * @param requestBody
     * @returns Document Document created successfully
     * @throws ApiError
     */
    public createDocument(
        requestBody: CreateDocumentRequest,
    ): CancelablePromise<Document> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/documents',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get document by ID
     * @param id
     * @param token Share token for accessing shared documents
     * @returns Document Document retrieved successfully
     * @throws ApiError
     */
    public getDocument(
        id: string,
        token?: string,
    ): CancelablePromise<Document> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/documents/{id}',
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
     * Update document
     * @param id
     * @param requestBody
     * @param token Share token for updating shared documents
     * @returns Document Document updated successfully
     * @throws ApiError
     */
    public updateDocument(
        id: string,
        requestBody: UpdateDocumentRequest,
        token?: string,
    ): CancelablePromise<Document> {
        return this.httpRequest.request({
            method: 'PUT',
            url: '/documents/{id}',
            path: {
                'id': id,
            },
            query: {
                'token': token,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
                403: `Forbidden`,
                404: `Not found`,
            },
        });
    }
    /**
     * Delete document
     * @param id
     * @returns void
     * @throws ApiError
     */
    public deleteDocument(
        id: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/documents/{id}',
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
     * Get document content
     * Returns the current document content as markdown text
     * @param id
     * @param token Share token for accessing shared documents
     * @returns string Document content retrieved successfully
     * @throws ApiError
     */
    public getDocumentContent(
        id: string,
        token?: string,
    ): CancelablePromise<string> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/documents/{id}/content',
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
     * Get document CRDT state
     * Returns the current CRDT state vector for synchronization
     * @param id
     * @param token Share token for accessing shared documents
     * @returns binary State vector retrieved successfully
     * @throws ApiError
     */
    public getDocumentState(
        id: string,
        token?: string,
    ): CancelablePromise<Blob> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/documents/{id}/state',
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
     * Get document updates since timestamp
     * Returns incremental CRDT updates since a given timestamp
     * @param id
     * @param requestBody
     * @param token Share token for accessing shared documents
     * @returns any Updates retrieved successfully
     * @throws ApiError
     */
    public getDocumentUpdates(
        id: string,
        requestBody: {
            /**
             * Unix timestamp in milliseconds
             */
            since: number;
        },
        token?: string,
    ): CancelablePromise<{
        updates?: Array<string>;
        timestamp?: number;
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/documents/{id}/updates',
            path: {
                'id': id,
            },
            query: {
                'token': token,
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
     * Download document with attachments
     * Downloads the document and all its attachments as a ZIP file
     * @param id
     * @param token Share token for accessing shared documents
     * @returns binary ZIP file containing document and attachments
     * @throws ApiError
     */
    public downloadDocument(
        id: string,
        token?: string,
    ): CancelablePromise<Blob> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/documents/{id}/download',
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
     * Get backlinks for a document
     * Returns all documents that link to this document
     * @param id
     * @returns BacklinksResponse Backlinks retrieved successfully
     * @throws ApiError
     */
    public getDocumentBacklinks(
        id: string,
    ): CancelablePromise<BacklinksResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/documents/{id}/backlinks',
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
     * Get outgoing links from a document
     * Returns all documents that this document links to
     * @param id
     * @returns OutgoingLinksResponse Outgoing links retrieved successfully
     * @throws ApiError
     */
    public getDocumentLinks(
        id: string,
    ): CancelablePromise<OutgoingLinksResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/documents/{id}/links',
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
     * Get link statistics for a document
     * Returns counts of backlinks and outgoing links
     * @param id
     * @returns LinkStatsResponse Link statistics retrieved successfully
     * @throws ApiError
     */
    public getDocumentLinkStats(
        id: string,
    ): CancelablePromise<LinkStatsResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/documents/{id}/link-stats',
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
     * Search documents
     * Search documents by title for autocomplete and link suggestions
     * @param q Search query
     * @param limit Maximum number of results
     * @returns SearchResult Search results retrieved successfully
     * @throws ApiError
     */
    public searchDocuments(
        q: string,
        limit: number = 10,
    ): CancelablePromise<Array<SearchResult>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/documents/search',
            query: {
                'q': q,
                'limit': limit,
            },
            errors: {
                401: `Unauthorized`,
            },
        });
    }
}
