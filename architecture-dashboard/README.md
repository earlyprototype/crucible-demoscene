# Architecture Dashboard (3D)

A real-time 3D visualisation of an abstracted AI agent assisted workflow architecture — service nodes
rendered as glowing, translucent "ice crystal" geometries floating in fog,
with soft shadows, ACES tone-mapping, and free orbit/zoom. Three.js loaded
from CDN; otherwise vanilla JS + CSS, no build step.

*Screenshots pending.*

## Viewing it

Static files, so any local server works:

```bash
python -m http.server 8080
# open http://localhost:8080
```

Drag to rotate, scroll to zoom, click to focus on a node.

## Original context

This was originally one of two views in a live ops dashboard for v0.7 (the
other was a 2D node-graph with real health-checks and data-flow particles).
Only the 3D scene survived the cut here — it's the part that was pure
spectacle rather than monitoring, and stands on its own without the rest of
v0.7's backend. `3d-architecture.js` is otherwise unmodified from the
original.
