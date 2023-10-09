/* tslint:disable */
/* eslint-disable */
import { ErrorResponse } from "./models";
import { AuthSessionState } from "../../../private/AuthSessionState";

/**
 * @bytescale/api
 * Bytescale API
 *
 * The version of the OpenAPI document: 2.0.0
 * Contact: hello@bytescale.com
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

export interface BytescaleApiClientConfig {
  /**
   * Only required for Node.js. Must be an instance of requires("node-fetch").
   *
   * Not required for the browser.
   */
  fetchApi?: FetchAPI;

  /**
   * Must begin with "public_" or "secret_".
   *
   * Please note: if you require JWT-based auth, you must provide an API key to this field, and then call 'AuthManager.beginAuthSession' to start a JWT-based auth session. The JWT's permissions will be merged with the API key's permissions, with precedence given to the JWT.
   */
  apiKey: string;

  /**
   * The base URL of the Bytescale API.
   */
  apiUrl?: string;

  /**
   * The base URL of the Bytescale CDN.
   */
  cdnUrl?: string;

  /**
   * Headers to include in all API requests.
   *
   * These headers take precedence over any headers automatically added by the SDK (e.g. "Authorization", "Content-Type", etc.).
   */
  headers?: HTTPHeaders | (() => Promise<HTTPHeaders> | HTTPHeaders); // This should be present on all Bytescale SDKs, as it's how we instruct users to pass the "Authorization-Token" request header for non-cookie-based JWT auth.
}

export class BytescaleApiClientConfigUtils {
  static defaultApiUrl = "https://api.bytescale.com";
  static defaultCdnUrl = "https://upcdn.io";
  private static readonly specialApiKeys = ["free", "demo"];
  private static readonly specialApiKeyAccountId = "W142hJk";
  private static readonly accountIdLength = 7; // Sync with: upload/shared/**/AccountIdUtils

  static getApiUrl(config: BytescaleApiClientConfig): string {
    return config.apiUrl ?? BytescaleApiClientConfigUtils.defaultApiUrl;
  }

  static getCdnUrl(config: Pick<BytescaleApiClientConfig, "cdnUrl">): string {
    return config.cdnUrl ?? BytescaleApiClientConfigUtils.defaultCdnUrl;
  }

  static getFetchApi(config: Pick<BytescaleApiClientConfig, "fetchApi">): FetchAPI {
    return config.fetchApi ?? fetch;
  }

  static getAccountId(config: Pick<BytescaleApiClientConfig, "apiKey">): string {
    let accountId: string;

    if (BytescaleApiClientConfigUtils.specialApiKeys.includes(config.apiKey)) {
      accountId = BytescaleApiClientConfigUtils.specialApiKeyAccountId;
    } else {
      accountId = config.apiKey.split("_")[1]?.substr(0, BytescaleApiClientConfigUtils.accountIdLength) ?? "";
      if (accountId.length !== BytescaleApiClientConfigUtils.accountIdLength) {
        throw new Error(`Invalid Bytescale API key.`);
      }
    }

    return accountId;
  }

  static validate(config: BytescaleApiClientConfig): void {
    // Defensive programming, for users not using TypeScript. Mainly because this is used by UploadWidget users.
    if ((config ?? undefined) === undefined) {
      throw new Error(`Config parameter required.`);
    }
    if ((config.apiKey ?? undefined) === undefined) {
      throw new Error(`Please provide an API key via the 'apiKey' config parameter.`);
    }
    if (config.apiKey.trim() !== config.apiKey) {
      // We do not support API keys with whitespace (by trimming ourselves) because otherwise we'd need to support this
      // everywhere in perpetuity (since removing the trimming would be a breaking change).
      throw new Error(`API key needs trimming (whitespace detected).`);
    }

    // This performs futher validation on the API key...
    BytescaleApiClientConfigUtils.getAccountId(config);
  }
}

/**
 * This is the base class for all generated API classes.
 */
export class BaseAPI {
  constructor(protected readonly config: BytescaleApiClientConfig) {
    BytescaleApiClientConfigUtils.validate(config);
  }

