# How modules work

A module is one kind of shot, such as a flyby. It is data, not code: a manifest that says
what the shot is and what it takes, and a motion that tells calliopa's engine which path
the ship flies and how the camera behaves. The engine evaluates every module the same way,
so a shot looks the same on every machine.

## What a module declares

- **Name and version.** A module has a name and a semantic version, and names the engine
  versions it runs on.
- **Summary and when to use it.** Written for agents, so an agent can choose the module
  that fits what you asked for.
- **Roles.** The things in the scene a module moves, such as `hero`, the ship that passes
  the camera. A spec binds each role to a ship of its scene.
- **Parameters.** What you can set. Each has a type, a default and a description:
  - a **number** has a unit and a range, such as a duration in seconds from 2 to 30;
  - an **enum** has a fixed set of values, such as `small`, `medium` and `large`.

  A parameter you leave out takes its default; a value outside its range is refused,
  naming the parameter and what it allows.

## How a spec uses a module

A [spec](spec.md) names its scene's ships and one shot. The shot names the module, binds
its roles to the scene's ships and sets its parameters:

```json
{"module": "flyby", "roles": {"hero": "hero"}, "params": {"duration": 8, "pass_at": 0.3}}
```

`calliopa describe <module>` (or the MCP tool `describe`) answers a module's whole
declaration. Every module's page lists its parameters: [flyby](modules/flyby.md).

## What calliopa guarantees

- The same spec and the same modules give the same `tracks.json`, byte for byte, on every
  machine; the sidecar records the module versions and their hashes.
- A module never reads files, the network or the clock. Randomness comes only from the
  spec's seed.
