// Source package version (SPPH) https://launchpad.net/ubuntu/+source/{name}/{version}
import { type components } from "../src/index.ts";
import { lp, x, pp } from "./lib.ts";

const name = "alsa-utils";
const version = "1.2.15.2-1ubuntu1";

const { data: ubuntu } = await lp.GET("/{distribution}", {
    params: { path: { distribution: "ubuntu" } }
});

if (!ubuntu) throw new Error("distro not found");

type Archive = components["schemas"]["archive-full"];
const ubuntuMainArchive = await x.get<Archive>(ubuntu.main_archive_link);

const { data: spph } = await lp.GET(
    "/{distribution}/+archive/{archive}?ws.op=getPublishedSources",
    {
        params: {
            path: {
                distribution: ubuntu.name,
                archive: ubuntuMainArchive.name
            },
            query: {
                source_name: name,
                exact_match: "true",
                version: version
            }
        }
    }
);

if (!spph) throw new Error("source package version not found");

x.show(spph);

const publication = spph.entries[0];
if (!publication) throw new Error("no publication entry found");

console.log(
    "series",
    publication.distro_series_link,
    "pocket",
    publication.pocket
);

// SPPH has no `id` field; parse it from the self_link (…/+sourcepub/{id})
//
const publicationId = publication.self_link?.split("/").at(-1);
if (!publicationId) throw new Error("could not parse publication id");

const publicationPath = {
    distribution: ubuntu.name,
    archive: ubuntuMainArchive.name,
    id: publicationId
};

// changelogs
// the spec declares no response body for these ops, so `data` is typed
// `undefined` — at runtime it is the JSON-parsed URL string
const { data: changelogUrl } = await lp.GET(
    "/{distribution}/+archive/{archive}/+sourcepub/{id}?ws.op=changelogUrl",
    { params: { path: publicationPath } }
);
const changelog = await x.get(
    changelogUrl as unknown as string,
    undefined,
    "raw"
);

x.show(changelog);

// .changes files ?ws.op=changesFileUrl
const { data: changesFileUrl } = await lp.GET(
    "/{distribution}/+archive/{archive}/+sourcepub/{id}?ws.op=changesFileUrl",
    { params: { path: publicationPath } }
);

const changesFile = await x.get(
    changesFileUrl as unknown as string,
    undefined,
    "raw"
);

x.show(changesFile);

// source files + checksums (+1 request; sha256 only, filename parsed from URL)
const { data: sourceFiles } = await lp.GET(
    "/{distribution}/+archive/{archive}/+sourcepub/{id}?ws.op=sourceFileUrls",
    { params: { path: publicationPath, query: { include_meta: "true" } } }
);

x.show(
    sourceFiles as unknown as { url: string; size: number; sha256: string }[]
);

// source (Ubuntu) git repo — page-wide (not per row)
const { data: gitRepo } = await lp.GET("/+git?ws.op=getDefaultRepository", {
    params: {
        query: {
            target: `https://api.launchpad.net/devel/${ubuntu.name}/+source/${name}`
        }
    }
});

x.show(gitRepo);

// latest builds per series/arch — per SPPH (entries: arch_tag, buildstate, web_link)
const { data: builds } = await lp.GET(
    "/{distribution}/+archive/{archive}/+sourcepub/{id}?ws.op=getBuilds",
    { params: { path: publicationPath } }
);

x.show(builds);

// …or bulk: one request for all publications (keyed by SPPH id)
const { data: buildSummaries } = await lp.GET(
    "/{distribution}/+archive/{archive}?ws.op=getBuildSummariesForSourceIds",
    {
        params: {
            path: { distribution: ubuntu.name, archive: ubuntuMainArchive.name },
            query: { source_ids: JSON.stringify([Number(publicationId)]) }
        }
    }
);

x.show(buildSummaries as unknown as Record<string, unknown>);

// builds list + binary objects — paginated BPPH page per SPPH (entries carry
// binary_package_name, binary_package_version, distro_arch_series_link, build_link)
const { data: binaries } = await lp.GET(
    "/{distribution}/+archive/{archive}/+sourcepub/{id}?ws.op=getPublishedBinaries",
    { params: { path: publicationPath } }
);

x.show(binaries);

// binary download links — per publication (SPPH)
const { data: binaryUrls } = await lp.GET(
    "/{distribution}/+archive/{archive}/+sourcepub/{id}?ws.op=binaryFileUrls",
    { params: { path: publicationPath } }
);

x.show(binaryUrls as unknown as string[]);

// …or per binary (BPPH) with checksums. The BPPH URL is multi-segment
// (…/+binarypub/{id}) but the spec models it as a single
// {binary_package_publishing_history} param, which openapi-fetch would
// percent-encode — so follow the self_link with the untyped explorer.
const firstBinary = binaries?.entries[0];
if (firstBinary?.self_link) {
    const binaryFilesMeta = await x.get<
        { url: string; size: number; sha1: string; sha256: string }[]
    >(`${firstBinary.self_link}?ws.op=binaryFileUrls&include_meta=true`);
    x.show(binaryFilesMeta);
}

// single debdiff URL — only if you already know both versions: call on the
// OLDER publication with to_version = the newer version
const { data: allVersions } = await lp.GET(
    "/{distribution}/+archive/{archive}?ws.op=getPublishedSources",
    {
        params: {
            path: { distribution: ubuntu.name, archive: ubuntuMainArchive.name },
            query: { source_name: name, exact_match: "true" }
        }
    }
);

const previous = allVersions?.entries.find(
    (e) => e.source_package_version !== version
);
const previousId = previous?.self_link?.split("/").at(-1);
if (previous && previousId) {
    const { data: debdiffUrl, response } = await lp.GET(
        "/{distribution}/+archive/{archive}/+sourcepub/{id}?ws.op=packageDiffUrl",
        {
            params: {
                path: { ...publicationPath, id: previousId },
                query: { to_version: version }
            }
        }
    );
    console.log(
        "debdiff",
        previous.source_package_version,
        "→",
        version,
        response.ok
            ? (debdiffUrl as unknown as string)
            : `not found (${response.status})`
    );
}
