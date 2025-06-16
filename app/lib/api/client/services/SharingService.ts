/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Share } from '../models/Share';
import type { SharedDocument } from '../models/SharedDocument';
import type { ShareDocumentRequest } from '../models/ShareDocumentRequest';
import type { ShareResponse } from '../models/ShareResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SharingService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create share link
     * @param id
     * @param requestBody
     * @returns ShareResponse Share created successfully
     * @throws ApiError
     */
    public shareDocument(
        id: string,
        requestBody: ShareDocumentRequest,
    ): CancelablePromise<ShareResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/shares/documents/{id}/share',
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
     * List document shares
     * @param id
     * @returns any Shares retrieved successfully
     * @throws ApiError
     */
    public listDocumentShares(
        id: string,
    ): CancelablePromise<{
        data?: Array<Share>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/shares/documents/{id}/shares',
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
     * Get shared document
     * @param token
     * @returns SharedDocument Shared document retrieved successfully
     * @throws ApiError
     */
    public getSharedDocument(
        token: string,
    ): CancelablePromise<SharedDocument> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/shares/{token}',
            path: {
                'token': token,
            },
            errors: {
                404: `Not found`,
            },
        });
    }
    /**
     * Delete share
     * @param token
     * @returns void
     * @throws ApiError
     */
    public deleteShare(
        token: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/shares/{token}',
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
}
