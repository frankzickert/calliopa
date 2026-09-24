#!/bin/sh
# Install pre-seeding entrypoint (BO_0090_003). The install script mounts the
# release's seed bundle into the kernel container and runs this with the
# stack's gateway base URL (BO_0101_005): first the extension meta-schema
# install profile, then the exported bundled extensions through the kernel's
# own commit path — everything under the installer's human provenance,
# everything through CCGW, no bypass path. The tree and the members sidecar
# commit as one change set (BO_0196_001).
#
# The import runs on every invocation, including an update (BO_0197_002). What
# differs is the posture, decided by whether this graph already holds the
# release's marker extension:
#
#   fresh install  no bundled extension yet; nothing exists to overwrite, so
#                  the import lands as accepted truth and is promoted as the
#                  instance's first release pin — the shell serves right after
#                  `up` rather than idling on the fallback scaffold.
#   update         the graph holds established content this instance's own
#                  human accepted. The import stages a proposal instead, so
#                  nothing lands without their review (`docs/extending.md`),
#                  and the pin is left where it is until they accept.
#
# An instance holds at most one open update (BO_0242_001). An update whose
# release already has an open proposal stages nothing: the diff is against
# accepted truth, so a second run would stage the same content again. An open
# proposal for any other release is superseded — this release's diff carries
# everything it would have brought — and is rejected before this one stages.
#
# Either way an up-to-date install produces an empty change set and stages
# nothing: `kernel commit` reports nothing to commit and exits 0, which is how
# "already applied" is decided — by the diff, not by a version marker.
set -eu

base="${1:?usage: run.sh <ccgw-base-url>}"
here="$(cd "$(dirname "$0")" && pwd)"
# The owner's account, the one human the core knows (BO_0206): the hook acts
# as it, presenting the token the bootstrap wrote under credentials/.
principal="${CALLIOPA_OWNER_PRINCIPAL:-owner}"
secret_dir="${CALLIOPA_SECRET_DIR:-/run/secrets/calliopa}"
# Without it every write below would be refused; fail here, naming the path,
# rather than after a half-applied seed. BO_0215_001
if [ ! -f "$secret_dir/credentials/$principal" ]; then
  echo "pre-seed: no credential for the owner '$principal' at $secret_dir/credentials/$principal;" >&2
  echo "pre-seed: the bootstrap writes it — check CALLIOPA_OWNER_PRINCIPAL matches the name it was given" >&2
  exit 1
fi
CALLIOPA_CREDENTIAL="$(cat "$secret_dir/credentials/$principal")"
export CALLIOPA_CREDENTIAL

echo "pre-seed: extension meta-schema (install profile)"
node "$here/ccgw.mjs" apply "$base" "$principal" "$here/meta-schema"

marker="$(node "$here/ccgw.mjs" field "$here/bundle.json" marker)"
map_root="$(node "$here/ccgw.mjs" field "$here/bundle.json" mapRoot)"
pin="$(node "$here/ccgw.mjs" field "$here/bundle.json" pin)"
version="$(node "$here/ccgw.mjs" field "$here/bundle.json" version)"

if node "$here/ccgw.mjs" exists "$base" "$principal" ext.manifest "$marker"; then
  updating=1
  echo "pre-seed: updating bundled extensions to release $version (dogfood pin $pin)"
  open_updates="$(node "$here/ccgw.mjs" updates "$base" "$principal")"
  waiting="$(printf '%s\n' "$open_updates" | awk -v v="$version" '$2 == v { print $1; exit }')"
  if [ -n "$waiting" ]; then
    echo "pre-seed: release $version's update proposal $waiting is already waiting for review; staging nothing"
    echo "pre-seed: accept it in Calliopa, then promote it to serve the new release"
    echo "pre-seed complete"
    exit 0
  fi
  printf '%s\n' "$open_updates" | while read -r proposal older; do
    [ -n "$proposal" ] || continue
    echo "pre-seed: rejecting release $older's update proposal $proposal, superseded by release $version"
    kernel proposal reject "$proposal" --ccgw "$base" --principal "$principal" \
      -m "superseded by release $version"
  done
else
  updating=0
  echo "pre-seed: importing bundled extensions (release $version, dogfood pin $pin)"
fi

# The commit needs a baseline against *this* graph, so a checkout establishes
# the lockfile first and the exported files land over it — additions on a fresh
# graph, a diff against what is already established on an update. The bundle
# mount is read-only, so the work happens in a temp copy.
tmp="$(mktemp -d)"
kernel checkout --tree "$tmp" --ccgw "$base" --pin head --principal "$principal"

