# Limit Displayed Image Height

Status: completed

Requested: 2026-09-28, by the user: limit a displayed image to at most half the available screen height while preserving its aspect ratio.

## Behavior

- A rendered image is no taller than half the visible browser viewport height.
- The image keeps its intrinsic aspect ratio when constrained, and scales down to fit its available width.
- The height limit applies to the image itself, including when it has a caption; caption height does not reduce the image's limit.
