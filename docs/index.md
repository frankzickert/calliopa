# calliopa

calliopa renders previs of spaceship shots on your computer. A previs is a short video of
a shot's movement, made as the reference a video model takes; calliopa writes it as an
mp4, with `tracks.json` (the camera and the ship on every frame) and a sidecar (what made
it) beside it.

Each kind of shot is a **module**. A module describes itself for agents and takes
parameters; calliopa's engine moves the ship and the camera and draws the frames.

## Pages

- [How modules work](templates.md)
- [The spec](spec.md): the JSON that asks for a render
- [Commands](commands.md): the JSON command line
- [MCP tools](mcp.md): the same operations for agents
- [Outputs](outputs.md): the mp4, `tracks.json` and the sidecar
- Modules: [flyby](modules/flyby.md)

## A first render

```sh
cat > flyby.json <<'EOF'
{
  "scene": {"ships": {"hero": {"model": "stand-in"}}},
  "shots": [{"module": "flyby", "roles": {"hero": "hero"}, "params": {"ship_size": "medium"}}]
}
EOF
calliopa render flyby.json -o flyby.mp4
```

calliopa answers in JSON, naming `flyby.mp4`, `flyby.tracks.json` and
`flyby.sidecar.json`. Everything runs on your machine; calliopa calls no service.