# What this install already holds, read from the baseline checkout before the
# release's tree lands (BO_0283_005). The release decides how an extension
# *arrives*: its activation answer applies to an extension this install has
# never seen, and never to one whose switch the owner has already had a chance
# to set. On a fresh install this list is empty, so the answer applies whole.
seen_before=""
for dir in "$tmp"/src/extensions/*/; do
  [ -d "$dir" ] || continue
  seen_before="$seen_before $(basename "$dir") "
done

# Make the release authoritative for what it ships, so a file or an extension
# it stopped carrying reaches this install as a deletion instead of lingering
# forever (BO_0197_003). Every *bundled* extension is cleared from the baseline
# tree before the overlay: whatever this release still carries comes straight
# back, and whatever it dropped stays gone. Extensions marked `individual` —
# this instance's own — are never touched, which is the whole reason the
# clearing is keyed on the category rather than on the release's list.
for dir in "$tmp"/src/extensions/*/; do
  [ -d "$dir" ] || continue
  [ -f "$dir/manifest.json" ] || continue
  category="$(node -e 'process.stdout.write(String(require(process.argv[1]).category || "individual"))' "$dir/manifest.json")"
  if [ "$category" = "bundled" ]; then
    rm -rf "$dir"
  fi
done
# Root-mapped files belong to exactly one bundled extension — the release guard
# refuses anything else — so they are cleared on the same terms, at any depth:
# every lockfile file outside src/extensions/ is root-mapped, since a file that
# is not materializes under its extension's directory, and only an elevated
# extension may stage one. A shell file a release moved elsewhere is then a
# deletion rather than a leftover that no longer builds (BO_0259_001). They are
# read from the lockfile rather than from the directory listing, because the
# tree also holds files no Block owns.
node -e 'const l=require(process.argv[1]);for(const k of Object.keys(l.files||{})) if(!k.startsWith("src/extensions/")) console.log(k)' \
  "$tmp/graph.lock.json" | while IFS= read -r rootfile; do
  [ -n "$rootfile" ] && rm -f "$tmp/$rootfile"
done

# The exported lockfile maps files to the dogfood graph and is provenance only;
# this graph's own lockfile is the commit's baseline, so it is kept aside while
# the release's files land over the cleared tree.
mv "$tmp/graph.lock.json" "$tmp/.baseline.lock.json"
cp -R "$here/tree/." "$tmp/"
mv "$tmp/.baseline.lock.json" "$tmp/graph.lock.json"

# The members sidecar rides in the same change set as the tree: an extension's
# sources and its vocabulary, skills and declarations arrive together or not at
# all. A release that carried none has no file here and --members is simply
# omitted. BO_0196_001
members_arg=""
[ -f "$here/members.json" ] && members_arg="$here/members.json"

if [ "$updating" -eq 1 ]; then
  kernel commit --tree "$tmp" --ccgw "$base" \
    --principal "$principal" \
    ${map_root:+--map-root "$map_root"} \
    ${members_arg:+--members "$members_arg"} \
    -m "calliopa update: bundled extensions from release $version (dogfood pin $pin)"
else
  kernel commit --tree "$tmp" --ccgw "$base" --truth \
    --principal "$principal" \
    ${map_root:+--map-root "$map_root"} \
    ${members_arg:+--members "$members_arg"} \
    -m "calliopa install pre-seed: bundled extensions from release $version (dogfood pin $pin)"
fi
rm -rf "$tmp"

# The release's activation answer (BO_0283_005). `kernel extension deactivate
# --arriving` writes kernel.extensionstate as the owner — the write the shell's
# own create and import paths make — so the extension appears in the Extensions
# section switched off, with its own control to switch it on. --no-promote
# leaves the pin exactly where the branches above left it. An id this install
# has already seen is passed over: the owner's switch is theirs. --arriving is
# what makes the update branch work: there the extension stands in a proposal
# nobody has accepted, so it is not established and the ordinary verb would
# refuse it; the state is written ahead of it and takes effect the moment the
# owner accepts.
node "$here/ccgw.mjs" list "$here/bundle.json" inactive | while IFS= read -r ext_id; do
  [ -n "$ext_id" ] || continue
  case "$seen_before" in
    *" $ext_id "*)
      echo "pre-seed: $ext_id is already installed here; leaving its switch alone"
      continue
      ;;
  esac
  echo "pre-seed: $ext_id arrives switched off"
  kernel extension deactivate "$ext_id" --arriving --no-promote --ccgw "$base" --principal "$principal"
done

# The answer is written before the promotion below, not after it: the
# materializer reads kernel.extensionstate *at the release pin*
# (extensionstate.ReadAt), so a state written after the pin was promoted would
# not be seen at it and the extension would arrive switched on after all.
# Pin promotion (BO_0197_004). A fresh install promotes the imported truth so
# the kernel serves the shell immediately; build-before-promote applies, so a
# release that does not build leaves the pin unset and the kernel on its
# fallback scaffold rather than serving a broken tree. An update promotes
# nothing: its content is a proposal, and the instance keeps serving its
# current pin until a human accepts and promotes. That ordering is what makes
# a bad release unable to take a running instance down.
if [ "$updating" -eq 1 ]; then
  echo "pre-seed: update staged for review; the instance keeps serving its current pin"
  echo "pre-seed: accept the proposal in Calliopa, then promote it to serve the new release"
elif kernel pin --ccgw "$base" | grep -q "^release pin:"; then
  echo "pre-seed: release pin already set; leaving it"
else
  echo "pre-seed: promoting the imported truth as the first release pin"
  kernel pin --to head --ccgw "$base" --principal "$principal" \
    -m "install pre-seed: release $version"
fi

echo "pre-seed complete"
