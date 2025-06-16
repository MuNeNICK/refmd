/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateDocumentRequest } from '../models/CreateDocumentRequest';
import type { Document } from '../models/Document';
import type { DocumentListResponse } from '../models/DocumentListResponse';
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
}
