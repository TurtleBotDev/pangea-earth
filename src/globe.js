export const CAMERA = {
  snapshotMinimum: 1500,
  motionMinimum: 200000,
  motionEntryHeight: 250000,
  maximum: 45000000,
  homeHeight: 20500000,
  mobileHomeHeight: 13500000,
  continentHeight: 3200000,
};

/** Keep Cesium setup and low-level camera operations out of DOM orchestration. */
export class Globe {
  rotating = false;
  labels = [];

  constructor(Cesium, { onHeight, onPointer, onRotationStopped, labelsEnabled }) {
    this.Cesium = Cesium;
    this.labelsEnabled = labelsEnabled;
    this.motionMode = false;
    this.homeHeight = window.innerWidth <= 800 ? CAMERA.mobileHomeHeight : CAMERA.homeHeight;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    Cesium.Ion.defaultAccessToken = '';
    this.viewer = new Cesium.Viewer('globe', {
      creditContainer: 'engine-credit',
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    });

    const { scene, camera } = this.viewer;
    scene.backgroundColor = Cesium.Color.fromCssColorString('#080e12');
    scene.globe.baseColor = Cesium.Color.fromCssColorString('#183644');
    scene.globe.enableLighting = false;
    scene.globe.showGroundAtmosphere = false;
    scene.globe.maximumScreenSpaceError = 2;
    scene.skyAtmosphere.show = true;
    scene.skyBox.show = false;
    scene.sun.show = false;
    scene.moon.show = false;
    scene.screenSpaceCameraController.minimumZoomDistance = CAMERA.snapshotMinimum;
    scene.screenSpaceCameraController.maximumZoomDistance = CAMERA.maximum;
    camera.setView({ destination: Cesium.Cartesian3.fromDegrees(10, -22, this.homeHeight) });

    this.createGrid();
    this.attachSceneEvents({ onHeight, onPointer, onRotationStopped });
    const resize = () => {
      this.viewer.resize();
      this.requestRender();
    };
    resize();
    window.addEventListener('resize', resize);
  }

  requestRender() {
    this.viewer.scene.requestRender();
  }

  setImagery(provider, motionMode) {
    this.motionMode = motionMode;
    const { imageryLayers, camera, scene } = this.viewer;
    if (motionMode) {
      camera.cancelFlight();
      const position = camera.positionCartographic;
      if (position.height < CAMERA.motionEntryHeight) {
        camera.setView({
          destination: this.Cesium.Cartesian3.fromRadians(
            position.longitude,
            position.latitude,
            CAMERA.motionEntryHeight,
          ),
        });
      }
    }
    scene.screenSpaceCameraController.minimumZoomDistance = motionMode
      ? CAMERA.motionMinimum
      : CAMERA.snapshotMinimum;
    imageryLayers.removeAll();
    imageryLayers.addImageryProvider(provider);
    this.requestRender();
  }

