import {
  eraAt,
  formatAge,
  FUTURE_SHORTCUTS,
  MAX_AGE,
  MIN_AGE,
  SNAPSHOTS,
} from './geological-time.js';

const SOURCES = {
  ancient: {
    label: 'Scotese & Wright (2018) · PALEOMAP',
    url: 'https://www.earthbyte.org/paleodem-resource-scotese-and-wright-2018/',
    title: 'PALEOMAP reconstructed ancient geography',
  },
  modern: {
    label: 'NASA Blue Marble · GIBS',
    url: 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/',
    title: 'Modern satellite imagery',
  },
  motion: {
    label: 'GPlates · Müller et al. (2022)',
    url: 'https://gwsdoc.gplates.org/models/#muller2022',
    title: 'Model rotations with modern outlines',
  },
};

function element(id) {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Required interface element #${id} is missing`);
  }
  return node;
}

export function formatCoordinates([longitude, latitude], separator = ' · ') {
  return `${Math.abs(latitude).toFixed(2)}° ${latitude < 0 ? 'S' : 'N'}${separator}${Math.abs(longitude).toFixed(2)}° ${longitude < 0 ? 'W' : 'E'}`;
}

/** All page writes and control bindings live here; no Cesium dependencies. */
export class ExplorerInterface {
  constructor() {
    this.elements = Object.fromEntries(
      [
        'status',
        'age-hero',
        'age-readout',
        'era-label',
        'era-readout',
        'timeline-title',
        'ancient-button',
        'modern-button',
        'time-scrubber',
        'data-note',
        'source-credit',
        'time-play',
        'time-direction',
        'motion-note',
        'time-speed',
        'project-satellite',
        'grid-toggle',
        'labels-toggle',
        'search',
        'places',
        'selection',
        'selection-name',
        'selection-description',
        'selection-coordinates',
        'explorer',
        'panel-toggle',
        'about-dialog',
        'rotate',
        'coordinate-readout',
        'altitude-readout',
        'time-buttons',
      ].map((id) => [id, element(id)]),
    );
    this.snapshotButtons = [];
  }

  get satelliteEnabled() {
    return this.elements['project-satellite'].checked;
  }
  get labelsEnabled() {
    return this.elements['labels-toggle'].checked;
  }
  get speed() {
    return Number(this.elements['time-speed'].value);
  }

  setSatelliteEnabled(enabled) {
    this.elements['project-satellite'].checked = enabled;
  }

  setStatus(message) {
    this.elements.status.textContent = message;
  }

  bind(actions) {
    const on = (id, event, handler) => element(id).addEventListener(event, handler);
    for (const snapshot of SNAPSHOTS) {
      const button = document.createElement('button');
      button.className = 'time-step';
      button.dataset.age = snapshot.age;
      button.textContent = snapshot.age === 0 ? 'Today' : `${snapshot.age} Ma`;
      button.title = snapshot.era;
      button.setAttribute(
        'aria-label',
        snapshot.age === 0
          ? 'Present day reconstruction'
          : `${snapshot.age} million years ago, ${snapshot.era}`,
      );
      button.addEventListener('click', () => actions.snapshot(snapshot.age));
      this.snapshotButtons.push(button);
      this.elements['time-buttons'].append(button);
    }
    for (const years of FUTURE_SHORTCUTS) {
      const button = document.createElement('button');
      button.className = 'time-step future-step';
      button.dataset.age = -years;
      button.textContent = `+${years} Myr`;
      button.setAttribute('aria-label', `Project ${years} million years into the future`);
      button.addEventListener('click', () => actions.future(-years));
      this.snapshotButtons.push(button);
      this.elements['time-buttons'].append(button);
    }
    on('future-button', 'click', () => actions.future());
    on('today-button', 'click', actions.modern);
    on('search', 'input', actions.search);
    on('ancient-button', 'click', actions.ancient);
    on('modern-button', 'click', actions.modern);
    on('grid-toggle', 'change', () => actions.grid(this.elements['grid-toggle'].checked));
    on('labels-toggle', 'change', actions.labels);
    on('home', 'click', actions.home);
    on('close-selection', 'click', actions.clearSelection);
    on('zoom-in', 'click', () => actions.zoom(true));
    on('zoom-out', 'click', () => actions.zoom(false));
    on('north', 'click', actions.north);
    on('rotate', 'click', actions.rotate);
    on('time-play', 'click', actions.play);
    on('time-direction', 'click', actions.reverse);
    on('project-satellite', 'change', actions.projectSatellite);
    // The slider grows left-to-right, whereas geological age counts backward.
    on('time-scrubber', 'input', () =>
      actions.scrub(MAX_AGE - Number(this.elements['time-scrubber'].value)),
    );
    on('panel-toggle', 'click', () =>
      this.setPanelOpen(!this.elements.explorer.classList.contains('open')),
    );
    on('about-button', 'click', () => this.elements['about-dialog'].showModal());
    on('close-about', 'click', () => this.elements['about-dialog'].close());
    on('about-dialog', 'click', (event) => this.closeDialogOnBackdrop(event));
  }

