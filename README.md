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

## Scripts

```sh
npm run openapi:update   # vendor the devel spec + regenerate src/schema/devel.ts
npm run typecheck        # tsc --noEmit
npm run example          # run examples/list-distributions.ts against the live API
```

## Authentication

Anonymous access covers all public read (`GET`) endpoints. Write operations and
private data need a Launchpad OAuth token; pass it via `token`. See the
[Launchpad API authentication docs](https://help.launchpad.net/API/SigningRequests).

## License

AGPL-3.0-or-later (same as Launchpad).
