# Pangea Earth

A Google Earth-inspired, interactive 3D globe for exploring Pangea and continental drift.

**Live website:** https://turtlebotdev.github.io/pangea-earth/

## Explore

- Rotate, pan, tilt, and zoom the globe, including views close to the surface.
- Six reconstructed snapshots: 300, 260, 240, 200, 160, and 0 million years ago.
- Fly to seven reconstructed continental locations, including India.
- Switch to NASA Blue Marble modern satellite imagery.
- Toggle coordinates and continent labels; use automatic rotation.
- Desktop and touch layouts, with keyboard-accessible controls.

## Scientific scope

Continental positions come from the **Müller et al. (2022) mantle-reference-frame plate motion model**, accessed through the GPlates Web Service. The coastline geometries are reconstructed modern coastlines. They are **not** time-specific ancient shorelines and do not account for ancient sea level, vegetation, mountains, cities, or local paleo-environments. The shortcuts reconstruct representative present-day interior points rather than continent centroids.

The ancient surface is **illustrative procedural shading**. All apparent ridges, colors, fine detail, and ice coloring are artistic. Zooming generates higher-resolution illustration, not higher-resolution geological evidence. There is no measured ancient satellite imagery and no reconstructed 3D elevation; the surface is an ellipsoid. The camera allows approximately 1.5 km minimum view height; illustration tiles stop at level 10, and source coastline precision remains unchanged at every zoom.

The **Satellite today** layer displays NASA's Blue Marble satellite-derived composite with shaded topography and bathymetry (approximately 500 m native resolution), served by NASA EOSDIS GIBS. It shows modern Earth only, and is a historical composite, not live satellite imagery. Imagery is limited to service zoom level 8; zooming further magnifies existing pixels.

The time machine shows discrete snapshots, not continuous animated plate motion. Different models and reference frames produce different positions. This is an educational explorer, not a replacement for GPlates research workflows.

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
- GPlates service and API documentation: https://gwsdoc.gplates.org/
- NASA Blue Marble, NASA Earth Observatory, NASA EOSDIS GIBS, and GEBCO: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
- Geological time labels: https://stratigraphy.org/chart/
- CesiumJS 1.146 (Apache 2.0): https://cesium.com/platform/cesiumjs/
- DM Sans and Manrope fonts via Google Fonts (SIL Open Font License).

Application code is licensed under MIT. External data, fonts, and libraries retain their respective terms.
