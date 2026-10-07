import { createMotionLoader, createSnapshotProvider, loadPlaces } from './data-loader.js';
import { clampAge, INITIAL_AGE, nearestSnapshot } from './geological-time.js';
import { Globe } from './globe.js';
import { ExplorerInterface } from './interface.js';
import { PlaybackClock } from './playback.js';

const UI_REFRESH_INTERVAL_MS = 100;

/** Coordinates application state; rendering and page updates have separate owners. */
export class PangeaApplication {
  state = {
    age: INITIAL_AGE,
    mode: 'ancient',
    motionMode: false,
    busy: true,
    selectedIndex: null,
    lastAncientAge: INITIAL_AGE,
  };
  playback = new PlaybackClock();
  loadRevision = 0;
  lastUIUpdate = 0;

  constructor(Cesium) {
    this.Cesium = Cesium;
    this.ui = new ExplorerInterface();
  }

  async start() {
    if (!this.Cesium) {
      this.ui.setStatus('The globe engine could not load. Check your connection and reload.');
      return;
    }
    try {
      this.globe = new Globe(this.Cesium, {
        onHeight: (height) => this.ui.showHeight(height),
        onPointer: (position) => this.ui.showPointer(position),
        onRotationStopped: () => this.ui.setRotating(false),
        labelsEnabled: () => this.ui.labelsEnabled,
      });
      this.loadMotion = createMotionLoader(this.Cesium, this.globe.viewer);
      this.places = await loadPlaces();
      this.renderPlaces();
      this.bindControls();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopPlayback();
        }
      });
      await this.changeSnapshot(INITIAL_AGE);
      this.exposeDiagnostics();
      requestAnimationFrame((now) => this.frame(now));
    } catch (error) {
      console.error(error);
      this.ui.setStatus('3D graphics could not start. Enable WebGL in your browser and reload.');
    }
  }

  bindControls() {
    this.ui.bind({
      snapshot: (age) => this.changeSnapshot(age),
      future: (age = -50) => {
        this.stopPlayback();
        return this.enterMotion(age);
      },
      search: () => this.renderPlaces(),
      ancient: () => {
        this.ui.setSatelliteEnabled(false);
        return this.changeSnapshot(nearestSnapshot(this.state.lastAncientAge).age);
      },
      modern: () => this.changeSnapshot(0, 'modern'),
      grid: (visible) => this.globe.setGrid(visible),
      labels: () => this.globe.refreshLabelVisibility(),
      home: () => {
        this.clearSelection();
        this.globe.home(this.state.mode);
      },
      clearSelection: () => this.clearSelection(),
      zoom: (inward) => this.globe.zoom(inward),
      north: () => this.globe.resetNorth(),
      rotate: () => this.ui.setRotating(this.globe.toggleRotation()),
      play: () => this.togglePlayback(),
      reverse: () => {
        this.playback.reverse();
        this.renderPlayback();
      },
      projectSatellite: () => this.projectSatellite(),
      scrub: (age) => this.scrub(age),
    });
  }

  renderPlaces() {
    this.ui.renderPlaces(this.places.modern.places, this.state.selectedIndex, (index) =>
      this.selectPlace(index),
    );
  }

  coordinates(index) {
    const { age, mode, motionMode } = this.state;
    if (motionMode) {
      return this.motion.coordinates(index, age, this.places.modern.places);
    }
    const dataset = mode === 'ancient' ? this.places.ancient : this.places.modern;
    return dataset.coordinates[String(age)][index];
  }

  selectPlace(index, fly = true) {
    const coordinates = this.coordinates(index);
    if (!coordinates || Math.abs(coordinates[1]) > 90) {
      this.ui.setStatus('This location is unavailable at this age.');
      return;
    }
    this.state.selectedIndex = index;
    this.ui.showSelection(index, this.places.modern.places[index], coordinates, this.state.mode);
    if (fly) {
      this.globe.flyTo(coordinates);
      if (window.innerWidth <= 800) {
        this.ui.setPanelOpen(false);
      }
    }
  }

  clearSelection() {
    this.state.selectedIndex = null;
    this.ui.hideSelection();
    this.renderPlaces();
  }

  renderPlayback() {
    this.ui.renderPlayback(this.playback, this.state.motionMode);
  }

  stopPlayback() {
    this.playback.stop();
    this.renderPlayback();
  }

  refreshView() {
    this.ui.render(this.state, this.playback);
    if (this.state.selectedIndex !== null) {
      this.selectPlace(this.state.selectedIndex, false);
    }
  }

  setAge(age) {
    this.state.age = clampAge(age);
    if (this.state.age > 0) {
      this.state.lastAncientAge = this.state.age;
    }
  }

  /** A newer selection supersedes older asynchronous work. Only the latest
   * request may replace imagery, clear loading status, or report an error.
   */
  beginLoad(message) {
    this.state.busy = true;
    this.ui.setStatus(message);
    return ++this.loadRevision;
  }

  async changeSnapshot(age, mode = 'ancient') {
    this.stopPlayback();
    const revision = this.beginLoad(
      mode === 'modern' ? 'Loading NASA satellite imagery…' : `Reconstructing Earth at ${age} Ma…`,
    );
    try {
      const provider = await createSnapshotProvider(this.Cesium, age, mode);
      if (revision !== this.loadRevision) {
        return;
      }
      this.motion?.setVisible(false);
      this.state.motionMode = false;
      this.state.mode = mode;
      this.setAge(age);
      this.globe.setImagery(provider, false);
      this.globe.setLabels(this.places.modern.places, (index) => this.coordinates(index));
      this.refreshView();
      provider.errorEvent.addEventListener(() => {
        if (revision !== this.loadRevision) {
          return;
        }
        this.ui.setStatus(
          mode === 'modern'
            ? 'NASA imagery could not load. Try Reconstruction or reload the page.'
            : 'Some map tiles could not load. Please reload.',
        );
      });
      this.ui.setStatus('');
    } catch (error) {
      if (revision === this.loadRevision) {
        this.ui.setStatus(
          'The globe could not load. Check your connection and reload to try again.',
        );
      }
      console.error(error);
    } finally {
      if (revision === this.loadRevision) {
        this.state.busy = false;
      }
    }
  }

  async enterMotion(age) {
    const revision = this.beginLoad('Preparing continental motion…');
    try {
      const { motion, oceanProvider } = await this.loadMotion();
      if (revision !== this.loadRevision) {
        return;
      }
      this.motion = motion;
      this.state.mode = 'ancient';
      this.state.motionMode = true;
      this.setAge(age);
      this.globe.setImagery(oceanProvider, true);
      motion.setSatellite(this.ui.satelliteEnabled);
      motion.setVisible(true);
      motion.update(age);
      this.globe.setLabels(this.places.modern.places, (index) => this.coordinates(index));
      this.refreshView();
      this.ui.setStatus('');
    } catch (error) {
      if (revision === this.loadRevision) {
        this.stopPlayback();
        this.ui.setStatus(
          'Continental motion could not load. Choose an age button for a detailed snapshot, or try Play again.',
        );
      }
      console.error(error);
    } finally {
      if (revision === this.loadRevision) {
        this.state.busy = false;
      }
    }
  }

  updateMotion(age) {
    this.setAge(age);
    this.motion.update(this.state.age);
    this.globe.updateLabelPositions((index) => this.coordinates(index));
  }

  async togglePlayback() {
    if (this.playback.playing) {
      this.stopPlayback();
      return;
    }
    const age = this.playback.start(this.state.age);
    this.renderPlayback();
    if (!this.state.motionMode || this.state.busy || age !== this.state.age) {
      await this.enterMotion(age);
    }
  }

  async projectSatellite() {
    if (this.state.motionMode && !this.state.busy) {
      this.motion.setSatellite(this.ui.satelliteEnabled);
      this.refreshView();
    } else {
      this.stopPlayback();
      await this.enterMotion(this.state.age);
    }
  }

  scrub(age) {
    this.stopPlayback();
    if (this.state.motionMode && !this.state.busy) {
      this.updateMotion(age);
      this.refreshView();
    } else {
      // Multiple input events can share a mesh load; the revision ensures
      // that the last dragged age wins when the load finishes.
      void this.enterMotion(age);
    }
  }

  frame(now) {
    requestAnimationFrame((nextTime) => this.frame(nextTime));
    if (!this.state.motionMode || this.state.busy) {
      this.playback.resetFrame();
      return;
    }
    if (!this.motion.ready) {
      this.globe.requestRender();
      this.playback.resetFrame();
      return;
    }
    if (!this.playback.playing) {
      this.playback.resetFrame();
      return;
    }
    this.updateMotion(this.playback.advance(now, this.state.age, this.ui.speed));
    // Mesh transforms run every frame; text updates are intentionally slower.
    if (now - this.lastUIUpdate > UI_REFRESH_INTERVAL_MS || !this.playback.playing) {
      this.refreshView();
      this.lastUIUpdate = now;
    }
  }

  exposeDiagnostics() {
    const app = this;
    // Browser tests inspect getters rather than mutating application state.
    window.pangea = Object.freeze({
      get age() {
        return app.state.age;
      },
      get mode() {
        return app.state.mode;
      },
      get ready() {
        return !app.state.busy;
      },
      get playing() {
        return app.playback.playing;
      },
      get motion() {
        return app.state.motionMode;
      },
      get motionReady() {
        return Boolean(app.motion?.ready);
      },
      get direction() {
        return app.playback.direction;
      },
      get motionData() {
        return app.motion?.data;
      },
      get omittedPieces() {
        return app.motion?.omittedPieces;
      },
      viewer: this.globe.viewer,
    });
  }
}
