"""
Extract the real-world map data for SUNSTATE from Overture Maps (https://overturemaps.org).

Overture publishes the whole world as GeoParquet on a public S3 bucket. The files are
spatially sorted and every row group carries bbox statistics, so we read only the parquet
footers, pick the row groups that overlap our region, and fetch just those (HTTP range
requests, needed columns only). Nothing else is downloaded.

Region: Greater Miami (Miami Beach, Downtown, Brickell, Wynwood, Little Havana, Coral
Gables, Coconut Grove, Key Biscayne, the airport) plus a corridor along the real US-1 /
Overseas Highway down through Homestead and the Keys to Marathon. The corridor is found
in two passes: first the US 1 road segments themselves, then everything within a buffer
of them.

Usage:  python -I tools/mapdata/extract.py <cache-dir>
Output: <cache-dir>/<theme>.parquet, filtered to the region (geometry as WKB, lon/lat).

Data licence: Overture data is mostly ODbL (OpenStreetMap-derived) plus CDLA-Permissive
and other open sources; see docs/ASSETS.md for the attribution the game shows.
"""
import io, os, re, sys, json, time, threading
from concurrent.futures import ThreadPoolExecutor
import requests
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.compute as pc

BASE = "https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com"
REL = os.environ.get("OVERTURE_RELEASE", "release/2026-10-21.0")

CITY = (-80.38, 25.64, -80.11, 25.92)          # lon/lat bbox of Greater Miami
CORRIDOR = (-81.16, 24.62, -80.20, 25.66)       # broad box around US-1 south to Marathon
CORRIDOR_BUFFER_M = 1500                        # keep everything within this of US-1

THEMES = {
    "segment":        ("theme=transportation/type=segment", ["id", "names", "subtype", "class", "subclass", "connectors", "road_flags", "level_rules", "speed_limits", "routes", "width_rules", "access_restrictions", "geometry", "bbox"]),
    "connector":      ("theme=transportation/type=connector", ["id", "geometry", "bbox"]),
    "building":       ("theme=buildings/type=building", ["id", "names", "height", "min_height", "num_floors", "is_underground", "subtype", "class", "facade_color", "facade_material", "roof_material", "roof_shape", "roof_color", "roof_height", "has_parts", "geometry", "bbox"]),
    "place":          ("theme=places/type=place", ["id", "names", "basic_category", "taxonomy", "confidence", "brand", "operating_status", "geometry", "bbox"]),
    "land":           ("theme=base/type=land", ["id", "names", "subtype", "class", "geometry", "bbox"]),
    "land_use":       ("theme=base/type=land_use", ["id", "names", "subtype", "class", "surface", "geometry", "bbox"]),
    "water":          ("theme=base/type=water", ["id", "names", "subtype", "class", "is_salt", "geometry", "bbox"]),
    "infrastructure": ("theme=base/type=infrastructure", ["id", "names", "subtype", "class", "geometry", "bbox"]),
}

_session = threading.local()
def http():
    if not hasattr(_session, "s"):
        _session.s = requests.Session()
    return _session.s

class RangeFile(io.RawIOBase):
    """A seekable file over HTTP range requests (just enough for pyarrow.parquet)."""
    def __init__(self, url, size): self.url, self.size, self.pos, self.fetched = url, size, 0, 0
    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.pos
    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos
    def readinto(self, b):
        n = min(len(b), self.size - self.pos)
        if n <= 0: return 0
        for attempt in range(5):
            try:
                r = http().get(self.url, headers={"Range": f"bytes={self.pos}-{self.pos + n - 1}"}, timeout=180)
                r.raise_for_status(); break
            except Exception:
                if attempt == 4: raise
                time.sleep(2 ** attempt)
        data = r.content
        b[:len(data)] = data; self.pos += len(data); self.fetched += len(data)
        return len(data)

def list_files(prefix):
    out, token = [], None
    while True:
        url = f"{BASE}/?list-type=2&prefix={REL}/{prefix}/" + (f"&continuation-token={requests.utils.quote(token)}" if token else "")
        xml = requests.get(url, timeout=60).text
        out += list(zip(re.findall(r"<Key>([^<]*)</Key>", xml), map(int, re.findall(r"<Size>(\d+)</Size>", xml))))
        m = re.search(r"<NextContinuationToken>([^<]*)</NextContinuationToken>", xml)
        if not m: return out
        token = m.group(1)

def overlaps(st, box):
    return not (st["xmax"] < box[0] or st["xmin"] > box[2] or st["ymax"] < box[1] or st["ymin"] > box[3])

def open_pf(key, size):
    return pq.ParquetFile(io.BufferedReader(RangeFile(f"{BASE}/{key}", size), buffer_size=1 << 20))

