# Architecture Dashboard (3D)

A real-time 3D visualisation of an abstracted AI agent assisted workflow architecture — service nodes
rendered as glowing, translucent "ice crystal" geometries floating in fog,
with soft shadows, ACES tone-mapping, and free orbit/zoom. Three.js loaded
from CDN; otherwise vanilla JS + CSS, no build step.

<p>
  <img src="assets/img/angle-front.png" width="32%" alt="Front view — central pyramid with orbiting service nodes">
  <img src="assets/img/angle-orbit.png" width="32%" alt="Elevated three-quarter view of the scene">
  <img src="assets/img/angle-low.png" width="32%" alt="Low wide view through the drifting triangle field">
</p>

## Viewing it

**Easiest — live demo, nothing to install:**

**<https://earlyprototype.github.io/crucible-demoscene/architecture-dashboard/>**

Drag to rotate, scroll to zoom, click to focus on a node.

**Running it locally:**

1. Download the **whole repository** (green **Code** button → **Download ZIP**, then unzip) or `git clone` it. Saving `index.html` on its own won't work — the page needs the `assets/` folder beside it.
2. Open a terminal **inside the `architecture-dashboard/` folder** and start any static server:

   ```bash
   python -m http.server 8080
   ```

3. Open <http://localhost:8080> in your browser.

Either way you need an internet connection — Three.js and fonts load from a CDN. If the scene fails to load, a message now appears on the page saying what went wrong.

## Original context

This was originally one of two views in a live ops dashboard for v0.7 (the
other was a 2D node-graph with real health-checks and data-flow particles).
Only the 3D scene survived the cut here — it's the part that was pure
spectacle rather than monitoring, and stands on its own without the rest of
v0.7's backend. `3d-architecture.js` is otherwise unmodified from the
original.
