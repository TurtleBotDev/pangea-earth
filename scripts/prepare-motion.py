"""Build attributed animation data from published GPlates model files.

Usage: python3 scripts/prepare-motion.py MODEL.zip
Requires only Python's standard library; rotation samples come from GPlates.
Generated output is compact JSON, while this source remains human-readable.
"""

import argparse
import concurrent.futures
import gzip
import json
import math
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NAMESPACES = {
    "g": "http://www.opengis.net/gml",
    "p": "http://www.gplates.org/gplates",
}
MODEL = "MULLER2022"
MAX_AGE = 300
SAMPLE_INTERVAL = 5
PLATE_BATCH_SIZE = 40
COASTLINE_MEMBER = "Coastlines/shapes_coastlines_Merdith_etal.gpmlz"


def fetch_service(path, parameters):
    """Retry transient network/JSON failures, then preserve the original error."""
    url = "https://gws.gplates.org/" + path + "?" + urllib.parse.urlencode(parameters)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=90) as response:
                return json.load(response)
        except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
            if attempt == 2:
                raise


def simplify(points, tolerance=0.00045):
    """Ramer–Douglas–Peucker using chord distances on the unit sphere.

    Cartesian distances avoid jumps at the antimeridian. The tolerance is a
    unit-sphere chord length, not degrees or a claim about geological accuracy.
    An iterative stack avoids recursion limits on large source coastlines.
    """
    vectors = [
        (
            math.cos(math.radians(lat)) * math.cos(math.radians(lon)),
            math.cos(math.radians(lat)) * math.sin(math.radians(lon)),
            math.sin(math.radians(lat)),
        )
        for lon, lat in points
    ]
    keep = {0, len(points) - 1}
    stack = [(0, len(points) - 1)]
    while stack:
        start, end = stack.pop()
        origin = vectors[start]
        delta = tuple(vectors[end][axis] - origin[axis] for axis in range(3))
        length_squared = sum(value * value for value in delta)
        largest_distance = 0
        furthest_index = None
        for index in range(start + 1, end):
            offset = tuple(vectors[index][axis] - origin[axis] for axis in range(3))
            fraction = (
                max(
                    0,
                    min(
                        1,
                        sum(offset[axis] * delta[axis] for axis in range(3)) / length_squared,
                    ),
                )
                if length_squared
                else 0
            )
            distance = sum((offset[axis] - fraction * delta[axis]) ** 2 for axis in range(3))
            if distance > largest_distance:
                largest_distance, furthest_index = distance, index
        if furthest_index is not None and largest_distance > tolerance * tolerance:
            keep.add(furthest_index)
            stack.extend([(start, furthest_index), (furthest_index, end)])
    return [points[index] for index in sorted(keep)]


def parse_age(value):
    """GPML uses symbolic distant ages for effectively unbounded validity."""
    if "distantFuture" in value:
        return -1e9
    if "distantPast" in value:
        return 1e9
    return float(value)


def extract_features(archive_path):
    """Read modern source geometry and retain its plate/validity assignments."""
    with zipfile.ZipFile(archive_path) as archive:
        root = ET.fromstring(gzip.decompress(archive.read(COASTLINE_MEMBER)))
    features = []
    plate_ids = set()
    import_ages = set()
    for member in root:
        feature = member[0]
        plate_id = int(
            feature.findtext(
                "p:reconstructionPlateId/p:ConstantValue/p:value", namespaces=NAMESPACES
            )
        )
        begin = parse_age(
            feature.findtext(
                "g:validTime/g:TimePeriod/g:begin/g:TimeInstant/g:timePosition",
                namespaces=NAMESPACES,
            )
        )
        end = parse_age(
            feature.findtext(
                "g:validTime/g:TimePeriod/g:end/g:TimeInstant/g:timePosition",
                namespaces=NAMESPACES,
            )
        )
        import_ages.add(
            float(
                feature.findtext(
                    "p:geometryImportTime/g:TimeInstant/g:timePosition", "0", NAMESPACES
                )
            )
        )
        if begin < 0 or end > MAX_AGE:
            continue
        for polygon in feature.findall(".//g:Polygon", NAMESPACES):
            rings = []
            for ring in polygon.findall(".//g:LinearRing/g:posList", NAMESPACES):
                values = list(map(float, ring.text.split()))
                # GPML posList is lat/lon; the browser contract is lon/lat.
                points = [
                    [round(values[index + 1], 4), round(values[index], 4)]
                    for index in range(0, len(values), 2)
                ]
                simplified = simplify(points)
                if len(simplified) >= 4:
                    rings.append(simplified)
            if rings:
                features.append({"pid": plate_id, "begin": begin, "end": end, "rings": rings})
                plate_ids.add(plate_id)
    if import_ages != {0}:
        raise ValueError(f"Nonzero geometry import times need correction: {import_ages}")
    return features, plate_ids


def assign_places(places):
    assignments = fetch_service(
        "reconstruct/assign_points_plate_ids",
        {
            "model": MODEL,
            "lons": ",".join(str(place["lon"]) for place in places),
            "lats": ",".join(str(place["lat"]) for place in places),
            "with_valid_time": "",
        },
    )
    # Service versions return dictionaries, [pid, begin, end], or bare IDs.
    plate_ids = [
        entry["pid"] if isinstance(entry, dict) else entry[0] if isinstance(entry, list) else entry
        for entry in assignments
    ]
    return plate_ids, assignments


def fetch_rotations(plate_ids, times):
    result = fetch_service(
        "rotation/get_quaternions",
        {
            "model": MODEL,
            "times": ",".join(map(str, times)),
            "pids": ",".join(map(str, plate_ids)),
        },
    )
    # Time-keyed output avoids the service's unordered set(times) when it
    # constructs grouped arrays. Never assume JSON property order is age order.
    keyed = {float(age): rotations for age, rotations in result.items()}
    return {str(plate_id): [keyed[age][str(plate_id)] for age in times] for plate_id in plate_ids}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="Published Müller model ZIP")
    args = parser.parse_args()
    features, plate_ids = extract_features(args.archive)
    places = json.loads((ROOT / "data/places.json").read_text())["places"]
    place_plate_ids, assignments = assign_places(places)
    plate_ids.update(place_plate_ids)
    times = list(range(0, MAX_AGE + 1, SAMPLE_INTERVAL))
    ordered_ids = sorted(plate_ids)
    batches = [
        ordered_ids[index : index + PLATE_BATCH_SIZE]
        for index in range(0, len(ordered_ids), PLATE_BATCH_SIZE)
    ]
    rotations = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(lambda batch: fetch_rotations(batch, times), batches):
            rotations.update(result)
    data = {
        "model": MODEL,
        "source": "https://zenodo.org/records/13636799",
        "license": "CC BY 4.0",
        "times": times,
        "features": features,
        "rotations": rotations,
        "placePids": place_plate_ids,
        "placeAssignments": assignments,
    }
    output = ROOT / "data/motion.json"
    output.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(
        f"Saved {len(features)} pieces, {len(plate_ids)} plates, {len(times)} samples; {output.stat().st_size} bytes"
    )


if __name__ == "__main__":
    main()
