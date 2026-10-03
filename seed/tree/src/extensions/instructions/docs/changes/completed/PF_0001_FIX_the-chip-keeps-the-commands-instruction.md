# The Chip Keeps The Command's Instruction

Status: completed

The instruction chosen in a block's chip is lost when the chip is drawn again. The chip starts a
command with the instruction the person last sent with in the document, and it sets that
instruction on the command each time it mounts — so a person who chooses *VideoProfile*, leaves the
block and comes back finds *Create Img* again, and *Send* carries it. Found in `calliopa-bootstrap`'s
`BO_0336` video walk on 2026-10-02 (run `arun-39457a3fba3ed9b1`, sent under *Create Img*).

## What Is Asked

* An instruction chosen for a command stays chosen until the person chooses another or sends.
  Requested by the user, 2026-10-02.
* After *Send*, the command in that block keeps the instruction it was sent with, even when the
  person has since sent with another one elsewhere in the document; the person's last starts only a
  command that carries no choice, as on a fresh page. User decision, 2026-10-03 (`PF_0001_Q1`).

## Proposed Shape

- `InstructionChip` reads the command's options (`ui.shell`'s `BO_0336_051`, `commandOptions`): when
  the command already carries an `instruction`, the chip shows that one and sets nothing; it
  restores the person's last only for a command carrying no choice.
- *No instruction* is kept as a choice too. The shell drops an option set to nothing (`withOption`),
  so the chip marks the choice in an option of its own beside `instruction`, which the runs route
  does not read; a command carrying the mark and no `instruction` stays at *No instruction*.
- The shell already keeps a command's options after *Send* (`afterSend` clears only those set for
  one send), so the decision on `PF_0001_Q1` needs nothing beyond the chip reading them.
- A test in `views/views.test.ts`: an instruction chosen, the chip drawn again, the choice kept and
  sent; *No instruction* chosen over a remembered last, the chip drawn again, still none.

## Boundaries

- `instructions` alone (`views/chip.tsx`).
- Release notes: *Fixed* — an instruction chosen in a block's chip no longer switches back to the
  last one used when the block is left and opened again.
