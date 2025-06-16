/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { File } from '../models/File';
import type { FileResponse } from '../models/FileResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class FilesService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List files for a document
     * @param documentId
     * @returns any Files retrieved successfully
     * @throws ApiError
     */
    public listFiles(
        documentId: string,
    ): CancelablePromise<{
        data?: Array<File>;
    }> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/files',
            query: {
                'document_id': documentId,
            },
            errors: {
                401: `Unauthorized`,
                403: `Forbidden`,
            },
        });
    }
    /**
     * Upload file
     * @param formData
     * @returns FileResponse File uploaded successfully
     * @throws ApiError
     */
    public uploadFile(
        formData: {
            file: Blob;
            document_id?: string;
        },
    ): CancelablePromise<FileResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/files/upload',
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                400: `Bad request`,
                401: `Unauthorized`,
                413: `File too large`,
            },
        });
    }
    /**
     * Download file
     * @param id
     * @returns binary File retrieved successfully
     * @throws ApiError
     */
    public downloadFile(
        id: string,
    ): CancelablePromise<Blob> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/files/{id}',
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
     * Delete file
     * @param id
     * @returns void
     * @throws ApiError
     */
    public deleteFile(
        id: string,
    ): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/files/{id}',
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
     * Download file by filename
     * Download file by filename from document directory. Supports public access with share token.
     * @param filename
     * @param documentId
     * @param token Share token for accessing files in shared documents
     * @returns binary File retrieved successfully
     * @throws ApiError
     */
    public downloadFileByName(
        filename: string,
        documentId: string,
        token?: string,
    ): CancelablePromise<Blob> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/files/documents/{filename}',
            path: {
                'filename': filename,
            },
            query: {
                'document_id': documentId,
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
