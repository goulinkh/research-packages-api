// Shared context for scratch files. Import what you need:
//
//   import { lp, x, pp } from "./lib.ts";
//
// - lp   typed openapi-fetch client (paths/params/responses type-checked)
// - x    Explorer — untyped, hypermedia-friendly (arbitrary paths, absolute links)
// - pp   colorized pretty-printer
//
// qastaging runs ahead of production, so some operations exist only there
// (searchTasksCounts, getTranslationCoverage, …). For those:
//
//   import { qas, xq } from "./lib.ts";
//
// - qas  typed client for api.qastaging.launchpad.net
// - xq   Explorer pointed at qastaging
//
// Set LP_TOKEN in the environment for authenticated production calls, and
// LP_QASTAGING_TOKEN for qastaging — Launchpad issues OAuth tokens per
// instance, so a production token is not valid there.

export { pp } from "../src/explore.ts";
import { createLaunchpadClient, createQastagingClient } from "../src/index.ts";
import { Explorer } from "../src/explore.ts";

export const lp = createLaunchpadClient({ token: process.env.LP_TOKEN });
export const x = new Explorer({ token: process.env.LP_TOKEN });

export const qas = createQastagingClient({
    token: process.env.LP_QASTAGING_TOKEN
});
export const xq = new Explorer({
    instance: "qastaging.launchpad.net",
    token: process.env.LP_QASTAGING_TOKEN
});

/** Throw if `value` is null/undefined, narrowing it for the caller. */
export function assertDefined<T>(
    value: T,
    message: string
): asserts value is NonNullable<T> {
    if (value == null) throw new Error(message);
}
