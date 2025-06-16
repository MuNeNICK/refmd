/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SocketIoService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get active users
     * Get list of users currently viewing or editing the document
     * @param id
     * @returns any Active users retrieved successfully
     * @throws ApiError
     */
    public getActiveUsers(
        id: string,
    ): CancelablePromise<{
        data?: Array<{
            user_id?: string;
            name?: string;
            email?: string;
            cursor_position?: number | null;
            selection?: Record<string, any> | null;
        }>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/socketio/documents/{id}/active-users',
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
     * Get document statistics
     * Get real-time statistics about the document
     * @param id
     * @returns any Statistics retrieved successfully
     * @throws ApiError
     */
    public getDocumentStats(
        id: string,
    ): CancelablePromise<{
        data?: {
            active_users?: number;
            total_edits?: number;
            last_modified?: string;
            version?: number;
        };
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/socketio/documents/{id}/stats',
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
