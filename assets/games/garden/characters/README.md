# Garden character prototype

Open `games/characters.html` to inspect the two original models, their rigged
poses, and mobile orbit controls. This independent preview does not import the
garden's gameplay, authentication or saved data.

`garden-characters.glb` contains the characters `syue` and `ling`, each with a
16-bone skeleton. Hair ribbons, clothing, face details and accessories are built
from original geometry. Skin weights blend the elbows and knees; the preview
drives the bones for idle, walking, waving and watering. The GLB does not contain
baked animation clips. Integrating it into the garden's existing actions is a
separate step after the prototype's appearance is accepted.

Rebuild with Blender 4.3 or later, from the repository root:

```sh
blender -b --python scripts/build-garden-characters.py
```

Run browser checks with Node.js, Playwright, Chromium and Python 3 installed:

```sh
node scripts/test-garden-characters.cjs
```

The test uses an isolated local server and fresh browser contexts, verifies real
bone movements and camera controls, tests portrait/landscape layouts and touch
zoom, and exercises the loading-error UI. Screenshots are written to `/tmp`.
The models are preview-quality assets; their styling, skinning and mobile budget
should be revisited with the complete garden scene before production integration.
