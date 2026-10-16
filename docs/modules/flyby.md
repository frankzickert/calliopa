# flyby

A ship approaches the camera, misses it closely, and as it passes the camera turns to
follow it as it flies on. The camera holds one point beside the ship's path and pans after
it, trailing it slightly.

**When to use it:** for a near miss that sells a single ship's speed and size: the ship
grows from far ahead, sweeps past on the camera's left, and is followed as it leaves. Not
for formations, chases or a camera that travels with the ship.

## Roles

| Role | Kind | Required | |
| --- | --- | --- | --- |
| `hero` | ship | yes | the ship that passes the camera |

## Parameters

| Parameter | Type | Default | Range | |
| --- | --- | --- | --- | --- |
| `duration` | number, s | 6 | 2 to 30 | the shot's length in seconds |
| `pass_at` | number, fraction | 0.4 | 0.2 to 0.8 | when the near miss happens, as a fraction of the duration; lower gives a short approach and a long follow |
| `ship_size` | enum | small | small, medium, large | small is 15 m long, medium 60 m, large 250 m; the hull always clears the camera by 25 m, so a larger ship passes farther away |

The ship flies at 80 m/s, 6 m below the camera, with a 40° horizontal field of view.

```json
{"module": "flyby", "roles": {"hero": "hero"}, "params": {"duration": 8, "pass_at": 0.3, "ship_size": "medium"}}
```

[How modules work](../templates.md)