  home(mode) {
    const C = this.Cesium;
    this.viewer.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(mode === 'modern' ? 15 : 10, -22, this.homeHeight),
      orientation: { heading: 0, pitch: -C.Math.PI_OVER_TWO, roll: 0 },
      duration: this.reducedMotion ? 0 : 1.4,
    });
  }

  flyTo([longitude, latitude]) {
    this.viewer.camera.flyTo({
      destination: this.Cesium.Cartesian3.fromDegrees(longitude, latitude, CAMERA.continentHeight),
      duration: this.reducedMotion ? 0 : 1.6,
    });
  }

  zoom(inward) {
    const camera = this.viewer.camera;
    const height = camera.positionCartographic.height;
    if (inward) {
      camera.zoomIn(height * 0.45);
    } else {
      camera.zoomOut(height * 0.7);
    }
    this.requestRender();
  }

  resetNorth() {
    const camera = this.viewer.camera;
    camera.setView({ orientation: { heading: 0, pitch: camera.pitch, roll: 0 } });
    this.requestRender();
  }

  toggleRotation() {
    this.rotating = !this.rotating;
    this.requestRender();
    return this.rotating;
  }

  setGrid(visible) {
    this.grid.show = visible;
    this.requestRender();
  }

  setLabels(places, coordinates) {
    const C = this.Cesium;
    // Only remove labels owned here; other scene entities may be added later.
    for (const { entity } of this.labels) {
      this.viewer.entities.remove(entity);
    }
    this.labels = [];
    places.forEach((place, index) => {
      const position = coordinates(index);
      if (!position || Math.abs(position[1]) > 90) {
        return;
      }
      const entity = this.viewer.entities.add({
        position: C.Cartesian3.fromDegrees(...position, this.motionMode ? 100000 : 1000),
        label: {
          text: place.name.toUpperCase(),
          font: '11px sans-serif',
          fillColor: C.Color.fromCssColorString('#e3eccb'),
          outlineColor: C.Color.fromCssColorString('#102021'),
          outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          show: this.labelsEnabled(),
          scaleByDistance: new C.NearFarScalar(500000, 1.15, 25000000, 0.8),
          distanceDisplayCondition: new C.DistanceDisplayCondition(0, 40000000),
          disableDepthTestDistance: this.motionMode ? Infinity : 0,
          pixelOffset: new C.Cartesian2(0, -8),
        },
      });
      this.labels.push({ entity, placeIndex: index });
    });
  }

  updateLabelPositions(coordinates) {
    for (const { entity, placeIndex } of this.labels) {
      entity.position = this.Cesium.Cartesian3.fromDegrees(...coordinates(placeIndex), 100000);
    }
  }

  refreshLabelVisibility() {
    for (const { entity } of this.labels) {
      entity.label.show = this.labelsEnabled();
    }
    this.requestRender();
  }

  createGrid() {
    const C = this.Cesium;
    this.grid = new C.CustomDataSource('Grid');
    const material = C.Color.fromCssColorString('#cfe1bb').withAlpha(0.16);
    const addLine = (positions) =>
      this.grid.entities.add({
        polyline: { positions, width: 1, material, arcType: C.ArcType.NONE },
      });
    for (let longitude = -180; longitude < 180; longitude += 30) {
      const positions = [];
      for (let latitude = -89; latitude <= 89; latitude += 2) {
        positions.push(C.Cartesian3.fromDegrees(longitude, latitude, 100));
      }
      addLine(positions);
    }
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      const positions = [];
      for (let longitude = -180; longitude <= 180; longitude += 2) {
        positions.push(C.Cartesian3.fromDegrees(longitude, latitude, 100));
      }
      addLine(positions);
    }
    this.grid.show = false;
    this.viewer.dataSources.add(this.grid);
  }

  attachSceneEvents({ onHeight, onPointer, onRotationStopped }) {
    const C = this.Cesium;
    const { viewer } = this;
    const occluder = new C.EllipsoidalOccluder(
      viewer.scene.globe.ellipsoid,
      viewer.camera.positionWC,
    );
    let previousTime = performance.now();
    viewer.scene.preRender.addEventListener(() => {
      const now = performance.now();
      const elapsed = Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      if (this.motionMode) {
        // Motion labels bypass depth testing so raised meshes do not cover
        // them. Explicit ellipsoid occlusion still hides the far hemisphere.
        occluder.cameraPosition = viewer.camera.positionWC;
        const time = C.JulianDate.now();
        for (const { entity } of this.labels) {
          entity.label.show =
            this.labelsEnabled() && occluder.isPointVisible(entity.position.getValue(time));
        }
      }
      if (this.rotating) {
        viewer.camera.rotate(C.Cartesian3.UNIT_Z, -elapsed * 0.035);
        this.requestRender();
      }
    });
    viewer.screenSpaceEventHandler.setInputAction(() => {
      if (this.rotating) {
        this.rotating = false;
        onRotationStopped();
      }
    }, C.ScreenSpaceEventType.LEFT_DOWN);
    viewer.scene.postRender.addEventListener(() =>
      onHeight(viewer.camera.positionCartographic.height),
    );

    this.pointerHandler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
    this.pointerHandler.setInputAction((movement) => {
      const point = viewer.camera.pickEllipsoid(movement.endPosition, viewer.scene.globe.ellipsoid);
      if (!point) {
        return;
      }
      const position = C.Cartographic.fromCartesian(point);
      onPointer([C.Math.toDegrees(position.longitude), C.Math.toDegrees(position.latitude)]);
    }, C.ScreenSpaceEventType.MOUSE_MOVE);
  }
}
