import { qas, pp } from "./lib.ts";

// qastaging only — production has no searchTasksCounts.
// docs: https://goulinkh.github.io/launchpad-wadl-to-openapi/qastaging/
//
// Bug task counts grouped by status and importance, computed server-side. The
// point of the operation is that it replaces paging every task out of
// searchTasks just to count them: one request, no entries in the response.
//
// Available on every bug target: /{distribution}, /{distribution}/{series},
// /{distribution}/+source/{source}, /{project}, /{milestone}, /bugs, …

/**
 * Response body of `searchTasksCounts`.
 *
 * The WADL declares no return type, so the generated spec leaves the body
 * permissive and the client types it `unknown`. This is what it actually
 * returns; `by_status` and `by_importance` include zero-count values.
 */
interface TaskCounts {
    total: number;
    by_status: Record<string, number>;
    by_importance: Record<string, number>;
}

/** Drop zero-count buckets so the interesting rows are readable. */
function nonZero(counts: Record<string, number>): Record<string, number> {
    return Object.fromEntries(
        Object.entries(counts).filter(([, count]) => count > 0)
    );
}

// ── whole distribution ───────────────────────────────────────────────────────
// No status filter: Launchpad counts only *unresolved* tasks, so the resolved
// buckets (FIXRELEASED, INVALID, WONTFIX, …) stay at zero.
const { data: ubuntu, response: ubuntuResponse } = await qas.GET(
    "/{distribution}?ws.op=searchTasksCounts",
    { params: { path: { distribution: "ubuntu" } } }
);

if (!ubuntu) throw new Error(`ubuntu counts: HTTP ${ubuntuResponse.status}`);

const ubuntuCounts = ubuntu as TaskCounts;

console.log("\n# ubuntu — open bug tasks");
pp({
    total: ubuntuCounts.total,
    by_status: nonZero(ubuntuCounts.by_status),
    by_importance: nonZero(ubuntuCounts.by_importance)
});

// ── narrowed by status ───────────────────────────────────────────────────────
// `status` is a single value here. Launchpad accepts the parameter repeated for
// a list, which the typed client cannot express (the spec types it `string`) —
// use `xq.get("/ubuntu?ws.op=searchTasksCounts&status=Confirmed&status=Triaged")`
// for that.
const { data: triaged } = await qas.GET(
    "/{distribution}?ws.op=searchTasksCounts",
    {
        params: {
            path: { distribution: "ubuntu" },
            query: { status: "Triaged" }
        }
    }
);

console.log("\n# ubuntu — triaged only");
pp({ total: (triaged as TaskCounts | undefined)?.total });

// ── one source package ───────────────────────────────────────────────────────
const { data: alsaUtils } = await qas.GET(
    "/{distribution}/+source/{source}?ws.op=searchTasksCounts",
    {
        params: {
            path: { distribution: "ubuntu", source: "alsa-utils" }
        }
    }
);

const alsaCounts = alsaUtils as TaskCounts | undefined;

console.log("\n# ubuntu/+source/alsa-utils");
pp({
    total: alsaCounts?.total,
    by_importance: alsaCounts ? nonZero(alsaCounts.by_importance) : undefined
});

// ── tagged bugs across the distro ────────────────────────────────────────────
const { data: tagged } = await qas.GET(
    "/{distribution}?ws.op=searchTasksCounts",
    {
        params: {
            path: { distribution: "ubuntu" },
            query: { tags: "rls-nn-incoming", tags_combinator: "Any" }
        }
    }
);

console.log("\n# ubuntu — tag rls-nn-incoming");
pp({ total: (tagged as TaskCounts | undefined)?.total });
