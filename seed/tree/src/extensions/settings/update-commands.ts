/**
 * The three commands the Update tab shows where no updater runs on the host:
 * the README's update path. `--force` lets the fetch take a release tag that
 * was corrected after the checkout last saw it; a plain fetch keeps the tag it
 * already has, and the checkout would land on the wrong release. BO_0238_006
 */
export function updateCommands(version: string): string {
  return `cd ~/calliopa\ngit fetch --tags --force && git checkout --detach v${version}\n./install.sh`;
}
