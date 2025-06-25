/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PublicDocumentListResponse } from '../models/PublicDocumentListResponse';
import type { PublicDocumentResponse } from '../models/PublicDocumentResponse';
import type { PublishDocumentRequest } from '../models/PublishDocumentRequest';
import type { PublishDocumentResponse } from '../models/PublishDocumentResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class PublicDocumentsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Publish a document
     * Make a document publicly accessible at /u/username/document-id
     * @param id
     * @param requestBody
     * @returns PublishDocumentResponse Document published successfully
     * @throws ApiError
     */
    public publishDocument(
        id: string,
        requestBody: PublishDocumentRequest,
    ): CancelablePromise<PublishDocumentResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/documents/{id}/publish',
            path: {
                'id': id,
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
     * Unpublish a document
     * Make a document private (remove from public access)
     * @param id
     * @returns void
     * @throws ApiError
     */
    public unpublishDocument(
        id: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/documents/{id}/unpublish',
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
     * List my published documents
     * Get list of documents published by the current user
     * @returns PublicDocumentListResponse Published documents retrieved successfully
     * @throws ApiError
     */
    public listMyPublicDocuments(): CancelablePromise<PublicDocumentListResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/my-public-documents',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Get public document
     * Get a publicly published document by username and document ID
     * @param username
     * @param documentId
     * @returns PublicDocumentResponse Public document retrieved successfully
     * @throws ApiError
     */
    public getPublicDocument(
        username: string,
        documentId: string,
    ): CancelablePromise<PublicDocumentResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/u/{username}/{document_id}',
            path: {
                'username': username,
                'document_id': documentId,
            },
            errors: {
                404: `Not found`,
            },
        });
    }
    /**
     * List user's public documents
     * Get list of public documents by a specific user
     * @param username
     * @param limit Maximum number of results
     * @param offset Number of items to skip
     * @returns PublicDocumentListResponse Public documents retrieved successfully
     * @throws ApiError
     */
    public listUserPublicDocuments(
        username: string,
        limit: number = 20,
        offset?: number,
    ): CancelablePromise<PublicDocumentListResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/u/{username}',
            path: {
                'username': username,
            },
            query: {
                'limit': limit,
                'offset': offset,
            },
            errors: {
                404: `Not found`,
            },
        });
    }
}
