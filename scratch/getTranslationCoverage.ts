import { qas, xq, pp } from "./lib.ts";
import type { components } from "../src/schema/qastaging/devel.ts";

// qastaging only — production has neither the operation nor the collection.
// docs: https://goulinkh.github.io/launchpad-wadl-to-openapi/qastaging/
//
// Per-language translation statistics for a distro series. Two routes to the
// same data:
//
//   1. /{distribution}/{series}?ws.op=getTranslationCoverage  — accepts order_by
//   2. distroseries.translation_coverage_collection_link      — plain collection
//
// Only visible languages are returned, and the series must expose translations:
// a series with them hidden answers 503 "Translation page is not available"
// (ubuntu/hoary does; ubuntu/trusty does not).

type Coverage = components["schemas"]["distro_series_language-full"];

const DISTRIBUTION = "ubuntu";
const SERIES = "trusty";

/**
 * Read a numeric statistic off a coverage entry.
 *
 * The WADL gives these fields no type, so the spec — and the generated client —
 * call them `string`, while the API sends JSON numbers. Coercing here keeps the
 * arithmetic honest whichever one turns up.
 */
function stat(value: string | number | undefined): number {
    return Number(value ?? 0);
}

// ── route 1: the named operation, best translated first ──────────────────────
// `order_by` takes language_name, language_code, translated_percentage,
// contributor_count, or date_updated; prefix with "-" for descending, and a
// stable language-code order breaks remaining ties.
const { data: page, response } = await qas.GET(
    "/{distribution}/{series}?ws.op=getTranslationCoverage",
    {
        params: {
            path: { distribution: DISTRIBUTION, series: SERIES },
            query: { order_by: "-translated_percentage" }
        }
    }
);

if (!page) {
    throw new Error(
        `getTranslationCoverage ${DISTRIBUTION}/${SERIES}: HTTP ${response.status}`
    );
}

const top = (page.entries ?? []).slice(0, 10);

console.log(`\n# ${DISTRIBUTION}/${SERIES} — best translated (first page)`);
pp(
    top.map((entry: Coverage) => ({
        language: `${entry.language_name} (${entry.language_code})`,
        translated: `${stat(entry.translated_percentage)}%`,
        contributors: stat(entry.contributor_count),
        updated: entry.date_updated?.slice(0, 10)
    }))
);

// The operation's page carries `total_size_link`, not an inline `total_size` —
// the count costs a query, so Launchpad only computes it when asked.
const totalSize = await xq.get<number>(
    `/${DISTRIBUTION}/${SERIES}?ws.op=getTranslationCoverage&ws.show=total_size`
);
console.log(`\n# languages with statistics: ${totalSize}`);

// Multiple sort fields: Launchpad wants the parameter *repeated*, not a
// comma-separated value (`order_by=a,b` answers 400 "Unrecognized order_by").
// The spec types order_by as a single string, so the typed client cannot spell
// that — drop to the explorer for it.
const multiSorted = await xq.get<{ entries?: Coverage[] }>(
    `/${DISTRIBUTION}/${SERIES}?ws.op=getTranslationCoverage` +
        `&order_by=-contributor_count&order_by=language_name`
);
console.log("\n# most contributors, then language name");
pp(
    (multiSorted.entries ?? []).slice(0, 5).map((entry) => ({
        language: entry.language_code,
        contributors: stat(entry.contributor_count)
    }))
);

// ── route 2: the collection link off the series ──────────────────────────────
// No order_by, but the page does carry an inline `total_size`. Reach it the
// hypermedia way, from the series resource itself.
const { data: series } = await qas.GET("/{distribution}/{series}", {
    params: { path: { distribution: DISTRIBUTION, series: SERIES } }
});

if (!series) throw new Error("series not found");

const collection = await xq.get<{ total_size?: number; entries?: Coverage[] }>(
    series.translation_coverage_collection_link
);

console.log(`\n# via translation_coverage_collection_link`);
pp({
    link: series.translation_coverage_collection_link,
    total_size: collection.total_size,
    first_page: collection.entries?.length
});

// ── what the numbers say ─────────────────────────────────────────────────────
// Paged in full so the aggregate covers every language, not just page one.
const all = (await xq.collect(
    series.translation_coverage_collection_link
)) as Coverage[];

const fullyTranslated = all.filter(
    (entry) => stat(entry.translated_percentage) === 100
);
const contributors = all.reduce(
    (sum, entry) => sum + stat(entry.contributor_count),
    0
);

console.log(`\n# ${DISTRIBUTION}/${SERIES} — aggregate`);
pp({
    languages: all.length,
    fully_translated: fullyTranslated.length,
    total_contributors: contributors,
    median_percentage: median(all.map((e) => stat(e.translated_percentage)))
});

/** Median of a numeric list; 0 for an empty one. */
function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
        : (sorted[mid] ?? 0);
}
