/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AuthResponse } from '../models/AuthResponse';
import type { LoginRequest } from '../models/LoginRequest';
import type { RefreshTokenRequest } from '../models/RefreshTokenRequest';
import type { RegisterRequest } from '../models/RegisterRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class AuthenticationService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Register a new user
     * @param requestBody
     * @returns AuthResponse User registered successfully
     * @throws ApiError
     */
    public register(
        requestBody: RegisterRequest,
    ): CancelablePromise<AuthResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/auth/register',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad request`,
                409: `Conflict`,
            },
        });
    }
    /**
     * Login user
     * @param requestBody
     * @returns AuthResponse Login successful
     * @throws ApiError
     */
    public login(
        requestBody: LoginRequest,
    ): CancelablePromise<AuthResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/auth/login',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Refresh access token
     * @param requestBody
     * @returns AuthResponse Token refreshed successfully
     * @throws ApiError
     */
    public refreshToken(
        requestBody: RefreshTokenRequest,
    ): CancelablePromise<AuthResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/auth/refresh',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
    /**
     * Logout user
     * @returns void
     * @throws ApiError
     */
    public logout(): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/auth/logout',
            errors: {
                401: `Unauthorized`,
            },
        });
    }
}
