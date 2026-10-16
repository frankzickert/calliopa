# The spec

A spec is one JSON object that asks for a render.

| Field | Meaning | Default and bounds |
| --- | --- | --- |
| `seed` | an integer recorded in the sidecar; the source of any randomness | 0 |
| `fps` | frames per second | 24; from 1 to 30 |
| `width` | frame width in pixels | 1280; even, from 64 to 3840 |
| `height` | frame height in pixels | 720; even, from 64 to 3840 |
| `scene` | `{"ships": {<name>: {"model": "stand-in"}}}`: the scene's ships | required |
| `shots` | a list of exactly one shot: `{"module", "roles", "params"}` | required |

The aspect, `width / height`, lies between 1:3 and 3:1. Unknown fields are refused. The
shot's `module` names an available module, `roles` binds each of the module's roles to a
ship of the scene, and `params` sets the module's parameters
([how modules work](templates.md)).

```json
{
  "seed": 1,
  "fps": 24,
  "width": 1920,
  "height": 1080,
  "scene": {"ships": {"hero": {"model": "stand-in"}}},
  "shots": [{"module": "flyby", "roles": {"hero": "hero"}, "params": {"duration": 6, "ship_size": "small"}}]
}
```

## Errors

calliopa answers every problem of a spec at once. Each error names where it is, what is
wrong, the value and what is allowed:

```json
{"errors": [{"path": "shots[0].params.duration", "error": "out_of_range", "value": 400, "min": 2, "max": 30,
  "message": "duration is from 2 to 30 s"}]}
```

The errors are `invalid_json`, `unknown_field`, `missing`, `wrong_type`, `out_of_range`,
`not_even` and `unknown_value`.
