# Pangea Earth

A Google Earth-inspired, interactive 3D globe for exploring Pangea and continental drift.

**Live website:** https://turtlebotdev.github.io/pangea-earth/

## Explore

- Rotate, pan, tilt, and zoom the globe, including views close to the surface.
- Smooth time scrubbing and play/pause from 300 Ma to today, with forward/reverse playback and three speeds.
- Project modern NASA imagery onto continental pieces and watch it move with them.
- Six ancient geography snapshots with reconstructed shorelines and paleo-elevation: 300, 260, 240, 200, 160, and 0 million years ago.
- Fly to seven reconstructed continental locations, including India.
- Switch to NASA Blue Marble modern satellite imagery.
- Toggle coordinates and continent labels; use automatic rotation.
- Desktop and touch layouts, with keyboard-accessible controls.

## Scientific scope

The **ancient geography snapshots** use Scotese & Wright (2018) PALEOMAP PaleoDEMs: reconstructed estimates of land, shallow seas, elevation, and ocean depth. Shorelines follow the reconstructed zero-elevation contour. The published 0.2° grids are filtered/resampled from regional data (their metadata specifies a 400 km Gaussian filter). They do **not** provide 22 km geological accuracy; small features, Tasmania, and local connections around Australia are not resolved precisely. Colors and relief shading are computed from source elevations. PALEOMAP label positions are reconstructed in the PALEOMAP reference frame.

**Smooth continental motion** comes from the **Müller et al. (2022) mantle-reference-frame plate motion model**, accessed through the GPlates Web Service. The coastline geometries are reconstructed modern coastlines. They are **not** time-specific ancient shorelines and do not account for ancient sea level, vegetation, mountains, cities, or local paleo-environments. The shortcuts reconstruct representative present-day interior points rather than continent centroids.

The untextured **motion surface** is illustrative procedural shading. The untextured motion colors and patterns are artistic. Zooming does not add geological evidence. There is no measured ancient satellite imagery. The geography view shades estimated paleo-elevations, but the 3D globe itself is an ellipsoid. The animation uses a spherical overview surface and limits zoom to 200 km view height. The ancient geography camera permits approximately 1.5 km minimum view height, but closer zoom magnifies the same regional raster; it cannot reveal more geological evidence. Legacy illustrative tile code and original coastline files remain in the repository for reference.

The **Satellite today** layer displays NASA's Blue Marble satellite-derived composite with shaded topography and bathymetry (approximately 500 m native resolution), served by NASA EOSDIS GIBS. It shows modern Earth only, and is a historical composite, not live satellite imagery. Imagery is limited to service zoom level 8; zooming further magnifies existing pixels.

The timeline uses GPU rotation of simplified continental meshes. Finite rotations are bundled every 5 Ma and interpolated with quaternion slerp at animation frames; sampled positions are tested against the original GPlates coordinates. Geographic time is linear, playback stops at endpoints, and scrubbing pauses playback. Continental pieces respect source validity ranges. This shows rigid continental motion, not the complete creation/subduction of oceanic crust or continental deformation. The six age shortcuts return to PALEOMAP ancient geography snapshots. Because the two datasets use different models/reference frames, positions can shift when switching views.

The projected satellite layer attaches a bundled 4096×2048 NASA Blue Marble composite to the **modern geographic coordinates** of the moving meshes. It shows today’s terrain transported by plate rotations, not actual ancient terrain or coastlines. Its displayed texture resolution is coarser than the streamed modern imagery layer.

Different models and reference frames produce different positions. This is an educational explorer, not a replacement for GPlates research workflows.

## Run locally

Requires Python 3 to serve the static files:

```sh
python3 -m http.server 4173
```

Open http://localhost:4173. No application build, account, or API key is required. WebGL and an internet connection are needed for the Cesium engine, fonts, and modern imagery. Reconstruction files are bundled locally.

Browser verification:

```sh
npm ci
npx playwright install chromium
npm run check
npm test
```

## Hosting

The GitHub Actions workflow stages only public website assets, uploads the Pages artifact, and deploys it through GitHub Pages. Pushes to `main` and manual workflow runs trigger deployment. Developer dependencies, screenshots, and test output are excluded from the deployment artifact.

## Sources and credits

- Müller, R. D., Flament, N., Cannon, J., Tetley, M. G., Williams, S. E., Cao, X., Bodur, Ö. F., Zahirovic, S., and Merdith, A. (2022). *A tectonic-rules-based mantle reference frame since 1 billion years ago – implications for supercontinent cycles and plate–mantle system evolution*. Solid Earth 13, 1127–1159. https://doi.org/10.5194/se-13-1127-2022
- Model data: https://zenodo.org/records/13636799 (CC BY 4.0). Reconstruction GeoJSON files are derived outputs with coordinates unchanged, serialized compactly; fetched on October 7, 2026 using `model=MULLER2022`, anchor plate 0. Dataset terms are separate from the application's MIT license.
- Scotese, C. R. & Wright, N. M. (2018), *PALEOMAP Paleodigital Elevation Models (PaleoDEMs) for the Phanerozoic*, CC BY 4.0: https://doi.org/10.5281/zenodo.5460860 and https://www.earthbyte.org/paleodem-resource-scotese-and-wright-2018/
- GPlates service and API documentation: https://gwsdoc.gplates.org/
- NASA Blue Marble, NASA Earth Observatory, NASA EOSDIS GIBS, and GEBCO: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
- Geological time labels: https://stratigraphy.org/chart/
- CesiumJS 1.146 (Apache 2.0): https://cesium.com/platform/cesiumjs/
- DM Sans and Manrope fonts via Google Fonts (SIL Open Font License).

Application code is licensed under MIT. External data, fonts, and libraries retain their respective terms.

## Reproduce new data assets

`scripts/prepare-motion.py MODEL.zip` extracts and simplifies coastlines from the published Müller et al. (2022) archive, then fetches time-keyed quaternions to avoid the service’s unordered grouped-array response. It uses only the Python standard library. The bundled rotation data needs no live service during playback.

`scripts/prepare-paleogeography.py PALEODEM.zip` renders the six matching published 0.2° grids with an elevation palette and elevation-derived shading. It requires `netCDF4`, `numpy`, and `Pillow`; it preserves grid coordinates and does not create synthetic fine detail. The source file names and processing history are recorded in `data/paleogeography.json`.

The bundled satellite projection was retrieved through NASA GIBS WMS with `LAYERS=BlueMarble_ShadedRelief_Bathymetry`, `SRS=EPSG:4326`, `BBOX=-180,-90,180,90`, `WIDTH=4096`, `HEIGHT=2048`, and JPEG output.
