// Smoke example: list Launchpad distributions from the live API.
//
//   node --experimental-strip-types examples/list-distributions.ts
//   npm run example

import { createLaunchpadClient } from "../src/index.ts";

const lp = createLaunchpadClient({ version: "devel" });

// `/distros` is the top-level collection of distributions.
const { data, response } = await lp.GET("/distros", {});

if (!data) {
  console.error(`Request failed: HTTP ${response.status}`);
  process.exit(1);
}
// Collection pages expose `total_size` and untyped `entries` records.
const entries = data.entries ?? [];
console.log(`total_size: ${data.total_size ?? entries.length}`);
for (const entry of entries.slice(0, 10)) {
  const distro = entry as { name?: string; display_name?: string };
  console.log(`- ${distro.display_name ?? distro.name} (${distro.name})`);
}
