"""
Turn the extracted Overture data into the game's streamed map packs.

  python -I tools/mapdata/build_packs.py <cache-dir> <out-dir>

Everything is projected to the game's local metres (x east, z south; origin at Bayfront
Park, downtown Miami), cut into 2 km packs of 4×4 sub-tiles (500 m), quantized to 0.1 m
integers relative to each sub-tile and delta-encoded, then written as gzipped JSON:

  <out>/index.json       packs present, bounds, category and class code tables
  <out>/p_<i>_<j>.json.gz one pack: { t: { "<u>_<v>": sub-tile }, names: [...] }
  <out>/graph.json.gz    the drivable road graph for routing (nodes, edges)

A sub-tile holds:
  b  buildings  [h, minh, cls, roof, colour, n, x0, z0, dx, dz, ...]  (h in dm)
  r  roads      [cls, name, flags, width_dm, lvl0, lvl1, n, x0, z0, dx, dz, ...]
  g  ground     [kind, rings, len0, len1, ..., x0, z0, dx, dz, ...]   (land use, inland water)
  p  places     [cat, x, z, key]                                     (key: stable hash for names)
  i  piers etc. [kind, n, x0, z0, dx, dz, ...]

Names are kept only for roads (street names are public geography). Businesses keep only
their category and position; the game invents their names.
"""
import os, sys, json, gzip, math, zlib, collections
import numpy as np
import pyarrow.parquet as pq
from shapely import wkb
from shapely.geometry import box, Polygon, MultiPolygon, LineString, MultiLineString, GeometryCollection
from shapely.ops import unary_union, substring
from shapely import transform as shp_transform, clip_by_rect
import time
T0 = time.time()
def log(msg): print(f'[{time.time() - T0:6.0f}s] {msg}', flush=True)

LAT0, LON0 = 25.7743, -80.1937                      # Bayfront Park, downtown Miami
KX = 111320.0 * math.cos(math.radians(LAT0))        # metres per degree of longitude
KZ = 110574.0                                       # metres per degree of latitude
PACK, SUB = 2000.0, 500.0
Q = 10                                              # 0.1 m units

def proj(lon, lat):
    return (lon - LON0) * KX, -(lat - LAT0) * KZ

def project_geom(g):
    return shp_transform(g, lambda c: np.column_stack(((c[:, 0] - LON0) * KX, -(c[:, 1] - LAT0) * KZ)))

DECK = 6.5  # metres per level of an elevated road

