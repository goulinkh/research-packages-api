// Shared context for scratch files. Import what you need:
//
//   import { lp, x, pp } from "./lib.ts";
//
// - lp   typed openapi-fetch client (paths/params/responses type-checked)
// - x    Explorer — untyped, hypermedia-friendly (arbitrary paths, absolute links)
// - pp   colorized pretty-printer
//
// Set LP_TOKEN in the environment for authenticated calls.

export { pp } from "../src/explore.ts";
import { createLaunchpadClient } from "../src/index.ts";
import { Explorer } from "../src/explore.ts";

export const lp = createLaunchpadClient({ token: process.env.LP_TOKEN });
export const x = new Explorer({ token: process.env.LP_TOKEN });

/** Throw if `value` is null/undefined, narrowing it for the caller. */
export function assertDefined<T>(
    value: T,
    message: string
): asserts value is NonNullable<T> {
    if (value == null) throw new Error(message);
}
