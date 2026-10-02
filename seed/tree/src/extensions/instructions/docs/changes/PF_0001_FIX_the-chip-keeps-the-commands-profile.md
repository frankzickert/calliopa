# The Chip Keeps The Command's Profile

Status: idea

The profile chosen in a block's chip is lost when the chip is drawn again. The chip starts a
command with the profile the person last sent with in the document, and it sets that profile on the
command each time it mounts — so a person who chooses *VideoProfile*, leaves the block and comes
back finds *Create Img* again, and *Send* carries it. Found in `calliopa-bootstrap`'s `BO_0336`
video walk on 2026-10-02 (run `arun-39457a3fba3ed9b1`, sent under *Create Img*).

## What Is Asked

* A profile chosen for a command stays chosen until the person chooses another or sends. Requested
  by the user, 2026-10-02.

## Proposed Shape

- `ProfileChip` reads the command's options (`ui.shell`'s `BO_0336_051`, `commandOptions`): when
  the command already carries a `profile`, the chip shows that one and sets nothing; it restores the
  person's last only for a command carrying none. Choosing *No profile* is kept as a choice too.
- A test in `views/views.test.ts`: a profile chosen, the chip drawn again, the choice kept and sent.

## Functional Questions

- [ ] PF_0001_Q1 After *Send*, does the next command in the same block start with the profile just
      sent (the person's last) or keep the one chosen before? Proposed: the person's last, which is
      the profile just sent, as now.

## Boundaries

- `profiles` alone (`views/chip.tsx`).
- Release notes: *Fixed* — a profile chosen in a block's chip no longer switches back to the last
  one used when the block is left and opened again.
