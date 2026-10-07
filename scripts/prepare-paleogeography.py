"""Render Scotese & Wright (2018) PaleoDEM grids as attributed globe textures.

Usage: python3 scripts/prepare-paleogeography.py PALEODEM.zip
Requires netCDF4, numpy, Pillow. Uses published filtered 0.2-degree grids;
finer grid spacing does not imply finer geological evidence.
"""

import argparse
import json
import zipfile
from pathlib import Path

import numpy as np
from netCDF4 import Dataset
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
AGES = [0, 160, 200, 240, 260, 300]

# Palette follows elevation in meters: deep ocean, shelf, lowland, mountains.
ELEVATIONS = np.array([-8000, -4000, -1200, -250, -1, 0, 100, 700, 1800, 3500, 5500, 8000])
COLORS = np.array(
    [
        [8, 23, 36],
        [11, 39, 55],
        [22, 64, 78],
        [47, 96, 104],
        [81, 127, 126],
        [77, 108, 62],
        [100, 129, 75],
        [141, 148, 96],
        [158, 148, 105],
        [163, 154, 132],
        [197, 194, 182],
        [233, 235, 223],
    ],
    dtype=float,
)


def render_grid(archive, age, output_directory):
    """Render an equirectangular texture without inventing fine terrain."""
    name = next(
        name
        for name in archive.namelist()
        if not name.startswith("__MACOSX") and name.endswith(f"_{age}Ma.nc")
    )
    with Dataset("memory", memory=archive.read(name)) as grid:
        # Source rows run south-to-north; image rows must start at the north.
        elevation = np.asarray(grid.variables["z"][:])[::-1]
        longitude = np.asarray(grid.variables["lon"][:])
        latitude = np.asarray(grid.variables["lat"][:])
        if not (
            longitude[0] == -180
            and longitude[-1] == 180
            and latitude[0] == -90
            and latitude[-1] == 90
        ):
            raise ValueError(f"Unexpected grid extent in {name}")
        history = getattr(grid, "history", "")
    rgb = np.stack(
        [np.interp(elevation, ELEVATIONS, COLORS[:, channel]) for channel in range(3)],
        axis=-1,
    )
    # Directional relief derives only from the published reconstructed heights.
    gradient_y, gradient_x = np.gradient(elevation)
    shade = np.clip(1 + (gradient_x - gradient_y) * 0.00035, 0.7, 1.2)
    pixels = np.clip(rgb * shade[..., None], 0, 255).astype("uint8")
    Image.fromarray(pixels).save(
        output_directory / f"paleogeography-{age}.jpg", quality=94, subsampling=0
    )
    return {
        "file": name,
        "width": len(longitude),
        "height": len(latitude),
        "processingHistory": history,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Published PaleoDEM ZIP")
    args = parser.parse_args()
    output_directory = ROOT / "assets"
    output_directory.mkdir(exist_ok=True)
    metadata = {
        "source": "Scotese & Wright (2018) PALEOMAP PaleoDEMs",
        "license": "CC BY 4.0",
        "url": "https://www.earthbyte.org/paleodem-resource-scotese-and-wright-2018/",
        "gridSpacingDegrees": 0.2,
        "limitations": "Published 0.2-degree grids are filtered/resampled from coarse regional reconstructions; file history applies a 400 km Gaussian filter. Grid spacing is not geological accuracy. Shorelines are estimated zero-elevation contours, not precise local reconstructions.",
        "ages": {},
    }
    with zipfile.ZipFile(args.archive) as archive:
        for age in AGES:
            metadata["ages"][str(age)] = render_grid(archive, age, output_directory)
            print(f"Rendered {age} Ma")
    (ROOT / "data/paleogeography.json").write_text(json.dumps(metadata, indent=2) + "\n")


if __name__ == "__main__":
    main()
