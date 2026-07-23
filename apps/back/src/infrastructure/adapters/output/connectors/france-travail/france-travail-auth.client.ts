import { z } from "zod";
import { inject, injectable } from "inversify";
import { TYPES } from "../../../../container/types.js";

type FetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type Fetcher = (
  input: string,
  init: {
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body: string;
  },
) => Promise<FetchResponse>;

const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
});

// France Travail's OAuth2 client-credentials tokens are typically valid for
// ~1499s; used only when a response omits expires_in.
const DEFAULT_TOKEN_TTL_SECONDS = 1499;

// Refresh slightly before actual expiry so an in-flight request never races
// against the token dying mid-call.
const EXPIRY_SAFETY_MARGIN_MS = 30_000;

// Transient DNS/connection failures (e.g. EAI_AGAIN) surface as a rejected
// fetch rather than a response, so a couple of quick retries ride out a
// momentary network blip instead of failing the whole source until the next
// cron tick.
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface FranceTravailAuthClientOptions {
  readonly authUrl: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly scope: string;
  readonly fetcher?: Fetcher;
  readonly now?: () => number;
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

@injectable()
export class FranceTravailAuthClient {
  private cachedToken: CachedToken | null = null;

  constructor(
    @inject(TYPES.FranceTravailAuthClientOptions)
    private readonly options: FranceTravailAuthClientOptions,
  ) {}

  async getAccessToken(): Promise<string> {
    const now = this.options.now ?? Date.now;
    if (this.cachedToken && this.cachedToken.expiresAt > now()) {
      return this.cachedToken.accessToken;
    }

    return this.requestNewToken();
  }

  private async requestNewToken(): Promise<string> {
    if (!this.options.clientId || !this.options.clientSecret) {
      throw new Error("France Travail client_id/client_secret missing");
    }

    const fetcher = this.options.fetcher ?? fetch;
    
    const scope = `${this.options.scope} application_${this.options.clientId}`;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      scope,
    }).toString();

    const response = await this.fetchWithRetry(fetcher, this.options.authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `France Travail auth request failed with status ${response.status}`,
      );
    }

    const payload = await response.json();
    const parsed = tokenResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error("France Travail auth response payload is invalid");
    }

    const now = this.options.now ?? Date.now;
    const ttlSeconds = parsed.data.expires_in ?? DEFAULT_TOKEN_TTL_SECONDS;
    this.cachedToken = {
      accessToken: parsed.data.access_token,
      expiresAt: now() + ttlSeconds * 1000 - EXPIRY_SAFETY_MARGIN_MS,
    };

    return this.cachedToken.accessToken;
  }

  private async fetchWithRetry(
    fetcher: Fetcher,
    url: string,
    init: {
      readonly method: string;
      readonly headers: Record<string, string>;
      readonly body: string;
    },
  ): Promise<FetchResponse> {
    const maxRetries = this.options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const retryDelayMs = this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    const sleep = this.options.sleep ?? defaultSleep;

    let attempt = 0;
    for (;;) {
      try {
        return await fetcher(url, init);
      } catch (error) {
        attempt += 1;
        if (attempt > maxRetries) {
          throw error;
        }
        await sleep(retryDelayMs);
      }
    }
  }
}
