// One-shot API explorer.
//
//   npm run explore -- <path|url> [key=value ...] [--out file.json] [--collect[=N]]
//
// Examples:
//   npm run explore -- /distros
//   npm run explore -- /people ws.op=find text=ubuntu
//   npm run explore -- /distros --collect --out distros.json
//   npm run explore -- https://api.launchpad.net/devel/ubuntu

import { Explorer, pp } from "../src/explore.ts";

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error("usage: npm run explore -- <path|url> [key=value ...] [--out file.json] [--collect[=N]]");
  process.exit(2);
}

let out: string | undefined;
let collect: number | undefined;
const params: Record<string, string> = {};
let target: string | undefined;

for (const arg of argv) {
  if (arg === "--out" || arg.startsWith("--out=")) {
    out = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : "__NEXT__";
  } else if (out === "__NEXT__") {
    out = arg;
  } else if (arg === "--collect") {
    collect = Infinity;
  } else if (arg.startsWith("--collect=")) {
    collect = Number(arg.slice("--collect=".length));
  } else if (arg.includes("=")) {
    const eq = arg.indexOf("=");
    params[arg.slice(0, eq)] = arg.slice(eq + 1);
  } else if (!target) {
    target = arg;
  } else {
    console.error(`Unexpected argument: ${arg}`);
    process.exit(2);
  }
}

if (!target || out === "__NEXT__") {
  console.error("Missing target path/url or --out value.");
  process.exit(2);
}

const explorer = new Explorer();
const url = explorer.resolve(target, params);
console.error(`GET ${url}`);

const data =
  collect !== undefined
    ? await explorer.collect(target, { max: collect, params })
    : await explorer.get(target, params);

pp(data);

const links = explorer.links(data);
if (Object.keys(links).length > 0) {
  console.error("\nlinks:");
  for (const [key, value] of Object.entries(links)) console.error(`  ${key}: ${value}`);
}

if (out) {
  const path = await explorer.save(data, out);
  console.error(`\nSaved ${path}`);
}