ROAD_CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "living_street", "unclassified", "service", "pedestrian", "footway", "steps", "path", "track", "cycleway", "bridleway", "unknown"]
BUILDING_CLASSES = ["", "house", "residential", "apartments", "detached", "semidetached_house", "commercial", "retail", "office", "industrial", "warehouse", "hotel", "school", "university", "hospital", "church", "civic", "government", "garage", "garages", "parking", "service", "shed", "roof", "transportation", "stadium", "other"]
ROOFS = ["", "flat", "gabled", "hipped", "pyramidal", "dome", "skillion", "round", "mansard", "gambrel", "onion", "saltbox", "quadruple_saltbox", "other"]
GROUND = ["land", "park", "grass", "beach", "sand", "golf", "forest", "wetland", "water", "parking", "pedestrian", "cemetery", "airport", "sports", "industrial", "residential", "commercial", "farmland", "construction", "rock", "pier"]
# store kinds the game understands; Overture basic categories map onto them
STORE_KINDS = ["other", "convenience", "gas", "restaurant", "fastfood", "cafe", "bar", "nightclub", "clothes", "electronics", "phone", "pharmacy", "grocery", "hardware", "sports", "guns", "autobody", "cardealer", "bank", "atm", "hotel", "gym", "beauty", "jewelry", "liquor", "furniture", "bookstore", "toys", "pawn", "mall", "cinema", "museum", "school", "hospital", "police", "fire", "worship", "park", "beach", "marina", "office", "laundry", "petstore", "florist", "tattoo", "barber", "motel", "strip_club", "casino", "dispensary"]
CAT_MAP = {
    "convenience_store": "convenience", "food_and_beverage_store": "convenience", "gas_station": "gas",
    "restaurant": "restaurant", "casual_eatery": "restaurant", "fast_food_restaurant": "fastfood", "pizzeria": "fastfood", "burger_restaurant": "fastfood", "sandwich_shop": "fastfood",
    "cafe": "cafe", "coffee_shop": "cafe", "bakery": "cafe", "dessert_shop": "cafe", "ice_cream_shop": "cafe",
    "bar": "bar", "pub": "bar", "lounge": "bar", "wine_bar": "bar", "nightclub": "nightclub", "night_club": "nightclub", "adult_entertainment": "strip_club", "strip_club": "strip_club",
    "fashion_and_apparel_store": "clothes", "clothing_store": "clothes", "shoe_store": "clothes", "shopping": "mall", "shopping_center": "mall", "shopping_mall": "mall", "department_store": "mall",
    "electronics_store": "electronics", "mobile_phone_store": "phone", "telecommunications_service": "phone",
    "pharmacy_and_drug_store": "pharmacy", "pharmacy": "pharmacy", "grocery_store": "grocery", "supermarket": "grocery",
    "hardware_home_and_garden_store": "hardware", "sporting_goods_store": "sports", "gun_store": "guns", "firearms_store": "guns", "gun_shop": "guns",
    "automotive_service": "autobody", "auto_repair": "autobody", "vehicle_parts_store": "autobody", "auto_dealer": "cardealer", "vehicle_dealer": "cardealer", "car_dealer": "cardealer",
    "bank_or_credit_union": "bank", "financial_service": "bank", "atm": "atm",
    "hotel": "hotel", "lodging": "hotel", "motel": "motel", "resort": "hotel",
    "gym": "gym", "sport_or_fitness_facility": "gym", "personal_or_beauty_service": "beauty", "personal_care_and_beauty_store": "beauty", "barber_shop": "barber", "barber": "barber", "hair_salon": "beauty",
    "jewelry_store": "jewelry", "liquor_store": "liquor", "furniture_store": "furniture", "bookstore": "bookstore", "toy_store": "toys", "pawn_shop": "pawn",
    "movie_theater": "cinema", "cinema": "cinema", "museum": "museum", "art_gallery": "museum", "place_of_learning": "school", "school": "school", "college_or_university": "school",
    "hospital": "hospital", "police_station": "police", "fire_station": "fire", "christian_place_of_worship": "worship", "place_of_worship": "worship",
    "park": "park", "beach": "beach", "marina": "marina", "corporate_or_business_office": "office", "laundromat": "laundry", "dry_cleaner": "laundry",
    "pet_store": "petstore", "flowers_and_gifts_store": "florist", "tattoo_parlor": "tattoo", "tattoo_and_piercing": "tattoo", "casino": "casino", "cannabis_dispensary": "dispensary",
}

def code(table, v, default=0):
    try: return table.index(v)
    except ValueError: return default

def ground_kind(theme, subtype, cls):
    s, c = subtype or "", cls or ""
    if theme == "water": return "water"
    if c in ("park", "garden", "dog_park", "playground", "recreation_ground", "village_green", "nature_reserve", "protected_landscape"): return "park"
    if c in ("grass", "meadow", "grassland", "lawn"): return "grass"
    if c in ("beach",): return "beach"
    if c in ("sand", "dune", "shingle"): return "sand"
    if c in ("golf_course", "fairway", "green", "rough", "tee", "driving_range"): return "golf"
    if c in ("forest", "wood", "scrub", "tree_row"): return "forest"
    if c in ("wetland", "marsh", "swamp", "mangrove", "bog", "reedbed", "saltmarsh", "tidalflat"): return "wetland"
    if c in ("parking", "parking_space"): return "parking"
    if c in ("pedestrian", "plaza", "square"): return "pedestrian"
    if c in ("cemetery", "grave_yard"): return "cemetery"
    if c in ("aerodrome", "airport", "apron", "runway", "taxiway", "helipad"): return "airport"
    if c in ("pitch", "stadium", "track", "sports_centre", "baseball", "tennis"): return "sports"
    if c in ("industrial", "port", "railway", "quarry", "landfill"): return "industrial"
    if c in ("residential", "housing"): return "residential"
    if c in ("commercial", "retail"): return "commercial"
    if c in ("farmland", "farmyard", "orchard", "plant_nursery", "vineyard", "allotments"): return "farmland"
    if c in ("construction", "brownfield", "greenfield"): return "construction"
    if c in ("rock", "bare_rock", "reef", "cliff"): return "rock"
    if s == "pier" or c in ("pier", "dock", "boardwalk"): return "pier"
    if theme == "land": return "land"
    return None

