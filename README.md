# Crucible Showcase

Two pieces of visual work salvaged from **Project Crucible v0.7** — a paused,
multi-agent AI framework built July–November 2025. Both were functional
artifacts of that project (a boot sequence, a live monitoring dashboard) that
ended up as small pieces of terminal/web art in their own right. Extracted
here on their own, decoupled from the rest of v0.7's backend.

## The pieces

### [`cortex-boot-sequence/`](cortex-boot-sequence/)
A three-part terminal animation for "Cortex" (the memory/reasoning module):
a green pixel-dissolve intro, a blue boot-up sequence, a red shutdown. Pure
Python, no dependencies beyond the standard library.

![demo](cortex-boot-sequence/demo.gif)

### [`architecture-dashboard/`](architecture-dashboard/)
A Three.js scene of the system's services rendered as glowing, translucent
"ice crystal" geometries floating in fog, with soft shadows and free
orbit/zoom. Originally one view inside a live 2D+3D monitoring dashboard;
only the 3D scene — the part that was pure spectacle — survived the cut.

**[▶ View it live](https://earlyprototype.github.io/crucible-demoscene/architecture-dashboard/)** — no install needed.

## Provenance

Both pulled from `components/cortex/` and `landing/` in the original v0.7
tree. No backend, orchestration, or other v0.7 machinery is required to run
either — that's the point of pulling them out.
