# Reconstruction data attribution

`coastlines-*.json` and `places.json` contain reconstructed coordinates returned by the GPlates Web Service using `model=MULLER2022`, default anchor plate 0, at 0, 160, 200, 240, 260, and 300 Ma. Downloaded October 7, 2026. Coordinate values are preserved; JSON whitespace was removed. Place names and descriptions are application metadata.

Müller, R. D., Flament, N., Cannon, J., Tetley, M. G., Williams, S. E., Cao, X., Bodur, Ö. F., Zahirovic, S., and Merdith, A. (2022): A tectonic-rules-based mantle reference frame since 1 billion years ago – implications for supercontinent cycles and plate–mantle system evolution, Solid Earth, 13, 1127–1159, https://doi.org/10.5194/se-13-1127-2022.

Model dataset: https://zenodo.org/records/13636799, Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/.

Service: https://gws.gplates.org/; documentation: https://gwsdoc.gplates.org/models/#muller2022.

These are reconstructed present-day continental outlines, not ancient shoreline or elevation measurements. Ancient texture is illustrative and has no scientific data provenance.

## Continuous motion

`motion.json` derives simplified modern continental pieces from `Coastlines/shapes_coastlines_Merdith_etal.gpmlz` in the Müller et al. (2022) v1.2.4 archive. Plate IDs and validity ranges are preserved. Rings were simplified with unit-sphere Ramer–Douglas–Peucker tolerance 0.00045 and rounded to four decimal degrees. Finite rotations are fetched through GPlates at 5 Ma intervals from 0 to 300 Ma and saved in explicit chronological order. Samples are interpolated with quaternion slerp. This inherits the model dataset’s CC BY 4.0 terms.

## Ancient geography

`assets/paleogeography-*.jpg` are elevation-colored and relief-shaded renderings of Scotese & Wright (2018) PALEOMAP PaleoDEMs from the published `paleoDEM_0.2Deg_grids.zip`. The 0.2° grids are filtered/resampled; metadata describes a 400 km Gaussian filter. Their spacing is not local geological accuracy. Source file names and processing history appear in `paleogeography.json`. `paleo-places.json` contains GPlates PALEOMAP reconstructed label coordinates.

Scotese, Christopher R. & Wright, Nicky M. (2018). PALEOMAP Paleodigital Elevation Models (PaleoDEMs) for the Phanerozoic. https://doi.org/10.5281/zenodo.5460860. Resource: https://www.earthbyte.org/paleodem-resource-scotese-and-wright-2018/. License: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Renderings are adaptations for display, not new observations.

## Modern satellite projection

`assets/modern-satellite.jpg` is a NASA Blue Marble shaded-relief and bathymetry composite fetched through NASA EOSDIS GIBS WMS in EPSG:4326 at 4096×2048. Credit: NASA Earth Observatory, NASA EOSDIS GIBS, and GEBCO. The projection transports modern imagery using model plate rotations. It is not ancient satellite imagery.
