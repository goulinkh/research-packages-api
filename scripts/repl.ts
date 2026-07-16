// Interactive Launchpad exploration REPL.
//
//   npm run repl
//
// Preloaded context:
//   lp        typed openapi-fetch client (createLaunchpadClient())
//   x         Explorer instance (untyped, hypermedia-friendly)
//   get(p)    x.get  — GET a path or absolute link -> JSON
//   collect(p)x.collect — page through a collection
//   links(v)  x.links — extract *_link fields
//   pp(v)     pretty-print with colors
//   save(v,f) x.save — write JSON under data/
//
// Top-level await works:  pp(await get("/distros"))

import repl from "node:repl";
import { createLaunchpadClient } from "../src/index.ts";
import { Explorer, pp } from "../src/explore.ts";

const lp = createLaunchpadClient();
const x = new Explorer();

console.log("Launchpad explorer — try: pp(await get('/distros'))");
console.log("context: lp, x, get, collect, links, pp, save\n");

const server = repl.start({ prompt: "lp> " });

Object.assign(server.context, {
  lp,
  x,
  pp,
  get: x.get.bind(x),
  collect: x.collect.bind(x),
  links: x.links.bind(x),
  save: x.save.bind(x),
});
