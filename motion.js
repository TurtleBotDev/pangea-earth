/**
 * Rigid continental motion from GPlates finite rotations.
 *
 * Dataset contract (data/motion.json):
 * - times: ascending sample ages in millions of years before present.
 * - rotations: plate ID -> one [w, x, y, z] quaternion per sample age.
 * - features: { pid, begin, end, rings }, with rings in [longitude, latitude].
 * - placePids: plate IDs corresponding to the place catalogue order.
 *
 * Modern geographic coordinates are rotated on a sphere, rather than a WGS84
 * ellipsoid, so rigid transformations preserve the mesh shape. This is a
 * continental illustration, not a model of deformation or ancient coastlines.
 */
const DEGREES_TO_RADIANS = Math.PI / 180;
const SPHERE_RADIUS_METERS = 6428137;
const NEAR_PARALLEL_DOT = 0.9995;

/** Spherical interpolation follows the shortest rotation between two samples.
 * GPlates stores scalar-first quaternions; Cesium's constructor is scalar-last.
 */
export function slerp(start, end, fraction) {
  let dot = start.reduce((sum, value, index) => sum + value * end[index], 0);
  let target = end;
  // q and -q describe the same orientation. Choose the closest representation
  // to avoid a long spin when consecutive samples have opposite signs.
  if (dot < 0) {
    target = end.map((value) => -value);
    dot = -dot;
  }
  if (dot > NEAR_PARALLEL_DOT) {
    // The trigonometric form becomes unstable near zero angle.
    const result = start.map((value, index) => value + (target[index] - value) * fraction);
    const length = Math.hypot(...result);
    return result.map((value) => value / length);
  }
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  const denominator = Math.sin(angle);
  const startWeight = Math.sin((1 - fraction) * angle) / denominator;
  const endWeight = Math.sin(fraction * angle) / denominator;
  return start.map((value, index) => value * startWeight + target[index] * endWeight);
}

/** Clamp to the dataset extent; locate the actual sample interval rather than
 * assuming all future datasets have five-million-year spacing.
 */
export function rotationAt(data, plateId, age) {
  const samples = data.rotations[String(plateId)];
  if (!samples) {
    throw new Error(`Missing plate rotation ${plateId}`);
  }
  const times = data.times;
  if (age <= times[0]) {
    return samples[0];
  }
  if (age >= times.at(-1)) {
    return samples.at(-1);
  }

  let lower = 0;
  let upper = times.length - 1;
  while (upper - lower > 1) {
    const middle = Math.floor((lower + upper) / 2);
    if (times[middle] <= age) {
      lower = middle;
    } else {
      upper = middle;
    }
  }
  const fraction = (age - times[lower]) / (times[upper] - times[lower]);
  return slerp(samples[lower], samples[upper], fraction);
}

/** Continue the most recent modeled stage rotation at a fixed angular velocity.
 * This is a what-if extrapolation, not a published future reconstruction.
 * Compose a powered stage quaternion with today's absolute orientation.
 */
export function futureRotationAt(data, plateId, age) {
  if (age >= 0) {
    return rotationAt(data, plateId, age);
  }
  const samples = data.rotations[String(plateId)];
  if (!samples) {
    throw new Error(`Missing plate rotation ${plateId}`);
  }
  const recent = samples[0];
  const older = samples[1];
  const inverseOlder = [older[0], -older[1], -older[2], -older[3]];
  let stage = multiplyQuaternions(recent, inverseOlder);
  if (stage[0] < 0) {
    stage = stage.map((value) => -value);
  }
  const axisLength = Math.hypot(...stage.slice(1));
  if (axisLength < 1e-12) {
    return recent;
  }
  const halfAngle = Math.atan2(axisLength, stage[0]);
  const projectedAngle = halfAngle * (-age / (data.times[1] - data.times[0]));
  const scale = Math.sin(projectedAngle) / axisLength;
  const increment = [Math.cos(projectedAngle), ...stage.slice(1).map((value) => value * scale)];
  const result = multiplyQuaternions(increment, recent);
  const length = Math.hypot(...result);
  return result.map((value) => value / length);
}

