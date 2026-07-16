import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./schema/devel.ts";

export interface LaunchpadClientOptions {
  /**
   * Launchpad instance host, e.g. `"launchpad.net"` (production) or
   * `"staging.launchpad.net"`. The API host `api.<instance>` is derived.
   * Default: `"launchpad.net"`.
   */
  instance?: string;
  /** OAuth token, sent as the Launchpad `Authorization` header when provided. */
  token?: string;
  /** Extra fetch options forwarded to openapi-fetch (custom `fetch`, headers, …). */
  fetchOptions?: Parameters<typeof createClient>[0];
}

/**
 * Create a typed client for the Launchpad web-service API (`devel` version).
 *
 * Paths, params, and response bodies are type-checked against
 * `src/schema/devel.ts`:
 *
 * ```ts
 * const lp = createLaunchpadClient();
 * const { data } = await lp.GET("/distros", {});
 * ```
 */
export function createLaunchpadClient(
  options: LaunchpadClientOptions = {},
): Client<paths> {
  const { instance = "launchpad.net", token, fetchOptions } = options;

  const baseUrl = `https://api.${instance}/devel`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(token ? { Authorization: `OAuth ${token}` } : {}),
  };

  return createClient<paths>({
    baseUrl,
    headers,
    ...fetchOptions,
  });
}
