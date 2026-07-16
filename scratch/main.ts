// Scratchpad — write your request flows here, save, and the output re-prints.
//
//   npm run scratch                      # runs this file (scratch/main.ts)
//   npm run scratch -- scratch/foo.ts    # runs another file in this folder
//
// Add as many files to scratch/ as you like; each is an independent notepad.

import { lp, x, pp } from "./lib.ts";

// ── list distributions ───────────────────────────────────────────────────────
const distros = await x.get("/distros");
console.log("\n# distributions");
console.log(x.summarize(distros));

// ── one resource, then its links ─────────────────────────────────────────────
const ubuntu = await x.get<Record<string, unknown>>("/ubuntu");
console.log("\n# ubuntu");
pp({ display_name: ubuntu.display_name, self: ubuntu.self_link });
console.log("\n# ubuntu links");
pp(x.links(ubuntu));

// ── typed client (autocompletes paths, params & response) ────────────────────
const { data } = await lp.GET("/distros", {});
console.log("\n# typed client total_size:", data?.total_size);
console.log("first entry:", data?.entries[0]?.display_name);
