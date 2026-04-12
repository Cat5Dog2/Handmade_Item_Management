import { describe, expect, it, vi } from "vitest";
import { createApiClient, ApiClientError } from "./api-client";

type FetchRequestInit = NonNullable<Parameters<typeof fetch>[1]>;

describe("createApiClient", () => {
  it("attaches the id token and parses successful responses", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { status: "ok" } }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      })
    );
    const client = createApiClient({
      fetchImpl,
      getIdToken: vi.fn().mockResolvedValue("test-token")
    });

    const response = await client.get<{ status: string }>("/api/health");
    const request = fetchImpl.mock.calls[0]?.[1] as FetchRequestInit;
    const headers = new Headers(request.headers);

    expect(response).toEqual({ data: { status: "ok" } });
    expect(headers.get("Authorization")).toBe("Bearer test-token");
  });

  it("skips the authorization header when auth is not required", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ data: { service: "web" } }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 200
      })
    );
    const client = createApiClient({
      fetchImpl,
      getIdToken: vi.fn().mockResolvedValue("test-token")
    });

    await client.get<{ service: string }>("/api/health", { requireAuth: false });

    const request = fetchImpl.mock.calls[0]?.[1] as FetchRequestInit;
    const headers = new Headers(request.headers);

    expect(headers.has("Authorization")).toBe(false);
  });

  it("invokes the unauthorized handler for 401 responses", async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "AUTH_REQUIRED",
          message: "セッションが切れました。再度ログインしてください。"
        }),
        {
          headers: {
            "Content-Type": "application/json"
          },
          status: 401
        }
      )
    );
    const client = createApiClient({
      fetchImpl,
      onUnauthorized
    });

    await expect(client.get("/api/dashboard")).rejects.toMatchObject({
        code: "AUTH_REQUIRED",
        message: "セッションが切れました。再度ログインしてください。",
        status: 401
      } satisfies Partial<ApiClientError>);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("invokes the forbidden handler for 403 responses", async () => {
    const onForbidden = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "AUTH_FORBIDDEN",
          message: "この操作は実行できません。"
        }),
        {
          headers: {
            "Content-Type": "application/json"
          },
          status: 403
        }
      )
    );
    const client = createApiClient({
      fetchImpl,
      onForbidden
    });

    await expect(client.get("/api/products")).rejects.toMatchObject({
        code: "AUTH_FORBIDDEN",
        message: "この操作は実行できません。",
        status: 403
      } satisfies Partial<ApiClientError>);
    expect(onForbidden).toHaveBeenCalledTimes(1);
  });
});
