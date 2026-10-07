/** Geological ages are millions of years before present (Ma). */
export const MAX_AGE = 300;
export const MIN_AGE = -100; // Negative Ma denotes time after the present.
export const FUTURE_SHORTCUTS = [25, 50, 100];
export const INITIAL_AGE = 240;

export const SNAPSHOTS = [
  { age: 300, era: 'Late Carboniferous', title: 'Pangea comes together' },
  { age: 260, era: 'Middle Permian', title: 'The supercontinent assembled' },
  { age: 240, era: 'Middle Triassic', title: 'The age of Pangea' },
  { age: 200, era: 'Early Jurassic', title: 'A world beginning to separate' },
  { age: 160, era: 'Late Jurassic', title: 'The continents drift apart' },
  { age: 0, era: 'Present day', title: 'The world we know' },
];

// Boundaries used for display, in descending Ma. These labels do not alter
// either reconstruction model; source: https://stratigraphy.org/chart/.
const ERA_BOUNDARIES = [
  [298.9, 'Late Carboniferous'],
  [273, 'Early Permian'],
  [259.5, 'Middle Permian'],
  [251.9, 'Late Permian'],
  [247, 'Early Triassic'],
  [237, 'Middle Triassic'],
  [201.4, 'Late Triassic'],
  [174.7, 'Early Jurassic'],
  [161.5, 'Middle Jurassic'],
  [143.1, 'Late Jurassic'],
  [100.5, 'Early Cretaceous'],
  [66, 'Late Cretaceous'],
  [56, 'Paleocene'],
  [33.9, 'Eocene'],
  [23.04, 'Oligocene'],
  [5.33, 'Miocene'],
  [2.58, 'Pliocene'],
  [0.0117, 'Pleistocene'],
  [0, 'Holocene'],
];

export function clampAge(age) {
  return Math.max(MIN_AGE, Math.min(MAX_AGE, age));
}

export function formatAge(age) {
  return Number(age.toFixed(1)).toString();
}

export function eraAt(age) {
  if (age < 0) {
    return 'Future projection';
  }
  if (age === 0) {
    return 'Present day';
  }
  return ERA_BOUNDARIES.find(([boundary]) => age >= boundary)[1];
}

export function nearestSnapshot(age) {
  return SNAPSHOTS.reduce((nearest, snapshot) =>
    Math.abs(snapshot.age - age) < Math.abs(nearest.age - age) ? snapshot : nearest,
  );
}
