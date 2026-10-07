import { PangeaApplication } from './src/application.js';

// Cesium is provided by the pinned CDN script in index.html. The application
// reports a readable loading error if the engine cannot be downloaded.
const application = new PangeaApplication(window.Cesium);
void application.start();