class Packs:
    def __init__(self):
        self.packs = collections.defaultdict(lambda: {"t": collections.defaultdict(lambda: collections.defaultdict(list)), "names": [], "nidx": {}})
    def sub(self, x, z):
        i, j = math.floor(x / PACK), math.floor(z / PACK)
        u, v = math.floor((x - i * PACK) / SUB), math.floor((z - j * PACK) / SUB)
        return (i, j), f"{u}_{v}", (i * PACK + u * SUB, j * PACK + v * SUB)
    def name(self, pk, s):
        p = self.packs[pk]
        if s not in p["nidx"]: p["nidx"][s] = len(p["names"]); p["names"].append(s)
        return p["nidx"][s]
    def add(self, pk, st, layer, rec): self.packs[pk]["t"][st][layer].append(rec)

def ring_ints(coords, ox, oz):
    """Quantize a coordinate list to 0.1 m relative to (ox, oz) and delta-encode; drops repeats."""
    out, px, pz, n = [], None, None, 0
    for x, z in coords:
        qx, qz = int(round((x - ox) * Q)), int(round((z - oz) * Q))
        if px is not None and qx == px and qz == pz: continue
        if px is None: out += [qx, qz]
        else: out += [qx - px, qz - pz]
        px, pz = qx, qz; n += 1
    return n, out

def polys(g):
    if g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    if isinstance(g, (MultiPolygon, GeometryCollection)): return [p for q in g.geoms for p in polys(q)]
    return []

def lines(g):
    if g.is_empty: return []
    if isinstance(g, LineString): return [g]
    if isinstance(g, (MultiLineString, GeometryCollection)): return [l for q in g.geoms for l in lines(q)]
    return []

