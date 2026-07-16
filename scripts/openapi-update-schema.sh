#!/usr/bin/env sh
set -eu

# Fetch the Launchpad OpenAPI specs published by launchpad-wadl-to-openapi and
# save them under .api-spec/ with a provenance header.
#
# The specs are generated from the live Launchpad WADL and published to GitHub
# Pages by https://github.com/goulinkh/launchpad-wadl-to-openapi. We pin the
# provenance to the generator repo's current commit so a saved spec is traceable.

repo_url=${LP_SPEC_REPO_URL:-https://github.com/goulinkh/launchpad-wadl-to-openapi}
branch=${LP_SPEC_BRANCH:-main}
pages_base=${LP_SPEC_PAGES_URL:-https://goulinkh.github.io/launchpad-wadl-to-openapi}
versions=${LP_API_VERSIONS:-"devel"}

ref="refs/heads/$branch"
sha=$(git ls-remote "$repo_url" "$ref" | cut -f1)

if [ -z "$sha" ]; then
   printf '%s\n' "Error: could not resolve $repo_url $ref" >&2
   exit 1
fi

mkdir -p .api-spec

for version in $versions; do
   output=".api-spec/launchpad-$version.yaml"
   spec_url="$pages_base/launchpad-$version.openapi.yaml"

   {
      echo "# Source: $spec_url"
      echo "# Generator: $repo_url @ $sha ($branch)"
      curl -fSL "$spec_url"
   } > "$output"

   echo "Saved $output ($version) @ $sha ($branch)"
done