function multiplyQuaternions([w, x, y, z], [v, a, b, c]) {
  return [
    w * v - x * a - y * b - z * c,
    w * a + x * v + y * c - z * b,
    w * b - x * c + y * v + z * a,
    w * c + x * b - y * a + z * v,
  ];
}

/** Apply q * point * inverse(q) on the unit sphere and return [lon, lat]. */
export function rotatePoint(quaternion, [longitude, latitude]) {
  const longitudeRadians = longitude * DEGREES_TO_RADIANS;
  const latitudeRadians = latitude * DEGREES_TO_RADIANS;
  const pointX = Math.cos(latitudeRadians) * Math.cos(longitudeRadians);
  const pointY = Math.cos(latitudeRadians) * Math.sin(longitudeRadians);
  const pointZ = Math.sin(latitudeRadians);
  const [scalar, axisX, axisY, axisZ] = quaternion;
  const crossX = 2 * (axisY * pointZ - axisZ * pointY);
  const crossY = 2 * (axisZ * pointX - axisX * pointZ);
  const crossZ = 2 * (axisX * pointY - axisY * pointX);
  const rotatedX = pointX + scalar * crossX + axisY * crossZ - axisZ * crossY;
  const rotatedY = pointY + scalar * crossY + axisZ * crossX - axisX * crossZ;
  const rotatedZ = pointZ + scalar * crossZ + axisX * crossY - axisY * crossX;
  return [
    Math.atan2(rotatedY, rotatedX) / DEGREES_TO_RADIANS,
    Math.asin(Math.max(-1, Math.min(1, rotatedZ))) / DEGREES_TO_RADIANS,
  ];
}

// Artistic shading for untextured motion. This noise conveys no geological
// evidence; the detailed ancient geography view uses PALEOMAP raster data.
const LAND_SHADER = `
float paleoHash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

float paleoNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);
    return mix(
        mix(paleoHash(cell), paleoHash(cell + vec2(1.0, 0.0)), fraction.x),
        mix(paleoHash(cell + vec2(0.0, 1.0)), paleoHash(cell + vec2(1.0, 1.0)), fraction.x),
        fraction.y
    );
}

czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 point = materialInput.st * 12.0;
    float noise = paleoNoise(point) * 0.55
                + paleoNoise(point * 3.1) * 0.30
                + paleoNoise(point * 11.3) * 0.15;
    material.diffuse = mix(vec3(0.19, 0.29, 0.17), vec3(0.60, 0.57, 0.32), noise);
    material.alpha = 1.0;
    material.specular = 0.0;
    return material;
}`;

function groupFeatures(features) {
  const groups = new Map();
  for (const feature of features) {
    // Pieces with different validity ranges need independent visibility even
    // if their rotation belongs to the same plate.
    const key = `${feature.pid}:${feature.begin}:${feature.end}`;
    if (!groups.has(key)) {
      groups.set(key, { pid: feature.pid, begin: feature.begin, end: feature.end, features: [] });
    }
    groups.get(key).features.push(feature);
  }
  return groups.values();
}

function polygonHierarchy(Cesium, sphere, rings) {
  const positions = (ring) =>
    ring
      .slice(0, -1)
      .map(([longitude, latitude]) =>
        Cesium.Cartesian3.fromDegrees(longitude, latitude, 0, sphere),
      );
  // Source rings repeat the first vertex at the end; Cesium closes them itself.
  return new Cesium.PolygonHierarchy(
    positions(rings[0]),
    rings.slice(1).map((ring) => new Cesium.PolygonHierarchy(positions(ring))),
  );
}

/** Replace Cesium's local polygon UVs with global equirectangular coordinates.
 * Unwrap U near the ring origin so triangles crossing the antimeridian do not
 * sample across the entire image. The material repeats outside [0, 1].
 */
function projectSatelliteCoordinates(geometry, rings) {
  const positions = geometry.attributes.position.values;
  const textureCoordinates = geometry.attributes.st.values;
  const referenceU = (rings[0][0][0] + 180) / 360;
  for (let index = 0; index < positions.length / 3; index++) {
    const x = positions[index * 3];
    const y = positions[index * 3 + 1];
    const z = positions[index * 3 + 2];
    let u = (Math.atan2(y, x) + Math.PI) / (2 * Math.PI);
    while (u - referenceU > 0.5) {
      u -= 1;
    }
    while (u - referenceU < -0.5) {
      u += 1;
    }
    textureCoordinates[index * 2] = u;
    textureCoordinates[index * 2 + 1] =
      (Math.asin(z / Math.hypot(x, y, z)) + Math.PI / 2) / Math.PI;
  }
}