def main():
    cache, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    P = Packs()
    stats = collections.Counter()

    # --- buildings ------------------------------------------------------------------------
    log('buildings')
    t = pq.read_table(os.path.join(cache, "building.parquet"))
    cols = {c: t.column(c).to_pylist() for c in ["height", "min_height", "num_floors", "is_underground", "class", "roof_shape", "facade_color", "geometry"]}
    for k in range(t.num_rows):
        if cols["is_underground"][k]: continue
        g = project_geom(wkb.loads(cols["geometry"][k]))
        for poly in polys(g):
            poly = poly.simplify(0.25, preserve_topology=True)
            if poly.area < 6: continue
            h = cols["height"][k]
            if h is None and cols["num_floors"][k]: h = cols["num_floors"][k] * 3.3
            cls = code(BUILDING_CLASSES, cols["class"][k] or "", len(BUILDING_CLASSES) - 1)
            if h is None:
                # no height in the data: a plausible one from the class and size (seeded by position)
                seed = (int(poly.centroid.x * 7) ^ int(poly.centroid.y * 13)) & 0xffff
                base = {"house": 5.5, "detached": 5.5, "residential": 6.5, "garage": 3, "shed": 2.6, "roof": 4, "commercial": 6, "retail": 6, "industrial": 8, "warehouse": 9}.get(cols["class"][k] or "", 6.0)
                h = base + (seed % 7) * 0.4 + (min(poly.area, 4000) / 4000) * 5
                stats["guessed_height"] += 1
            mh = cols["min_height"][k] or 0
            colour = (cols["facade_color"][k] or "").lstrip("#")
            colour = int(colour, 16) if len(colour) == 6 and all(ch in "0123456789abcdefABCDEF" for ch in colour) else -1
            c = poly.representative_point()
            pk, st, (ox, oz) = P.sub(c.x, c.y)
            n, ints = ring_ints(list(poly.exterior.coords)[:-1], ox, oz)
            if n < 3: continue
            P.add(pk, st, "b", [int(round(h * 10)), int(round(mh * 10)), cls, code(ROOFS, cols["roof_shape"][k] or ""), colour, n] + ints)
            stats["buildings"] += 1
    del t, cols

    # --- roads (segments) and the drivable graph -----------------------------------------
    log(f'roads ({stats["buildings"]} buildings)')
    t = pq.read_table(os.path.join(cache, "segment.parquet"))
    con = pq.read_table(os.path.join(cache, "connector.parquet"))
    cxy = {i: proj(*wkb.loads(g).coords[0]) for i, g in zip(con.column("id").to_pylist(), con.column("geometry").to_pylist())}
    del con
    nodes, node_ix, edges = [], {}, []
    DRIVABLE = {"motorway", "trunk", "primary", "secondary", "tertiary", "residential", "living_street", "unclassified", "service"}
    S = {c: t.column(c).to_pylist() for c in ["names", "subtype", "class", "subclass", "connectors", "road_flags", "level_rules", "speed_limits", "access_restrictions", "width_rules", "routes", "geometry"]}
    # the level each segment has at each of its end connectors, to ramp bridges down to the roads they meet
    seg_level = []
    con_levels = collections.defaultdict(list)
    for k in range(t.num_rows):
        lv = 0
        for lr in (S["level_rules"][k] or []):
            lv = max(lv, lr.get("value") or 0)
        seg_level.append(lv)
        if S["subtype"][k] != "road": continue
        cs = S["connectors"][k] or []
        for c in cs:
            if c.get("at") in (0, 0.0, 1, 1.0): con_levels[c["connector_id"]].append(lv)
    def heights(k, line, coords):
        """Deck height at each vertex: level × DECK, easing down near an end that meets lower roads."""
        lv = seg_level[k]
        if lv <= 0: return None
        cs = S["connectors"][k] or []
        L = max(1.0, line.length)
        def low_at(at):
            c = next((c for c in cs if abs((c.get("at") or 0) - at) < 1e-6), None)
            if not c: return lv
            others = list(con_levels.get(c["connector_id"], []))
            if lv in others: others.remove(lv)
            return min(others) if others else lv
        lo0, lo1 = low_at(0.0), low_at(1.0)
        peak = min(lv * DECK, 0.09 * L + 0.5)
        R = min(90.0, 0.45 * L)
        out, acc = [], 0.0
        prev = coords[0]
        for c in coords:
            acc += math.dist(prev, c); prev = c
            s_ = acc
            h = peak
            if lo0 < lv and s_ < R: f = s_ / R; f = f * f * (3 - 2 * f); h = lo0 * DECK + (peak - lo0 * DECK) * f
            if lo1 < lv and L - s_ < R: f = (L - s_) / R; f = f * f * (3 - 2 * f); h = min(h, lo1 * DECK + (peak - lo1 * DECK) * f)
            out.append(max(0.0, h))
        return out
    def node(cid, xy):
        if cid not in node_ix:
            node_ix[cid] = len(nodes); nodes.append(xy)
        return node_ix[cid]
    for k in range(t.num_rows):
        if S["subtype"][k] != "road": continue
        cls = S["class"][k] or "unknown"
        geom = project_geom(wkb.loads(S["geometry"][k]))
        if geom.is_empty or geom.length < 0.5: continue
        nm = (S["names"][k] or {}).get("primary") or ""
        refs = [r.get("ref") for r in (S["routes"][k] or []) if r.get("ref")]
        flags = 0
        for f in (S["road_flags"][k] or []):
            v = f.get("values") or []
            if "is_bridge" in v: flags |= 1
            if "is_tunnel" in v: flags |= 2
            if "is_link" in v: flags |= 4
        sub = S["subclass"][k] or ""
        if sub == "link": flags |= 4
        oneway = 0
        for a in (S["access_restrictions"][k] or []):
            w = a.get("when") or {}
            if a.get("access_type") == "denied" and w.get("heading") == "backward" and not w.get("mode") : oneway = 1
        if oneway: flags |= 8
        if sub == "driveway": flags |= 16
        if sub in ("sidewalk", "crosswalk"): flags |= 32
        lvls = [lr.get("value") or 0 for lr in (S["level_rules"][k] or []) if not lr.get("between")] or [0]
        lvl = max(lvls)
        for lr in (S["level_rules"][k] or []):
            if lr.get("between"): lvl = max(lvl, lr.get("value") or 0); flags |= 64  # level changes part-way
        width = None
        for wr in (S["width_rules"][k] or []):
            if wr.get("value"): width = wr["value"]
        speed = 0
        for sl in (S["speed_limits"][k] or []):
            ms = sl.get("max_speed") or {}
            if ms.get("value"): speed = ms["value"] * (1.0 if ms.get("unit") == "km/h" else 1.609)
        label = nm or (refs[0] if refs else "")
        if flags & 2: continue  # tunnels (the PortMiami tunnel) are not modelled yet
        # rendering: cut the line at sub-tile borders
        for line in lines(geom):
            coords = list(line.coords)
            hts = heights(k, line, coords)
            hmap = {tuple(c): h for c, h in zip(coords, hts)} if hts else None
            # split into ≤ 250 m pieces so each lands in one sub-tile's mesh
            pieces, cur, acc = [], [coords[0]], 0.0
            for a, b in zip(coords, coords[1:]):
                seg = math.dist(a, b)
                while acc + seg > 250:
                    f = (250 - acc) / seg
                    m = (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
                    cur.append(m); pieces.append(cur); cur = [m]; a = m; seg = math.dist(a, b); acc = 0.0
                cur.append(b); acc += seg
            if len(cur) > 1: pieces.append(cur)
            for pc_ in pieces:
                mid = pc_[len(pc_) // 2]
                pk, st, (ox, oz) = P.sub(*mid)
                # drop repeated points first so the height list matches the vertices kept
                pts = [pc_[0]] + [b for a, b in zip(pc_, pc_[1:]) if (round((b[0] - ox) * Q), round((b[1] - oz) * Q)) != (round((a[0] - ox) * Q), round((a[1] - oz) * Q))]
                n, ints = ring_ints(pts, ox, oz)
                if n < 2: continue
                rec = [code(ROAD_CLASSES, cls, len(ROAD_CLASSES) - 1), P.name(pk, label), flags | (128 if hmap else 0), int(round((width or 0) * 10)), lvl, n] + ints
                if hmap:
                    # heights for split points (not original vertices) come from the nearest original vertex profile
                    def hat(p):
                        if tuple(p) in hmap: return hmap[tuple(p)]
                        best = min(hmap.items(), key=lambda kv: math.dist(kv[0], p))
                        return best[1]
                    rec += [int(round(hat(p) * 10)) for p in pts[:n]]
                P.add(pk, st, "r", rec)
                stats["road_pieces"] += 1
        # graph: drivable roads, split at their connectors
        if cls in DRIVABLE and not (flags & 16):
            cs = S["connectors"][k] or []
            if len(cs) < 2: continue
            line = lines(geom)[0]
            L = line.length
            cs = sorted(cs, key=lambda c: c["at"])
            for c0, c1 in zip(cs, cs[1:]):
                if c0["connector_id"] not in cxy or c1["connector_id"] not in cxy: continue
                a, b = node(c0["connector_id"], cxy[c0["connector_id"]]), node(c1["connector_id"], cxy[c1["connector_id"]])
                if a == b: continue
                # the piece of geometry between the two connectors
                part = substring(line, c0["at"] * L, c1["at"] * L)
                pts = list(part.coords) if hasattr(part, "coords") else [cxy[c0["connector_id"]], cxy[c1["connector_id"]]]
                pts = list(LineString(pts).simplify(0.5).coords) if len(pts) > 2 else pts
                edges.append([a, b, code(ROAD_CLASSES, cls), flags, lvl, int(round(speed)), label, [round(v, 1) for p in pts for v in p]])
                stats["edges"] += 1
    del t, S

    # --- ground: land use and inland water (clipped to sub-tiles) -------------------------
    log(f'ground ({stats["road_pieces"]} road pieces, {stats["edges"]} edges)')
    for theme in ("land_use", "water", "land"):
        path = os.path.join(cache, f"{theme}.parquet")
        if not os.path.exists(path): continue
        t = pq.read_table(path)
        log(f'  {theme}: {t.num_rows} features')
        subtypes, classes, geoms = t.column("subtype").to_pylist(), t.column("class").to_pylist(), t.column("geometry").to_pylist()
        for k in range(t.num_rows):
            kind = ground_kind(theme, subtypes[k], classes[k])
            if kind is None: continue
            g = project_geom(wkb.loads(geoms[k]))
            if theme == "water" and not polys(g): continue
            if not polys(g): continue
            g = g.simplify(0.6, preserve_topology=True)
            x0, z0, x1, z1 = g.bounds
            for sx in range(math.floor(x0 / SUB), math.floor(x1 / SUB) + 1):
                for sz in range(math.floor(z0 / SUB), math.floor(z1 / SUB) + 1):
                    clip = clip_by_rect(g, sx * SUB, sz * SUB, (sx + 1) * SUB, (sz + 1) * SUB)
                    for poly in polys(clip):
                        if poly.area < 4: continue
                        pk, st, (ox, oz) = P.sub(sx * SUB + 1, sz * SUB + 1)
                        rings, ints, lens = [poly.exterior] + list(poly.interiors), [], []
                        for r in rings:
                            n, ii = ring_ints(list(r.coords)[:-1], ox, oz)
                            if n >= 3: lens.append(n); ints += ii
                        if not lens: continue
                        P.add(pk, st, "g", [code(GROUND, kind), len(lens)] + lens + ints)
                        stats["ground_" + kind] += 1
        del t

    # --- places ---------------------------------------------------------------------------
    log('places')
    t = pq.read_table(os.path.join(cache, "place.parquet"), columns=["id", "basic_category", "taxonomy", "confidence", "operating_status", "geometry"])
    ids, cats, tax, conf, ops, geoms = (t.column(c).to_pylist() for c in ["id", "basic_category", "taxonomy", "confidence", "operating_status", "geometry"])
    for k in range(t.num_rows):
        if ops[k] in ("permanently_closed", "temporarily_closed") or (conf[k] or 0) < 0.5: continue
        prim = (tax[k] or {}).get("primary") or ""
        kind = CAT_MAP.get(prim) or CAT_MAP.get(cats[k] or "") or None
        if kind is None:
            hier = (tax[k] or {}).get("hierarchy") or []
            kind = next((CAT_MAP[h] for h in reversed(hier) if h in CAT_MAP), "other")
        x, z = proj(*wkb.loads(geoms[k]).coords[0])
        pk, st, (ox, oz) = P.sub(x, z)
        P.add(pk, st, "p", [code(STORE_KINDS, kind), int(round((x - ox) * Q)), int(round((z - oz) * Q)), zlib.crc32(ids[k].encode()) & 0x7fffffff])
        stats["places_" + kind] += 1
    del t

    # --- infrastructure: piers, boardwalks, bridges' outlines -----------------------------
    path = os.path.join(cache, "infrastructure.parquet")
    if os.path.exists(path):
        t = pq.read_table(path)
        for st_, cl, g in zip(t.column("subtype").to_pylist(), t.column("class").to_pylist(), t.column("geometry").to_pylist()):
            if cl not in ("pier", "boardwalk", "dock", "breakwater", "groyne", "seawall", "bridge"): continue
            g = project_geom(wkb.loads(g))
            for poly in polys(g):
                c = poly.representative_point(); pk, st, (ox, oz) = P.sub(c.x, c.y)
                n, ints = ring_ints(list(poly.simplify(0.3).exterior.coords)[:-1], ox, oz)
                if n >= 3: P.add(pk, st, "i", [code(["pier", "boardwalk", "dock", "breakwater", "groyne", "seawall", "bridge"], cl), n] + ints); stats["infra_" + cl] += 1
            for line in lines(g):
                c = line.interpolate(0.5, normalized=True); pk, st, (ox, oz) = P.sub(c.x, c.y)
                n, ints = ring_ints(list(line.coords), ox, oz)
                if n >= 2: P.add(pk, st, "i", [100 + code(["pier", "boardwalk", "dock", "breakwater", "groyne", "seawall", "bridge"], cl), n] + ints); stats["infra_line_" + cl] += 1
        del t

    # --- write ----------------------------------------------------------------------------
    log('writing')
    index = {"v": 1, "origin": {"lat": LAT0, "lon": LON0, "kx": KX, "kz": KZ}, "pack": PACK, "sub": SUB, "q": Q,
             "roadClasses": ROAD_CLASSES, "buildingClasses": BUILDING_CLASSES, "roofs": ROOFS, "ground": GROUND, "stores": STORE_KINDS, "packs": {}}
    total = 0
    for (i, j), p in sorted(P.packs.items()):
        body = {"t": {k: dict(v) for k, v in p["t"].items()}, "names": p["names"]}
        data = gzip.compress(json.dumps(body, separators=(",", ":")).encode(), 9)
        fn = f"p_{i}_{j}.json.gz"
        open(os.path.join(out, fn), "wb").write(data)
        counts = collections.Counter()
        for stile in p["t"].values():
            for layer, recs in stile.items(): counts[layer] += len(recs)
        index["packs"][f"{i}_{j}"] = {"f": fn, "bytes": len(data), **counts}
        total += len(data)
    g = {"nodes": [round(v, 1) for xy in nodes for v in xy], "edges": edges}
    gdata = gzip.compress(json.dumps(g, separators=(",", ":")).encode(), 9)
    open(os.path.join(out, "graph.json.gz"), "wb").write(gdata)
    index["graph"] = {"f": "graph.json.gz", "bytes": len(gdata), "nodes": len(nodes), "edges": len(edges)}
    json.dump(index, open(os.path.join(out, "index.json"), "w"), separators=(",", ":"))
    print(json.dumps(dict(stats), indent=0)[:3000])
    print(f"{len(P.packs)} packs, {total / 1e6:.1f} MB packs + {len(gdata) / 1e6:.1f} MB graph")

if __name__ == "__main__":
    main()
