import { ContinentalMotion } from '../motion.js';

/** Fail at the HTTP boundary, rather than passing an error page to JSON.parse. */
export async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

export async function loadPlaces() {
  const [modern, ancient] = await Promise.all([
    fetchJson('data/places.json'),
    fetchJson('data/paleo-places.json'),
  ]);
  return { modern, ancient };
}

export function createSnapshotProvider(Cesium, age, mode) {
  if (mode === 'modern') {
    return new Cesium.UrlTemplateImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default//GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
      maximumLevel: 8,
      credit: 'NASA Blue Marble · NASA EOSDIS GIBS · GEBCO',
    });
  }
  return Cesium.SingleTileImageryProvider.fromUrl(`assets/paleogeography-${age}.jpg`, {
    credit: 'Scotese & Wright (2018) PALEOMAP PaleoDEMs · CC BY 4.0 · Regional estimates',
  });
}

/** Cache the expensive mesh preparation and share concurrent load requests.
 * Failed requests clear the cache so the next user action can retry.
 */
export function createMotionLoader(Cesium, viewer) {
  let pending;
  return function loadMotion() {
    if (!pending) {
      pending = prepareMotion(Cesium, viewer).catch((error) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}

async function prepareMotion(Cesium, viewer) {
  const data = await fetchJson('data/motion.json');
  const image = new Image();
  image.src = 'assets/modern-satellite.jpg';
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  context.fillStyle = '#183644';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const oceanProvider = await Cesium.SingleTileImageryProvider.fromUrl(canvas.toDataURL(), {
    credit:
      'Continental motion: Müller et al. (2022), GPlates · Surface illustration / optional NASA Blue Marble projection',
  });

  // Create primitives last: earlier failures must not leave a duplicate mesh
  // in the scene when a subsequent action retries this loader.
  const motion = new ContinentalMotion(Cesium, viewer, data, image);
  return { motion, oceanProvider };
}
