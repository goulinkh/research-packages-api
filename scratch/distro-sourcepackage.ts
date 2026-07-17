import { lp, x, pp } from "./lib.ts";
import type { components } from "../src/schema/devel.ts";

// page:
// {distro}/+source/{package}

type Archive = components["schemas"]["archive-full"];

// // option 1a: direct access
// const { data: ubuntuSourcePackage } = await lp.GET(
//     "/{distribution}/+source/{source}",
//     {
//         params: {
//             path: {
//                 distribution: "ubuntu",
//                 source: "alsa-utils"
//             }
//         }
//     }
// );

// if (!ubuntuSourcePackage) throw new Error("source package not found");

// x.show(ubuntuSourcePackage);

// // option 1b: via series (still direct)
// const { data: ubuntuSeriesSourcePackage } = await lp.GET(
//     "/{distribution}/{series}/+source/{source}",
//     {
//         params: {
//             path: {
//                 distribution: "ubuntu",
//                 series: "resolute",
//                 source: "alsa-utils"
//             }
//         }
//     }
// );

// if (!ubuntuSeriesSourcePackage) throw new Error("series source package not found");

// x.show(ubuntuSeriesSourcePackage);

const { data: ubuntu } = await lp.GET("/{distribution}", {
    params: { path: { distribution: "ubuntu" } }
});

if (!ubuntu) throw new Error("distro not found");

const { data: resolute } = await lp.GET("/{distribution}/{series}", {
    params: {
        path: { distribution: ubuntu.name, series: "resolute" }
    }
});

if (!resolute) throw new Error("series not found");

const ubuntuMainArchive = await x.get<Archive>(ubuntu.main_archive_link);

// x.show(ubuntuMainArchive);

const { data: ubuntuSeriesSourcePackage } = await lp.GET(
    "/{distribution}/+archive/{archive}?ws.op=getPublishedSources",
    {
        params: {
            path: {
                distribution: ubuntu.name,
                archive: ubuntuMainArchive.name
            },
            query: {
                distro_series: resolute.self_link,
                exact_match: "true",
                source_name: "alsa-utils"
            }
        }
    }
);

if (!ubuntuSeriesSourcePackage)
    throw new Error("series source package not found");

// x.show(ubuntuSeriesSourcePackage);

// or "/{distribution}/{series}/+source/{source}?ws.op=searchTasks
const { data: sourcePackageBugs } = await lp.GET(
    "/{distribution}/+source/{source}?ws.op=searchTasks",
    {
        params: {
            path: {
                distribution: "ubuntu",
                source: "systemd"
            },
            query: {
                // assignee: "https://api.launchpad.net/devel/~ubuntu-bugcontrol",
                // bug_subscriber: "https://api.launchpad.net/devel/~ubuntu-bugcontrol"
                order_by: "-importance"
            }
        }
    }
);

if (!sourcePackageBugs) throw new Error("source package bugs not found");

x.show(sourcePackageBugs);
