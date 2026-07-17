import { lp, x, pp } from "./lib.ts";
import type { components } from "../src/schema/devel.ts";

// page:
// {distro}/+source

type Archive = components["schemas"]["archive-full"];

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

// docs: https://goulinkh.github.io/launchpad-wadl-to-openapi/#devel/tag/archive/GET/{distribution}/+archive/{archive}?ws.op=getPublishedSources
const { data: ubuntuPublishedSourcePackages } = await lp.GET(
    "/{distribution}/+archive/{archive}?ws.op=getPublishedSources",
    {
        params: {
            path: {
                distribution: ubuntu.name,
                archive: ubuntuMainArchive.name
            },
            query: {
                // optional series filter
                distro_series: resolute.self_link,
                // optional pocket filter
                order_by: "published_date_desc"
            }
        }
    }
);

x.show(ubuntuPublishedSourcePackages);
