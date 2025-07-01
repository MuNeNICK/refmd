/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { AuthenticationService } from './services/AuthenticationService';
import { DocumentsService } from './services/DocumentsService';
import { FilesService } from './services/FilesService';
import { GitSyncService } from './services/GitSyncService';
import { PublicDocumentsService } from './services/PublicDocumentsService';
import { ScrapsService } from './services/ScrapsService';
import { SharingService } from './services/SharingService';
import { SocketIoService } from './services/SocketIoService';
import { TagsService } from './services/TagsService';
import { UsersService } from './services/UsersService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class RefMDClient {
    public readonly authentication: AuthenticationService;
    public readonly documents: DocumentsService;
    public readonly files: FilesService;
    public readonly gitSync: GitSyncService;
    public readonly publicDocuments: PublicDocumentsService;
    public readonly scraps: ScrapsService;
    public readonly sharing: SharingService;
    public readonly socketIo: SocketIoService;
    public readonly tags: TagsService;
    public readonly users: UsersService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? 'http://localhost:8888/api',
            VERSION: config?.VERSION ?? '1.1.0',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.authentication = new AuthenticationService(this.request);
        this.documents = new DocumentsService(this.request);
        this.files = new FilesService(this.request);
        this.gitSync = new GitSyncService(this.request);
        this.publicDocuments = new PublicDocumentsService(this.request);
        this.scraps = new ScrapsService(this.request);
        this.sharing = new SharingService(this.request);
        this.socketIo = new SocketIoService(this.request);
        this.tags = new TagsService(this.request);
        this.users = new UsersService(this.request);
    }
}

