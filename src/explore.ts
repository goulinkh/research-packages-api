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

/** Max length for a string field before `summarize` truncates it. */
const SUMMARY_STRING_MAX = 120;

/** Number of items kept at each end of a long array before `summarize` elides. */
const SUMMARY_ARRAY_EDGE = 3;

/**
 * Prepare a value for {@link Explorer.summarize}: drop `*_link` fields and
 * truncate long strings so the inspected output stays compact.
 */
function sanitizeForSummary(value: unknown): unknown {
    if (typeof value === "string") {
        return value.length > SUMMARY_STRING_MAX
            ? `${value.slice(0, SUMMARY_STRING_MAX)}… (${value.length} chars)`
            : value;
    }
    if (Array.isArray(value)) {
        const items = value.map(sanitizeForSummary);
        if (items.length <= SUMMARY_ARRAY_EDGE * 2 + 1) return items;
        const omitted = items.length - SUMMARY_ARRAY_EDGE * 2;
        return [
            ...items.slice(0, SUMMARY_ARRAY_EDGE),
            `… ${omitted} more …`,
            ...items.slice(-SUMMARY_ARRAY_EDGE)
        ];
    }
    if (typeof value === "object" && value !== null) {
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            if (key.endsWith("_link")) continue;
            out[key] = sanitizeForSummary(val);
        }
        return out;
    }
    return value;
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
            fetch: fetchImpl = globalThis.fetch
        } = options;

        this.baseUrl = `https://api.${instance}/${version}`;
        this.#fetch = fetchImpl;
        this.#headers = {
            Accept: "application/json",
            ...(token ? { Authorization: `OAuth ${token}` } : {})
        };
    }

    /** Resolve a path (relative to the API root) or absolute URL to a full URL, with optional query params. */
    resolve(
        pathOrUrl: string,
        params?: Record<string, string | number | boolean>
    ): string {
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
        contentType: "json" | "raw" = "json"
    ): Promise<T> {
        const url = this.resolve(pathOrUrl, params);
        const res = await this.#fetch(url, {
            headers: this.#headers,
            redirect: "follow"
        });
        const body = await res.text();
        if (!res.ok) {
            throw new Error(
                `GET ${url} -> ${res.status} ${res.statusText}\n${body.slice(0, 500)}`
            );
        }
        if (!body) return undefined as T;
        if (contentType === "raw") return body as unknown as T;
        return (body ? JSON.parse(body) : undefined) as T;
    }

    /**
     * Follow a paginated collection, accumulating `entries` across pages until
     * `max` is reached or there are no more pages.
     */
    async collect(
        pathOrUrl: string,
        options: {
            max?: number;
            params?: Record<string, string | number | boolean>;
        } = {}
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
            if (key.endsWith("_link") && typeof val === "string")
                out[key] = val;
        }
        return out;
    }

    /**
     * A compact one-line-per-entry view of a collection: index, `name`/`display_name`
     * if present, and `self_link`. Handy for eyeballing large lists.
     */
    summarize(value: unknown): string {
        if (!isCollection(value))
            return inspect(sanitizeForSummary(value), {
                depth: 4,
                colors: true
            });
        const entries = value.entries ?? [];
        const head = `total_size: ${value.total_size ?? entries.length} (showing ${entries.length})`;
        const rows = entries.map((entry, i) => {
            const e = entry as Record<string, unknown>;
            const label =
                e.display_name ??
                e.name ??
                e.title ??
                e.self_link ??
                "<entry>";
            return `  [${i}] ${String(label)}${e.self_link ? `  ${e.self_link}` : ""}`;
        });
        return [head, ...rows].join("\n");
    }

    /**
     * Print a resource straight to stdout as `bat`-style blocks — one titled,
     * line-numbered panel per category (`summary`, then `links`) — so callers
     * don't wrap it in `console.log`. An explicit `label` overrides the name
     * derived from the resource.
     */
    show(value: unknown, label?: string): void {
        const name = label ?? resourceName(value);
        const blocks: [string, string][] = [
            [name ? `summary: ${name}` : "summary", this.summarize(value)]
        ];
        const links = this.links(value);
        if (Object.keys(links).length > 0) {
            const body = Object.entries(links)
                .map(([key, url]) => `${key}: ${url}`)
                .join("\n");
            blocks.push([name ? `links: ${name}` : "links", body]);
        }
        for (const [title, body] of blocks)
            console.log(renderBlock(title, body));
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

/** Dim (bright-black) ANSI wrapper for the frame and gutter. */
function dim(text: string): string {
    return `\x1b[90m${text}\x1b[0m`;
}

/** Best human-readable name of a resource, if one of the usual fields is set. */
function resourceName(value: unknown): string | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const record = value as Record<string, unknown>;
    for (const key of ["display_name", "displayname", "name", "title"]) {
        const candidate = record[key];
        if (typeof candidate === "string" && candidate) return candidate;
    }
    return undefined;
}

/** Color a leading `key:` (object field or link name) cyan. */
function colorKey(line: string): string {
    return line.replace(
        /^(\s*)([A-Za-z_][\w.-]*)(:)/,
        (_m, indent, key, colon) => `${indent}\x1b[36m${key}\x1b[0m${colon}`
    );
}

/**
 * Render a single `bat`-style panel: a titled header and line-numbered body,
 * with a gutter separator and horizontal rules that span the terminal width.
 */
function renderBlock(title: string, body: string): string {
    const lines = body.split("\n");
    const gutter = Math.max(3, String(lines.length).length);
    const total = process.stdout.columns || 80;
    const rule = (join: string) => {
        const right = Math.max(0, total - gutter - 3);
        return dim(
            `${"\u2500".repeat(gutter + 2)}${join}${"\u2500".repeat(right)}`
        );
    };
    const rows = lines.map((line, i) => {
        const n = String(i + 1).padStart(gutter);
        return `${dim(` ${n} \u2502`)} ${colorKey(line)}`;
    });
    return [
        rule("\u252c"),
        `${dim(` ${" ".repeat(gutter)} \u2502`)} \x1b[1m${title}\x1b[0m`,
        rule("\u253c"),
        ...rows,
        rule("\u2534")
    ].join("\n");
}