  render(state, playback) {
    const { age, mode, motionMode } = state;
    const nodes = this.elements;
    const text = formatAge(Math.abs(age));
    const future = age < 0;
    const era = eraAt(age);
    const snapshot = SNAPSHOTS.find((item) => item.age === age);
    nodes['age-hero'].textContent = age === 0 ? 'Now' : future ? `+${text}` : text;
    document.querySelector('.age-unit').textContent =
      age === 0 ? 'modern Earth' : future ? 'million years from now' : 'million years ago';
    nodes['age-readout'].replaceChildren(
      document.createTextNode(age === 0 ? 'Today' : `${future ? '+' : ''}${text} `),
    );
    if (age !== 0) {
      const unit = document.createElement('span');
      unit.textContent = future ? 'Myr' : 'Ma';
      nodes['age-readout'].append(unit);
    }
    nodes['era-label'].textContent = era.toUpperCase();
    nodes['era-readout'].textContent = era;
    nodes['timeline-title'].textContent = future
      ? 'A possible tomorrow'
      : motionMode
        ? 'Continents in motion'
        : snapshot?.title || 'Explore deep time';
    for (const layer of ['ancient', 'modern']) {
      const button = nodes[`${layer}-button`];
      button.classList.toggle('active', mode === layer && !future);
      button.setAttribute('aria-pressed', String(mode === layer && !future));
    }
    for (const button of this.snapshotButtons) {
      const active = Math.abs(Number(button.dataset.age) - age) < 0.05;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    nodes['time-scrubber'].value = MAX_AGE - age;
    nodes['time-scrubber'].setAttribute(
      'aria-valuetext',
      age === 0
        ? 'Present day'
        : future
          ? `${text} million years in the future, speculative projection`
          : `${text} million years ago`,
    );
    this.renderDataNote(mode, motionMode, future);
    document.body.classList.toggle('future-view', future);
    element('future-notice').hidden = !future;
    element('future-button').setAttribute('aria-pressed', String(future));
    element('future-button').classList.toggle('active', future);
    element('view-badge').textContent = future
      ? 'SPECULATIVE PROJECTION'
      : motionMode
        ? 'CONTINENTAL MOTION'
        : mode === 'modern'
          ? 'SATELLITE COMPOSITE'
          : 'ANCIENT GEOGRAPHY';
    const progress = ((MAX_AGE - age) / (MAX_AGE - MIN_AGE)) * 100;
    nodes['time-scrubber'].style.setProperty('--progress', `${progress}%`);
    const source = SOURCES[motionMode ? 'motion' : mode];
    nodes['era-label'].title = source.title;
    nodes['source-credit'].textContent = source.label;
    nodes['source-credit'].href = source.url;
    this.renderPlayback(playback, motionMode);
  }

  renderDataNote(mode, motionMode, future) {
    let lines = ['PALEOMAP ancient geography.', 'Regional estimates · limited local detail.'];
    if (mode === 'modern') {
      lines = ['NASA Blue Marble satellite composite.', 'Modern Earth · about 500 m resolution.'];
    } else if (motionMode) {
      lines = this.satelliteEnabled
        ? ['Modern imagery on moving plates.', 'Not an ancient landscape.']
        : ['Modern outlines in motion.', 'Illustrative surface, not ancient land.'];
    }
    if (future) {
      lines = ['Constant-rate future projection.', 'Recent motion continued · speculative.'];
    }
    this.elements['data-note'].replaceChildren(
      document.createTextNode(lines[0]),
      document.createElement('br'),
      document.createTextNode(lines[1]),
    );
  }

  renderPlayback({ playing, direction }, motionMode) {
    const play = this.elements['time-play'];
    play.textContent = playing ? 'Ⅱ Pause' : '▶ Play';
    play.setAttribute(
      'aria-label',
      playing ? 'Pause continental motion' : 'Play continental motion',
    );
    play.setAttribute('aria-pressed', String(playing));
    const reverse = this.elements['time-direction'];
    reverse.textContent = direction < 0 ? 'Forward →' : '← Backward';
    reverse.setAttribute(
      'aria-label',
      direction < 0 ? 'Reverse playback toward the past' : 'Reverse playback toward the future',
    );
    this.elements['motion-note'].textContent = motionMode
      ? 'Smooth motion · simplified coastlines'
      : 'Drag to watch continental drift';
  }

  renderPlaces(places, selectedIndex, select) {
    const query = this.elements.search.value.trim().toLowerCase();
    const container = this.elements.places;
    container.replaceChildren();
    places.forEach((place, index) => {
      if (!place.name.toLowerCase().includes(query)) {
        return;
      }
      const button = document.createElement('button');
      button.className = 'place';
      button.dataset.index = index;
      button.classList.toggle('selected', selectedIndex === index);
      const name = document.createElement('span');
      name.className = 'place-name';
      name.textContent = place.name;
      button.append(name);
      button.addEventListener('click', () => select(index));
      container.append(button);
    });
    if (!container.children.length) {
      const message = document.createElement('p');
      message.className = 'empty-search';
      message.textContent = 'No matching continents.';
      container.append(message);
    }
  }

  showSelection(index, place, coordinates, mode) {
    this.elements.places.querySelectorAll('.place').forEach((button) => {
      button.classList.toggle('selected', Number(button.dataset.index) === index);
    });
    this.elements['selection-name'].textContent = place.name;
    this.elements['selection-description'].textContent =
      mode === 'modern'
        ? `Explore ${place.name} in NASA’s modern satellite imagery.`
        : place.description;
    this.elements['selection-coordinates'].textContent = formatCoordinates(coordinates);
    this.elements.selection.hidden = false;
  }

  hideSelection() {
    this.elements.selection.hidden = true;
  }

  setPanelOpen(open) {
    this.elements.explorer.classList.toggle('open', open);
    this.elements['panel-toggle'].setAttribute('aria-expanded', String(open));
  }

  setRotating(rotating) {
    this.elements.rotate.setAttribute('aria-pressed', String(rotating));
  }

  showHeight(height) {
    const kilometers = (height / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 });
    this.elements['altitude-readout'].textContent = `View height ${kilometers} km`;
  }

  showPointer(coordinates) {
    this.elements['coordinate-readout'].textContent = formatCoordinates(coordinates, '   ');
  }

  closeDialogOnBackdrop(event) {
    const dialog = this.elements['about-dialog'];
    if (event.target !== dialog) {
      return;
    }
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      dialog.close();
    }
  }
}