def row_groups(key, size, boxes):
    """Row groups of one file whose bbox statistics overlap any of the boxes."""
    md = open_pf(key, size).metadata
    names = [md.schema.column(i).path for i in range(md.num_columns)]
    ix = {k: names.index("bbox." + k) for k in ("xmin", "xmax", "ymin", "ymax")}
    hits = []
    for g in range(md.num_row_groups):
        rg = md.row_group(g)
        st = {"xmin": rg.column(ix["xmin"]).statistics.min, "xmax": rg.column(ix["xmax"]).statistics.max,
              "ymin": rg.column(ix["ymin"]).statistics.min, "ymax": rg.column(ix["ymax"]).statistics.max}
        if any(overlaps(st, b) for b in boxes): hits.append(g)
    return hits

def in_box(tbl, box):
    b = tbl.column("bbox")
    xmin, xmax = pc.struct_field(b, "xmin"), pc.struct_field(b, "xmax")
    ymin, ymax = pc.struct_field(b, "ymin"), pc.struct_field(b, "ymax")
    return pc.and_(pc.and_(pc.less_equal(xmin, box[2]), pc.greater_equal(xmax, box[0])),
                   pc.and_(pc.less_equal(ymin, box[3]), pc.greater_equal(ymax, box[1])))

def fetch(theme, boxes, cache, keep=None, label=None):
    prefix, cols = THEMES[theme]
    out_path = os.path.join(cache, f"{label or theme}.parquet")
    if os.path.exists(out_path):
        print(f"{label or theme}: cached"); return pq.read_table(out_path)
    files = list_files(prefix)
    t0 = time.time()
    with ThreadPoolExecutor(16) as ex:
        groups = list(ex.map(lambda f: (f, row_groups(f[0], f[1], boxes)), files))
    jobs = [(f, g) for f, gs in groups for g in gs]
    print(f"{label or theme}: {len(files)} files, {len(jobs)} row groups overlap ({time.time() - t0:.0f}s footers)", flush=True)
    def read(job):
        (key, size), g = job
        pf = open_pf(key, size)
        avail = [c for c in cols if c in pf.schema_arrow.names]
        t = pf.read_row_group(g, columns=avail)
        mask = None
        for b in boxes:
            m = in_box(t, b); mask = m if mask is None else pc.or_(mask, m)
        t = t.filter(mask)
        if keep is not None and t.num_rows: t = keep(t)
        return t
    parts, done = [], 0
    with ThreadPoolExecutor(12) as ex:
        for t in ex.map(read, jobs):
            done += 1
            if t.num_rows: parts.append(t)
            if done % 20 == 0: print(f"  {done}/{len(jobs)} row groups, {sum(p.num_rows for p in parts)} rows, {time.time() - t0:.0f}s", flush=True)
    tbl = pa.concat_tables(parts, promote_options="permissive") if parts else pa.table({})
    pq.write_table(tbl, out_path, compression="zstd")
    print(f"{label or theme}: {tbl.num_rows} rows in {time.time() - t0:.0f}s", flush=True)
    return tbl

def corridor_boxes(cache):
    """Pass 1: the real US 1 south of the city; pass 2 uses small boxes around it."""
    path = os.path.join(cache, "corridor.json")
    if os.path.exists(path): return json.load(open(path))
    def us1(t):
        routes = t.column("routes").to_pylist()
        cls = t.column("class").to_pylist()
        keep = [any((r.get("ref") or "").replace("-", " ").upper() in ("US 1", "1") and (r.get("network") or "").upper().startswith("US") for r in (rs or [])) and c in ("motorway", "trunk", "primary") for rs, c in zip(routes, cls)]
        return t.filter(pa.array(keep))
    seg = fetch("segment", [CORRIDOR], cache, keep=us1, label="us1")
    from shapely import wkb
    from shapely.geometry import box as sbox
    pts = []
    for g in seg.column("geometry").to_pylist():
        line = wkb.loads(g)
        pts += list(line.coords)
    pts = [p for p in pts if not (CITY[0] <= p[0] <= CITY[2] and CITY[1] <= p[1] <= CITY[3])]
    # cover the corridor with small lon/lat boxes (≈ buffer on each side) along US 1
    dlat = CORRIDOR_BUFFER_M / 110574.0
    dlon = CORRIDOR_BUFFER_M / (111320.0 * 0.905)
    cell = 0.02
    cells = sorted({(round(x / cell), round(y / cell)) for x, y in pts})
    boxes = [(cx * cell - cell / 2 - dlon, cy * cell - cell / 2 - dlat, cx * cell + cell / 2 + dlon, cy * cell + cell / 2 + dlat) for cx, cy in cells]
    json.dump(boxes, open(path, "w"))
    print(f"corridor: {len(pts)} US 1 vertices → {len(boxes)} boxes")
    return boxes

def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else "mapcache"
    os.makedirs(cache, exist_ok=True)
    boxes = [CITY] + corridor_boxes(cache)
    only = sys.argv[2:] or list(THEMES)
    for theme in only:
        fetch(theme, boxes, cache)

if __name__ == "__main__":
    main()
