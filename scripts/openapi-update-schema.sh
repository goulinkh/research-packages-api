#!/usr/bin/env sh
set -eu

# Fetch the Launchpad OpenAPI specs published by launchpad-wadl-to-openapi and
# save them under .api-spec/ with a provenance header.
#
# The specs are generated from the live Launchpad WADL and published to GitHub
# Pages by https://github.com/goulinkh/launchpad-wadl-to-openapi. We pin the
# provenance to the generator repo's current commit so a saved spec is traceable.
#
# One Pages site carries every instance: production at the root, qastaging under
# /qastaging/. LP_INSTANCE selects which one to vendor, and the local .api-spec/
# layout mirrors the published one so the two never overwrite each other.
#
# The commit alone does not identify a spec's content: each deploy regenerates
# from the live instance, so the same commit can publish different specs over
# time, and qastaging drifts faster than production.

repo_url=${LP_SPEC_REPO_URL:-https://github.com/goulinkh/launchpad-wadl-to-openapi}
branch=${LP_SPEC_BRANCH:-main}
pages_base=${LP_SPEC_PAGES_URL:-https://goulinkh.github.io/launchpad-wadl-to-openapi}
versions=${LP_API_VERSIONS:-"devel"}
instance=${LP_INSTANCE:-launchpad.net}

case "$instance" in
   launchpad.net) subpath= ;;
   qastaging.launchpad.net) subpath=/qastaging ;;
   *)
      printf '%s\n' "Error: no spec published for instance '$instance'" >&2
      printf '%s\n' "Published instances: launchpad.net, qastaging.launchpad.net" >&2
      exit 1
      ;;
esac

ref="refs/heads/$branch"
sha=$(git ls-remote "$repo_url" "$ref" | cut -f1)

if [ -z "$sha" ]; then
   printf '%s\n' "Error: could not resolve $repo_url $ref" >&2
   exit 1
fi

spec_dir=".api-spec$subpath"
mkdir -p "$spec_dir"

for version in $versions; do
   output="$spec_dir/launchpad-$version.yaml"
   spec_url="$pages_base$subpath/launchpad-$version.openapi.yaml"

   {
      echo "# Source: $spec_url"
      echo "# Instance: $instance"
      echo "# Generator: $repo_url @ $sha ($branch)"
      curl -fSL "$spec_url"
   } > "$output"

   echo "Saved $output ($instance $version) @ $sha ($branch)"
done