/** Owns mesh primitives. Geometry is prepared once; each frame only updates
 * one matrix per plate and visibility per source-validity group.
 */
export class ContinentalMotion {
  groups = [];
  visible = false;
  omittedPieces = 0;

  constructor(Cesium, viewer, data, satelliteImage) {
    this.Cesium = Cesium;
    this.viewer = viewer;
    this.data = data;
    this.sphere = new Cesium.Ellipsoid(
      SPHERE_RADIUS_METERS,
      SPHERE_RADIUS_METERS,
      SPHERE_RADIUS_METERS,
    );
    this.landMaterial = new Cesium.Material({
      fabric: { type: 'PaleoContinentalSurface', source: LAND_SHADER },
    });
    this.satelliteMaterial = Cesium.Material.fromType('Image', { image: satelliteImage });

    for (const group of groupFeatures(data.features)) {
      const instances = this.createInstances(group.features);
      if (!instances.length) {
        continue;
      }
      const primitive = viewer.scene.primitives.add(
        new Cesium.Primitive({
          geometryInstances: instances,
          appearance: new Cesium.MaterialAppearance({
            material: this.landMaterial,
            faceForward: true,
            closed: false,
            translucent: false,
          }),
          asynchronous: false,
          show: false,
          allowPicking: false,
        }),
      );
      this.groups.push({ pid: group.pid, begin: group.begin, end: group.end, primitive });
    }
  }

  createInstances(features) {
    const C = this.Cesium;
    const instances = [];
    for (const feature of features) {
      try {
        const geometry = C.PolygonGeometry.createGeometry(
          new C.PolygonGeometry({
            polygonHierarchy: polygonHierarchy(C, this.sphere, feature.rings),
            ellipsoid: this.sphere,
            granularity: C.Math.toRadians(2),
            vertexFormat: C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
          }),
        );
        if (!geometry) {
          this.omittedPieces++;
          continue;
        }
        projectSatelliteCoordinates(geometry, feature.rings);
        instances.push(new C.GeometryInstance({ geometry }));
      } catch {
        // A few simplified source rings cannot be triangulated. Omit only that
        // piece and expose the count to diagnostics; keep the rest usable.
        this.omittedPieces++;
      }
    }
    return instances;
  }

  setSatellite(enabled) {
    const material = enabled ? this.satelliteMaterial : this.landMaterial;
    for (const { primitive } of this.groups) {
      primitive.appearance.material = material;
    }
    this.viewer.scene.requestRender();
  }

  setVisible(visible) {
    this.visible = visible;
    if (!visible) {
      for (const { primitive } of this.groups) {
        primitive.show = false;
      }
    }
  }

  update(age) {
    const C = this.Cesium;
    const matrices = new Map();
    for (const group of this.groups) {
      let matrix = matrices.get(group.pid);
      if (!matrix) {
        const [w, x, y, z] = futureRotationAt(this.data, group.pid, age);
        const rotation = C.Matrix3.fromQuaternion(new C.Quaternion(x, y, z, w));
        matrix = C.Matrix4.fromRotationTranslation(rotation);
        matrices.set(group.pid, matrix);
      }
      group.primitive.modelMatrix = matrix;
      // Future extrapolation retains only pieces valid today. Applying historical
      // validity ranges to negative ages would incorrectly erase the continents.
      const validityAge = Math.max(0, age);
      group.primitive.show = this.visible && validityAge <= group.begin && validityAge >= group.end;
    }
    this.viewer.scene.requestRender();
  }

  coordinates(index, age, places) {
    const rotation = futureRotationAt(this.data, this.data.placePids[index], age);
    return rotatePoint(rotation, [places[index].lon, places[index].lat]);
  }

  get ready() {
    return this.groups.every(({ primitive }) => !primitive.show || primitive.ready);
  }
}
