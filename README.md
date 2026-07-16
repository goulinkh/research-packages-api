# research-packages-api

A typed TypeScript client for the [Launchpad](https://launchpad.net) web-service
API (`api.launchpad.net`), generated from the published **OpenAPI 3.0** spec.

The spec is produced by
[`goulinkh/launchpad-wadl-to-openapi`](https://github.com/goulinkh/launchpad-wadl-to-openapi)
and published to
[goulinkh.github.io/launchpad-wadl-to-openapi](https://goulinkh.github.io/launchpad-wadl-to-openapi/).
This repo turns that spec into type-safe request/response types and a thin
[`openapi-fetch`](https://github.com/openapi-ts/openapi-typescript/tree/main/packages/openapi-fetch)
client so you can call the API with full autocompletion and type checking.

## Requirements

- Node.js **>= 22.6** (runs TypeScript directly via native type stripping).

## Install

```sh
npm install
```

## Update the API types

Generation is a two-step pipeline. First the published `devel` spec is vendored
into `.api-spec/` with a provenance header (source URL + the generator repo's
resolved commit). Then `openapi-typescript` turns it into `src/schema/devel.ts`:

```sh
npm run openapi:update           # update-schema + generate-types
npm run openapi:update-schema    # fetch specs into .api-spec/
npm run openapi:generate-types   # .api-spec/*.yaml -> src/schema/*.ts
```

The fetch script is configurable via environment variables:
`LP_SPEC_REPO_URL`, `LP_SPEC_BRANCH`, `LP_SPEC_PAGES_URL`, `LP_API_VERSIONS`.

## Usage

```ts
import { createLaunchpadClient } from "research-packages-api";

// Default: production launchpad.net, API version "devel".
const lp = createLaunchpadClient();

const { data, response } = await lp.GET("/distros", {});
if (!data) throw new Error(`HTTP ${response.status}`);

for (const entry of data.entries ?? []) {
  console.log((entry as { name?: string }).name);
}
```

### Options

| Option         | Default          | Description                                                      |
| -------------- | ---------------- | --------------------------------------------------------------- |
| `instance`     | `launchpad.net`  | Launchpad instance; API host `api.<instance>` is derived.        |
| `token`        | —                | OAuth token, sent as `Authorization: OAuth <token>`.             |
| `fetchOptions` | —                | Extra `openapi-fetch` options (custom `fetch`, headers, …).      |

The client is fully typed: `GET`/`POST` paths, path/query params, and response
bodies all come from the generated `src/schema/devel.ts`.

## Exploration

Launchpad is a hypermedia API — resources link to one another via `*_link`
fields. The `Explorer` (untyped, accepts arbitrary paths and absolute links) and
two CLI entry points make poking around easy.

### One-shot: `explore`

```sh
npm run explore -- /distros                       # GET + pretty JSON + discovered links
npm run explore -- /people ws.op=find text=ubuntu # named operation with query params
npm run explore -- /distros --collect --out distros.json  # page a collection, save under data/
npm run explore -- https://api.launchpad.net/devel/ubuntu # follow an absolute link
```

`key=value` args become query params; `--collect[=N]` follows
`next_collection_link` pages (up to `N` entries); `--out <file>` writes pretty
JSON (relative paths land under `data/`, which is git-ignored).

### Interactive: `repl`

```sh
npm run repl
lp> pp(await get("/distros"))              # fetch + pretty-print
lp> const u = await get("/ubuntu")         # top-level await works
lp> links(u)                               # { self_link, ..._collection_link, ... }
lp> console.log(x.summarize(await get("/distros")))   # compact one-line-per-entry
lp> save(await collect("/distros"), "distros.json")   # persist under data/
```

Preloaded context: `lp` (typed client), `x` (`Explorer`), and the bound helpers
`get`, `collect`, `links`, `pp`, `save`. Set `LP_TOKEN` for authenticated calls.

Programmatic use:

```ts
import { Explorer, pp } from "research-packages-api";

const x = new Explorer({ token: process.env.LP_TOKEN });
pp(await x.get("/distros"));
const all = await x.collect("/distros", { max: 100 });
```

## Scripts

```sh
npm run openapi:update   # vendor the devel spec + regenerate src/schema/devel.ts
npm run typecheck        # tsc --noEmit
npm run explore -- ...   # one-shot API explorer (see Exploration)
npm run repl             # interactive exploration REPL
npm run example          # run examples/list-distributions.ts against the live API
```

## Authentication

Anonymous access covers all public read (`GET`) endpoints. Write operations and
private data need a Launchpad OAuth token; pass it via `token`. See the
[Launchpad API authentication docs](https://help.launchpad.net/API/SigningRequests).

## License

AGPL-3.0-or-later (same as Launchpad).
