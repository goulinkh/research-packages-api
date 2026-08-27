import createClient, { type Client } from "openapi-fetch";
import type { paths } from "./schema/devel.ts";
import type { paths as qastagingPaths } from "./schema/qastaging/devel.ts";

/** Host of the QA staging instance, the only non-production one with a spec. */
const QASTAGING_INSTANCE = "qastaging.launchpad.net";

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
 * `src/schema/devel.ts`, generated from the **production** spec:
 *
 * ```ts
 * const lp = createLaunchpadClient();
 * const { data } = await lp.GET("/distros", {});
 * ```
 *
 * Pointing `instance` at a non-production host still works, but the types stay
 * production's and will not describe operations that only exist there — use
 * {@link createQastagingClient} for qastaging.
 */
export function createLaunchpadClient(
  options: LaunchpadClientOptions = {},
): Client<paths> {
  const { instance = "launchpad.net" } = options;
  return buildClient<paths>(`https://api.${instance}/devel`, options);
}

/**
 * Create a typed client for the QA staging Launchpad API (`devel` version).
 *
 * qastaging runs ahead of production, so its spec is a superset: operations
 * such as `searchTasksCounts` and `getTranslationCoverage` exist only here.
 * Types come from `src/schema/qastaging/devel.ts`; the host is fixed, since
 * those types describe qastaging and nothing else.
 */
export function createQastagingClient(
  options: Omit<LaunchpadClientOptions, "instance"> = {},
): Client<qastagingPaths> {
  return buildClient<qastagingPaths>(
    `https://api.${QASTAGING_INSTANCE}/devel`,
    options,
  );
}

/**
 * Build an openapi-fetch client for `baseUrl` under the schema `Paths`.
 *
 * Shared by every instance factory: only the base URL and the generated schema
 * differ between them, so auth headers and the named-operation URL fix below
 * are written once.
 */
function buildClient<Paths extends object>(
  baseUrl: string,
  options: Omit<LaunchpadClientOptions, "instance">,
): Client<Paths> {
  const { token, fetchOptions } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(token ? { Authorization: `OAuth ${token}` } : {}),
  };

  const client = createClient<Paths>({
    baseUrl,
    headers,
    ...fetchOptions,
  });

  // Launchpad's named operations live at path keys like
  // `/{distribution}?ws.op=searchSourcePackages`. openapi-fetch always joins
  // additional query params with `?`, producing an invalid double-`?` URL
  // (`…?ws.op=searchSourcePackages?source_match=python`). Collapse every `?`
  // after the first into `&` so these operations accept extra query params.
  client.use({
    onRequest({ request }) {
      const mark = request.url.indexOf("?");
      if (mark === -1 || request.url.indexOf("?", mark + 1) === -1)
        return undefined;
      const fixed =
        request.url.slice(0, mark + 1) +
        request.url.slice(mark + 1).replace(/\?/g, "&");
      return new Request(fixed, request);
    },
  });

  return client;
}
