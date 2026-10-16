# Outputs

`calliopa render spec.json -o out.mp4` writes three files.

## out.mp4

The previs: H.264 at the spec's size and frame rate, encoded by your ffmpeg. Its bytes
depend on your ffmpeg's version, so it is not hashed.

## out.tracks.json

The camera and the ship on every frame, so an agent can check framing without looking at
pixels. A header names `format` (1), `fps`, `width`, `height`, `ship_length` in metres and
`pass_frame`, the frame of closest approach. Then `frames`, one per line:

```json
{"frame": 0, "t": 0.000000, "shot": "flyby",
 "ship": {"position": [0.000000, 0.000000, 0.000000], "rotation": [0.000000, 1.000000, 0.000000, 0.000000]},
 "camera": {"position": [-30.250000, 6.000000, -192.000000], "rotation": [...], "hfov": 40.000000}}
```

Positions are in metres with Y up; rotations are unit quaternions `[x, y, z, w]` in glTF's
convention (a ship faces +Z, a camera looks along −Z); `hfov` is the horizontal field of
view in degrees. Every number has six decimals, so the same spec gives the same bytes on
every machine.

## out.sidecar.json

What made the render: `format` (1), the `seed`, the `engine` version, the `modules` used,
each with its `name`, `version` and `sha256`, and `tracks_sha256`, the hash of
`out.tracks.json`. Rendering the spec again and getting another tracks hash means the
modules changed.
