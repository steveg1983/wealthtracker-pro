declare module 'truelayer-client' {
  interface AuthUrlOptions {
    redirectURI: string;
    scope: string[];
    nonce: string;
    state?: string;
    responseMode?: string;
    enableMock?: boolean;
    enableOauth?: boolean;
    enableOpenBanking?: boolean;
    enableCredentialsSharing?: boolean;
    enableCredentialsSharingDe?: boolean;
    disableProviders?: string[];
    providerId?: string;
  }

  interface AuthClientOptions {
    client_id: string;
    client_secret: string;
  }

  export class AuthAPIClient {
    constructor(options?: AuthClientOptions);
    getAuthUrl(config: AuthUrlOptions): string;
  }

  export const Constants: {
    AUTH_URL: string;
    API_URL: string;
    STATUS_URL: string;
  };
}
