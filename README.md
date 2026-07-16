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

## Generate the API types

Types are generated from the live published specs (versions `1.0`, `beta`,
`devel`) into `src/schema/`:

```sh
npm run generate            # all versions
node scripts/generate.mjs devel   # a single version
```

## Usage

```ts
import { createLaunchpadClient } from "research-packages-api";

// Default: production launchpad.net, API version "devel".
const lp = createLaunchpadClient({ version: "devel" });

const { data, error } = await lp.GET("/distributions");
if (error) throw error;

for (const distro of data.entries ?? []) {
  console.log(distro.name);
}
```

### Options

| Option         | Default          | Description                                                      |
| -------------- | ---------------- | --------------------------------------------------------------- |
| `version`      | `devel`          | API version: `1.0`, `beta`, or `devel`. Selects the typed paths. |
| `instance`     | `launchpad.net`  | Launchpad instance; API host `api.<instance>` is derived.        |
| `token`        | —                | OAuth token, sent as `Authorization: OAuth <token>`.             |
| `fetchOptions` | —                | Extra `openapi-fetch` options (custom `fetch`, headers, …).      |

The client is fully typed per version: `GET`/`POST` paths, path/query params,
and response bodies all come from the generated `src/schema/<version>.ts`.

## Scripts

```sh
npm run generate     # regenerate src/schema/*.ts from the published specs
npm run typecheck    # tsc --noEmit
npm run example      # run examples/list-distributions.ts against the live API
```

## Authentication

Anonymous access covers all public read (`GET`) endpoints. Write operations and
private data need a Launchpad OAuth token; pass it via `token`. See the
[Launchpad API authentication docs](https://help.launchpad.net/API/SigningRequests).

## License

AGPL-3.0-or-later (same as Launchpad).
