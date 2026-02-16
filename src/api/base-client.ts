/**
 * Base HTTP client — shared fetch wrapper with auth, retries, and error handling.
 */

import { Config } from "../config.js";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string
  ) {
    super(`HTTP ${statusCode} ${statusText} from ${url}: ${body.slice(0, 500)}`);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string | undefined>;
  /** Maximum number of retries on 5xx or network error (default 2) */
  retries?: number;
}

export class BaseClient {
  protected readonly baseUrl: string;
  protected readonly sslVerify: boolean;

  constructor(protected readonly config: Config) {
    this.baseUrl = config.baseUrl;
    this.sslVerify = config.sslVerify;
  }

  protected async request<T = unknown>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { method = "GET", headers = {}, body, params, retries = 2 } = options;

    // Build URL with query parameters
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.append(key, value);
        }
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        Accept: "application/json",
        ...headers,
      },
    };

    if (body) {
      fetchOptions.headers = {
        ...fetchOptions.headers as Record<string, string>,
        "Content-Type": "application/vnd.api+json",
      };
      fetchOptions.body = JSON.stringify(body);
    }

    // Disable SSL verification if configured
    if (!this.sslVerify) {
      // Node.js fetch supports this via the dispatcher option,
      // but the simplest approach for self-signed certs is the env var
      // NODE_TLS_REJECT_UNAUTHORIZED=0 set at startup
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url.toString(), fetchOptions);

        if (response.ok) {
          const text = await response.text();
          if (!text) return {} as T;
          return JSON.parse(text) as T;
        }

        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          const errorBody = await response.text();
          throw new ApiError(response.status, response.statusText, errorBody, url.toString());
        }

        // Server errors (5xx) — retry
        const errorBody = await response.text();
        lastError = new ApiError(response.status, response.statusText, errorBody, url.toString());
      } catch (error) {
        if (error instanceof ApiError && error.statusCode < 500) {
          throw error; // Don't retry client errors
        }
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Exponential backoff before retry
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error("Request failed after retries");
  }
}
