// Fetch one published Ubuntu binary package, save its Launchpad metadata, and
// download its Debian package files.
//
// Usage:
//   node --experimental-strip-types scratch/binary-package.ts <package> [series] [arch] [version]
// Example:
//   node --experimental-strip-types scratch/binary-package.ts hello noble amd64

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { components } from "../src/schema/devel.ts";
import { assertDefined, lp, pp, x } from "./lib.ts";

type Archive = components["schemas"]["archive-full"];
type BinaryFile = {
    url: string;
    size: number;
    sha1: string;
    sha256: string;
};

const [binaryName, seriesName = "noble", architecture = "amd64", version] =
    process.argv.slice(2);

if (!binaryName) {
    throw new Error(
        "usage: binary-package.ts <package> [series] [arch] [version]"
    );
}

const { data: ubuntu } = await lp.GET("/{distribution}", {
    params: { path: { distribution: "ubuntu" } }
});
assertDefined(ubuntu, "Ubuntu distribution not found");
assertDefined(ubuntu.main_archive_link, "Ubuntu main archive link not found");

const { data: series } = await lp.GET("/{distribution}/{series}", {
    params: {
        path: { distribution: ubuntu.name, series: seriesName }
    }
});
assertDefined(series, `Ubuntu series ${seriesName} not found`);

const { data: distroArchSeries } = await lp.GET(
    "/{distribution}/{series}/{arch}",
    {
        params: {
            path: {
                distribution: ubuntu.name,
                series: seriesName,
                arch: architecture
            }
        }
    }
);
assertDefined(
    distroArchSeries,
    `Ubuntu ${seriesName}/${architecture} architecture not found`
);

const archive = await x.get<Archive>(ubuntu.main_archive_link);
const { data: publications, response } = await lp.GET(
    "/{distribution}/+archive/{archive}?ws.op=getPublishedBinaries",
    {
        params: {
            path: { distribution: ubuntu.name, archive: archive.name },
            query: {
                binary_name: binaryName,
                exact_match: "true",
                status: "Published",
                distro_series: series.self_link,
                distro_arch_series: distroArchSeries.self_link,
                order_by: "published_date_desc",
                ...(version ? { version } : {})
            }
        }
    }
);
assertDefined(
    publications,
    `binary publication search failed with HTTP ${response.status}`
);

const publication = publications.entries[0];
assertDefined(
    publication,
    `no published ${binaryName}${version ? ` ${version}` : ""} binary found for Ubuntu ${seriesName}/${architecture}`
);
assertDefined(publication.self_link, "binary publication link not found");

const files = await x.get<BinaryFile[]>(publication.self_link, {
    "ws.op": "binaryFileUrls",
    include_meta: true
});
const debFiles = files.filter(({ url }) => /\.(?:deb|udeb|ddeb)$/.test(new URL(url).pathname));
if (debFiles.length === 0) {
    throw new Error("binary publication has no Debian package files");
}

const outputDirectory = join(
    "data",
    "binary-packages",
    safePathSegment(publication.binary_package_name),
    safePathSegment(publication.binary_package_version),
    safePathSegment(architecture)
);
await mkdir(outputDirectory, { recursive: true });

const downloadedFiles: string[] = [];
for (const file of debFiles) {
    const filename = basename(new URL(file.url).pathname);
    const target = join(outputDirectory, filename);
    await downloadVerified(file, target);
    downloadedFiles.push(target);
}

const metadataPath = join(outputDirectory, "metadata.json");
await writeFile(
    metadataPath,
    `${JSON.stringify({ publication, files }, null, 2)}\n`
);

x.show(publication, "binary publication metadata");
pp(files);
console.log("metadata:", metadataPath);
console.log("downloaded:", downloadedFiles.join("\n            "));

function safePathSegment(value: string): string {
    return value.replace(/[^A-Za-z0-9._+~-]/g, "_");
}

async function downloadVerified(file: BinaryFile, target: string): Promise<void> {
    const response = await fetch(file.url, { redirect: "follow" });
    if (!response.ok || !response.body) {
        throw new Error(
            `GET ${file.url} -> ${response.status} ${response.statusText}`
        );
    }

    const temporaryTarget = `${target}.part`;
    const sha256 = createHash("sha256");
    let size = 0;
    const verifier = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            size += chunk.length;
            sha256.update(chunk);
            callback(null, chunk);
        }
    });

    try {
        await pipeline(
            Readable.fromWeb(response.body),
            verifier,
            createWriteStream(temporaryTarget)
        );
        const digest = sha256.digest("hex");
        if (size !== file.size) {
            throw new Error(
                `${basename(target)} size mismatch: expected ${file.size}, got ${size}`
            );
        }
        if (digest !== file.sha256) {
            throw new Error(
                `${basename(target)} SHA-256 mismatch: expected ${file.sha256}, got ${digest}`
            );
        }
        await rename(temporaryTarget, target);
    } catch (error) {
        await rm(temporaryTarget, { force: true });
        throw error;
    }
}
