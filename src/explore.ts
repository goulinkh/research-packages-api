import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { inspect } from "node:util";

/** Launchpad API version segment. */
export type LaunchpadVersion = "1.0" | "beta" | "devel";

export interface ExplorerOptions {
  /** Launchpad instance host; API host `api.<instance>` is derived. Default `launchpad.net`. */
  instance?: string;
  /** API version path segment. Default `devel`. */
  version?: LaunchpadVersion;
  /** OAuth token, sent as `Authorization: OAuth <token>`. Falls back to `LP_TOKEN`. */
  token?: string;
  /** Custom fetch implementation (defaults to global `fetch`). */
  fetch?: typeof fetch;
}

/** A shape common to Launchpad collection ("page") resources. */
export interface CollectionPage {
  start?: number;
  total_size?: number;
  entries?: unknown[];
  next_collection_link?: string;
  prev_collection_link?: string;
  [key: string]: unknown;
}

function isCollection(value: unknown): value is CollectionPage {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as CollectionPage).entries)
  );
}

/**
 * A thin, untyped client for interactively exploring the Launchpad hypermedia
 * API: fetch any path or absolute resource link, page through collections, and
 * discover the `*_link` fields that lead to the next resource.
 *
 * Unlike the typed {@link createLaunchpadClient}, `Explorer` accepts arbitrary
 * paths and absolute URLs — the right trade-off for spelunking, where you don't
 * yet know the shape.
 */
export class Explorer {
  readonly baseUrl: string;
  readonly #headers: Record<string, string>;
  readonly #fetch: typeof fetch;

  constructor(options: ExplorerOptions = {}) {
    const {
      instance = "launchpad.net",
      version = "devel",
      token = process.env.LP_TOKEN,
      fetch: fetchImpl = globalThis.fetch,
    } = options;

    this.baseUrl = `https://api.${instance}/${version}`;
    this.#fetch = fetchImpl;
    this.#headers = {
      Accept: "application/json",
      ...(token ? { Authorization: `OAuth ${token}` } : {}),
    };
  }

  /** Resolve a path (relative to the API root) or absolute URL to a full URL, with optional query params. */
  resolve(pathOrUrl: string, params?: Record<string, string | number | boolean>): string {
    const base = /^https?:\/\//.test(pathOrUrl)
      ? pathOrUrl
      : `${this.baseUrl}/${pathOrUrl.replace(/^\/+/, "")}`;
    if (!params || Object.keys(params).length === 0) return base;
    const url = new URL(base);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  /** GET a path or absolute link and return the parsed JSON body. Throws on non-2xx. */
  async get<T = unknown>(
    pathOrUrl: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<T> {
    const url = this.resolve(pathOrUrl, params);
    const res = await this.#fetch(url, { headers: this.#headers });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`GET ${url} -> ${res.status} ${res.statusText}\n${body.slice(0, 500)}`);
    }
    return (body ? JSON.parse(body) : undefined) as T;
  }

  /**
   * Follow a paginated collection, accumulating `entries` across pages until
   * `max` is reached or there are no more pages.
   */
  async collect(
    pathOrUrl: string,
    options: { max?: number; params?: Record<string, string | number | boolean> } = {},
  ): Promise<unknown[]> {
    const { max = Infinity, params } = options;
    const entries: unknown[] = [];
    let next: string | undefined = this.resolve(pathOrUrl, params);
    while (next && entries.length < max) {
      const page: CollectionPage = await this.get<CollectionPage>(next);
      if (!isCollection(page)) break;
      entries.push(...(page.entries ?? []));
      next = page.next_collection_link;
    }
    return entries.slice(0, max === Infinity ? undefined : max);
  }

  /** Extract the `*_link` fields from a resource so you can drill down. */
  links(value: unknown): Record<string, string> {
    if (typeof value !== "object" || value === null) return {};
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.endsWith("_link") && typeof val === "string") out[key] = val;
    }
    return out;
  }

  /**
   * A compact one-line-per-entry view of a collection: index, `name`/`display_name`
   * if present, and `self_link`. Handy for eyeballing large lists.
   */
  summarize(value: unknown): string {
    if (!isCollection(value)) return inspect(value, { depth: 4, colors: false });
    const entries = value.entries ?? [];
    const head = `total_size: ${value.total_size ?? entries.length} (showing ${entries.length})`;
    const rows = entries.map((entry, i) => {
      const e = entry as Record<string, unknown>;
      const label = e.display_name ?? e.name ?? e.title ?? e.self_link ?? "<entry>";
      return `  [${i}] ${String(label)}${e.self_link ? `  ${e.self_link}` : ""}`;
    });
    return [head, ...rows].join("\n");
  }

  /** Persist a value as pretty JSON. Relative paths land under `data/`. */
  async save(value: unknown, file: string): Promise<string> {
    const target = /^(\/|\.\/|\.\.\/)/.test(file) ? file : `data/${file}`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(value, null, 2));
    return target;
  }
}

/** Pretty-print any value to stdout with colors and generous depth. */
export function pp(value: unknown, depth = 6): void {
  console.log(inspect(value, { depth, colors: true, maxArrayLength: 50 }));
}
