import createClient, { type Client } from "openapi-fetch";
import type { paths as Paths1_0 } from "./schema/1_0.ts";
import type { paths as PathsBeta } from "./schema/beta.ts";
import type { paths as PathsDevel } from "./schema/devel.ts";

/** Launchpad API version. Maps to the `/<version>` path segment on the API host. */
export type LaunchpadVersion = "1.0" | "beta" | "devel";

/** OpenAPI `paths` type for a given Launchpad API version. */
export type LaunchpadPaths<V extends LaunchpadVersion> = {
  "1.0": Paths1_0;
  beta: PathsBeta;
  devel: PathsDevel;
}[V];

export interface LaunchpadClientOptions {
  /** API version. Default: `"devel"`. */
  version?: LaunchpadVersion;
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
 * Create a typed client for the Launchpad web-service API.
 *
 * The return type is specialised to the requested `version` so paths, params,
 * and response bodies are all type-checked:
 *
 * ```ts
 * const lp = createLaunchpadClient({ version: "devel" });
 * const { data } = await lp.GET("/distros", {});
 * ```
 */
export function createLaunchpadClient(
  options?: LaunchpadClientOptions & { version?: "devel" },
): Client<PathsDevel>;
export function createLaunchpadClient(
  options: LaunchpadClientOptions & { version: "1.0" },
): Client<Paths1_0>;
export function createLaunchpadClient(
  options: LaunchpadClientOptions & { version: "beta" },
): Client<PathsBeta>;
export function createLaunchpadClient(
  options: LaunchpadClientOptions = {},
): Client<Paths1_0> | Client<PathsBeta> | Client<PathsDevel> {
  const {
    version = "devel",
    instance = "launchpad.net",
    token,
    fetchOptions,
  } = options;

  const baseUrl = `https://api.${instance}/${version}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(token ? { Authorization: `OAuth ${token}` } : {}),
  };

  return createClient<PathsDevel>({
    baseUrl,
    headers,
    ...fetchOptions,
  });
}