  /**
   * Returns a successful response (2**) else throws an error.
   */
  static async fetch(
    url: string,
    init: RequestInit,
    config: Pick<BytescaleApiClientConfig, "fetchApi"> & { isBytescaleApi: boolean }
  ): Promise<Response> {
    let response: Response;
    try {
      response = await BytescaleApiClientConfigUtils.getFetchApi(config)(url, {
        ...init,

        // This is specifically added to cater for Next.js's Fetch implementation, which caches POST requests...
        //
        // "fetch requests that use the POST method are also automatically cached."
        // - https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating#caching-data
        //
        // However, this is probably a good idea, even for all GET requests, as if the user is refreshing a JWT
        // or downloading a file via 'FileApi.downloadFile', then they'll likely want the latest.
        cache: "no-store"
      });
    } catch (e) {
      // Network-level errors, CORS errors, or HTTP-level errors from intermediary services (e.g. AWS or the user's own infrastructure/proxies).
      // HTTP-level errors from external services (e.g. AWS or the user's own proxy) will appear as CORS errors as their response headers won't include the appropriate CORS values.
      throw new Error(
        config.isBytescaleApi
          ? `Unable to resolve the Bytescale API: ${
              (e as Error).message
            } If the problem persists, and your network connection is OK, then please contact support@bytescale.com and provide: (a) time of failed request in UTC (b) screenshot of failed network response header + body (c) screenshot of failed network request header + body (d) browser and OS version.`
          : `Unable to resolve URL (${url}): ${(e as Error).message}`
      );
    }

    if (response.status >= 200 && response.status < 300) {
      return response;
    }

    if (config.isBytescaleApi) {
      let jsonError = undefined;
      try {
        jsonError = await response.json();
      } catch (_e) {
        // Error will be thrown below.
      }
      if (typeof jsonError?.error?.code === "string") {
        throw new BytescaleApiError(jsonError as ErrorResponse);
      }

      // HTTP-level errors from intermediary services (e.g. AWS or the user's own infrastructure/proxies). On the browser,
      // this error is unlikely to be triggered since these errors will masqurade as CORS errors (see above) but in Node.js
      // this error will appear from any intermediary service failure.
      throw new Error(`Unable to connect to the Bytescale API (${response.status}): please try again.`);
    }

    throw new Error(`Failure status code (${response.status}) received for request: ${init.method ?? "GET"} ${url}`);
  }

  protected async request(
    context: RequestOpts,
    initOverrides: RequestInit | InitOverrideFunction | undefined,
    baseUrlOverride: string | undefined
  ): Promise<Response> {
    const apiKey = this.config.apiKey;
    context.headers["Authorization"] = `Bearer ${apiKey}`; // authorization-header authentication

    const session = AuthSessionState.getSession();
    if (session?.accessToken !== undefined) {
      context.headers["Authorization-Token"] = session.accessToken;
    }

    // Key: any possible value for 'baseUrlOverride'
    // Value: user-overridden value for that base URL from the config.
    const nonDefaultBasePaths = {
      [BytescaleApiClientConfigUtils.defaultCdnUrl]: BytescaleApiClientConfigUtils.getCdnUrl(this.config)
    };

    const { url, init } = await this.createFetchParams(
      context,
      initOverrides,
      baseUrlOverride === undefined ? undefined : nonDefaultBasePaths[baseUrlOverride] ?? baseUrlOverride
    );

    return BaseAPI.fetch(url, init, { ...this.config, isBytescaleApi: true });
  }

  protected encodeParam(paramName: string, paramValue: string): string {
    if (paramName === "filePath") {
      if (!paramValue.startsWith("/")) {
        // Non-obvious errors are returned by the Bytescale CDN if forward slashes are omitted, so catch it client-side:
        throw new Error("The 'filePath' parameter must begin with a '/' character.");
      }
      // We must not encode the filePath param (as slashes are valid).
      return paramValue;
    }

    return encodeURIComponent(paramValue);
  }

