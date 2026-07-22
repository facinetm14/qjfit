import { FranceTravailAuthClient } from "./france-travail-auth.client.js";

function buildOptions(overrides: Record<string, unknown> = {}) {
  return {
    authUrl: "https://entreprise.test/connexion/oauth2/access_token?realm=/partenaire",
    clientId: "client-id",
    clientSecret: "client-secret",
    scope: "api_offresdemploiv2 o2dsoffre",
    ...overrides,
  };
}

describe("FranceTravailAuthClient", () => {
  it("exchanges client_id/client_secret for an access token", async () => {
    const calls: Array<{ url: string; init: unknown }> = [];
    const fetcher = async (url: string, init: unknown) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "token-1",
          token_type: "Bearer",
          expires_in: 1499,
        }),
      };
    };

    const client = new FranceTravailAuthClient({
      ...buildOptions(),
      fetcher,
    });

    const token = await client.getAccessToken();

    expect(token).toBe("token-1");
    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (!call) {
      throw new Error("expected fetcher to have been called");
    }
    const { url, init } = call;
    expect(url).toBe(
      "https://entreprise.test/connexion/oauth2/access_token?realm=/partenaire",
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const body = new URLSearchParams(
      (init as { body: string }).body,
    );
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("client-id");
    expect(body.get("client_secret")).toBe("client-secret");
    expect(body.get("scope")).toBe("api_offresdemploiv2 o2dsoffre");
  });

  it("caches the token until it is close to expiring", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: `token-${callCount}`,
          expires_in: 1499,
        }),
      };
    };
    let now = 0;
    const client = new FranceTravailAuthClient({
      ...buildOptions(),
      fetcher,
      now: () => now,
    });

    const first = await client.getAccessToken();
    now += 1000;
    const second = await client.getAccessToken();

    expect(first).toBe("token-1");
    expect(second).toBe("token-1");
    expect(callCount).toBe(1);
  });

  it("requests a new token once the cached one is close to expiring", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: `token-${callCount}`,
          expires_in: 1499,
        }),
      };
    };
    let now = 0;
    const client = new FranceTravailAuthClient({
      ...buildOptions(),
      fetcher,
      now: () => now,
    });

    const first = await client.getAccessToken();
    now += 1499 * 1000;
    const second = await client.getAccessToken();

    expect(first).toBe("token-1");
    expect(second).toBe("token-2");
    expect(callCount).toBe(2);
  });

  it("throws a clear error when client_id or client_secret is missing", async () => {
    const client = new FranceTravailAuthClient(
      buildOptions({ clientId: "" }),
    );

    await expect(client.getAccessToken()).rejects.toThrow(
      "France Travail client_id/client_secret missing",
    );
  });

  it("throws when the auth server responds with a non-ok status", async () => {
    const fetcher = async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid_client" }),
    });

    const client = new FranceTravailAuthClient({
      ...buildOptions(),
      fetcher,
    });

    await expect(client.getAccessToken()).rejects.toThrow(
      "France Travail auth request failed with status 401",
    );
  });

  it("throws on an invalid token response payload", async () => {
    const fetcher = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ unexpected: true }),
    });

    const client = new FranceTravailAuthClient({
      ...buildOptions(),
      fetcher,
    });

    await expect(client.getAccessToken()).rejects.toThrow(
      "France Travail auth response payload is invalid",
    );
  });
});