  private async createFetchParams(
    context: RequestOpts,
    initOverrides: RequestInit | InitOverrideFunction | undefined,
    baseUrlOverride: string | undefined
  ) {
    let url = (baseUrlOverride ?? BytescaleApiClientConfigUtils.getApiUrl(this.config)) + context.path;
    if (context.query !== undefined && Object.keys(context.query).length !== 0) {
      // only add the querystring to the URL if there are query parameters.
      // this is done to avoid urls ending with a "?" character which buggy webservers
      // do not handle correctly sometimes.
      url += "?" + querystring(context.query);
    }
    const configHeaders = this.config.headers;
    const headers = {
      ...context.headers,
      // Headers from config take precedence, to allow us to override the "Authorization" header (which is added earlier
      // on) with a JWT session token.
      ...(configHeaders === undefined
        ? {}
        : typeof configHeaders === "function"
        ? await configHeaders()
        : configHeaders)
    };
    Object.keys(headers).forEach(key => (headers[key] === undefined ? delete headers[key] : {}));

    const initOverrideFn = typeof initOverrides === "function" ? initOverrides : async () => initOverrides;

    const initParams = {
      method: context.method,
      headers,
      body: context.body
    };

    const overriddenInit: RequestInit = {
      ...initParams,
      ...(await initOverrideFn({
        init: initParams,
        context
      }))
    };

    const init: RequestInit = {
      ...overriddenInit,
      body: JSON.stringify(overriddenInit.body)
    };

    return { url, init };
  }
}

export class CancelledError extends Error {
  override name: "CancelledError" = "CancelledError";

  constructor() {
    super("Operation cancelled by caller.");
  }
}

export class BytescaleApiError extends Error {
  override name: "BytescaleApiError" = "BytescaleApiError";
  public readonly errorCode: string;
  public readonly details: any | undefined;

  constructor(response: ErrorResponse) {
    super(response.error.message);

    this.errorCode = response.error.code;
    this.details = response.error.details;
  }
}

export type FetchAPI = WindowOrWorkerGlobalScope["fetch"];

export type Json = any;
export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
export type HTTPHeaders = { [key: string]: string };
export type HTTPQuery = {
  [key: string]: string | number | null | boolean | HTTPQuery;
};
export type HTTPBody = Json | FormData | URLSearchParams;
export type HTTPRequestInit = { headers?: HTTPHeaders; method: HTTPMethod; body?: HTTPBody };

export type InitOverrideFunction = (requestContext: {
  init: HTTPRequestInit;
  context: RequestOpts;
}) => Promise<RequestInit>;

export interface RequestOpts {
  path: string;
  method: HTTPMethod;
  headers: HTTPHeaders;
  query?: HTTPQuery;
  body?: HTTPBody;
}

export function querystring(params: HTTPQuery): string {
  return Object.keys(params)
    .map(key => querystringSingleKey(key, params[key]))
    .filter(part => part.length > 0)
    .join("&");
}

function querystringSingleKey(key: string, value: string | number | null | undefined | boolean | HTTPQuery): string {
  if (value instanceof Object) {
    return querystring(value as HTTPQuery);
  }
  return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
}

export interface ApiResponse<T> {
  raw: Response;
  value(): Promise<T>;
}

export class JSONApiResponse<T> {
  constructor(public raw: Response) {}

  async value(): Promise<T> {
    return await this.raw.json();
  }
}

export class VoidApiResponse {
  constructor(public raw: Response) {}

  async value(): Promise<void> {
    return undefined;
  }
}

export class BinaryResult {
  constructor(public raw: Response) {}

  stream(): ReadableStream<Uint8Array> {
    if (this.raw.bodyUsed) {
      throw new Error("Response body has already been consumed.");
    }
    if (this.raw.body === null) {
      throw new Error("Response body does not exist.");
    }
    return this.raw.body;
  }

  async text(): Promise<string> {
    return await this.raw.text();
  }

  async blob(): Promise<Blob> {
    return await this.raw.blob();
  }

  async json(): Promise<any> {
    return await this.raw.json();
  }
}
