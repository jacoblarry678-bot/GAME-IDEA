--!strict
-- Physical queue lines. Every ride has a switchback queue maze near its
-- entrance sign. Guests stand along one path in queue order: the front of
-- the line is the boarding gate (distance 0) and the path runs back through
-- the switchbacks, out under the entrance sign and, if the line ever gets
-- that long, out onto the walkway.
--
-- Shared by the park builder (rails and floors), the server (who is in
-- line, stepping out of line) and the client (guests standing in line).

local Config = require(script.Parent.Config)

local QueueLine = {}

QueueLine.LANE = 4 -- lane width between rails (studs)
QueueLine.SPACING = 2.5 -- distance between guests standing in line
QueueLine.OVERFLOW = 60 -- extra path past the sign for very long lines

-- Maze placement for each ride, found by searching the park for clear
-- ground near each entrance (rows run along the maze's local X axis).
export type Layout = {
	center: Vector3,
	yaw: number, -- degrees
	width: number, -- length of each row, rail to rail
	lanes: number, -- number of rows
	mirror: boolean,
	entry: string, -- "side" or "back": where the path leaves the maze
	corner: Vector3?, -- bend in the walkway between the maze and the sign
}

local V = Vector3.new

QueueLine.LAYOUTS = {
	DieselThunder = { center = V(-258, 0, -42), yaw = 180, width = 28, lanes = 4, mirror = false, entry = "side" },
	PistonPounder = { center = V(-172, 0, 62), yaw = 180, width = 20, lanes = 4, mirror = true, entry = "side", corner = V(-145.27, 0, 56) },
	TruckTrek = { center = V(-207, 0, 250), yaw = 180, width = 36, lanes = 2, mirror = false, entry = "back" },
	BackwoodsRapids = { center = V(-294, 0, -214), yaw = 90, width = 20, lanes = 2, mirror = false, entry = "back" },
	RunawayTowTruck = { center = V(-114, 0, -236), yaw = 180, width = 24, lanes = 4, mirror = false, entry = "side" },
	BacklotTram = { center = V(36, 0, -298), yaw = 270, width = 24, lanes = 4, mirror = true, entry = "back" },
	VelocityViper = { center = V(252, 0, -216), yaw = 270, width = 24, lanes = 4, mirror = true, entry = "back" },
	NitroLoop = { center = V(228, 0, -140), yaw = 90, width = 32, lanes = 4, mirror = true, entry = "side", corner = V(234, 0, -113.62) },
	TowerDrop = { center = V(178, 0, -228), yaw = 180, width = 36, lanes = 2, mirror = false, entry = "side" },
	VelocitySpeedway = { center = V(232, 0, -68), yaw = 0, width = 20, lanes = 3, mirror = false, entry = "side" },
	LakesideExpress = { center = V(268, 0, 224), yaw = 270, width = 36, lanes = 2, mirror = false, entry = "side" },
	GearwheelCarousel = { center = V(122, 0, 206), yaw = 270, width = 36, lanes = 2, mirror = false, entry = "side" },
	SpinningPistons = { center = V(168, 0, 164), yaw = 270, width = 20, lanes = 6, mirror = true, entry = "back", corner = V(154.5, 0, 148.01) },
} :: { [string]: Layout }

export type Line = {
	ride: string,
	points: { Vector3 }, -- gate -> back of the line (y = 0)
	cum: { number }, -- distance along the path at each point
	length: number, -- total path length (including overflow)
	signAt: number, -- distance from the gate to the entrance sign
	mazeCFrame: CFrame,
	mazeSize: Vector3, -- width x 0 x depth
	walls: { { Vector3 } }, -- rail runs {a, b}
	walkway: { Vector3 }, -- maze entry -> just inside the sign (railed both sides)
	gate: Vector3, -- front of the line
	gateDir: Vector3, -- direction the front guest faces (toward the station)
	entrance: Vector3,
	outward: Vector3, -- direction from the ride out through the sign
}

local function flat(v: Vector3): Vector3
	local f = Vector3.new(v.X, 0, v.Z)
	return if f.Magnitude > 1e-6 then f.Unit else Vector3.new(0, 0, 1)
end

-- Path and rails in maze-local coordinates (x along the rows).
local function localPath(width: number, lanes: number, entry: string): { Vector2 }
	local lane = QueueLine.LANE
	local depth = lanes * lane
	local xa, xb = -width / 2 + lane / 2, width / 2 - lane / 2
	local pts = { Vector2.new(width / 2 + 1, -depth / 2 + lane / 2) }
	for i = 0, lanes - 1 do
		local z = -depth / 2 + lane / 2 + i * lane
		local a, b = xb, xa
		if i % 2 == 1 then
			a, b = xa, xb
		end
		table.insert(pts, Vector2.new(a, z))
		table.insert(pts, Vector2.new(b, z))
	end
	local last = pts[#pts]
	if entry == "side" then
		table.insert(pts, Vector2.new(if last.X < 0 then -width / 2 - 1.5 else width / 2 + 1.5, last.Y))
	else
		table.insert(pts, Vector2.new(last.X, depth / 2 + 1.5))
	end
	local out = { pts[1] }
	for i = 2, #pts do
		if (pts[i] - out[#out]).Magnitude > 1e-6 then
			table.insert(out, pts[i])
		end
	end
	return out
end

local function localWalls(width: number, lanes: number, entry: string): { { Vector2 } }
	local lane = QueueLine.LANE
	local hw, hd = width / 2, lanes * lane / 2
	local walls: { { Vector2 } } = {}
	local function add(ax: number, az: number, bx: number, bz: number)
		table.insert(walls, { Vector2.new(ax, az), Vector2.new(bx, bz) })
	end
	-- separators between rows, open at the end where the path turns
	for i = 0, lanes - 2 do
		local z = -hd + lane * (i + 1)
		if i % 2 == 0 then
			add(-hw + lane, z, hw, z)
		else
			add(-hw, z, hw - lane, z)
		end
	end
	add(-hw, -hd, hw, -hd) -- front
	local endsLeft = (lanes - 1) % 2 == 0
	if entry == "back" then
		if endsLeft then
			add(-hw + lane, hd, hw, hd)
		else
			add(-hw, hd, hw - lane, hd)
		end
	else
		add(-hw, hd, hw, hd)
	end
	if entry == "side" and endsLeft then
		add(-hw, -hd, -hw, hd - lane)
	else
		add(-hw, -hd, -hw, hd)
	end
	-- right side: the boarding gate opens from the first row
	if entry == "side" and not endsLeft then
		add(hw, -hd + lane, hw, hd - lane)
	else
		add(hw, -hd + lane, hw, hd)
	end
	local out = {}
	for _, w in walls do
		if (w[2] - w[1]).Magnitude > 0.01 then
			table.insert(out, w)
		end
	end
	return out
end

local cache: { [string]: Line } = {}

function QueueLine.get(rideId: string): Line?
	local hit = cache[rideId]
	if hit then
		return hit
	end
	local layout = QueueLine.LAYOUTS[rideId]
	local found: Config.Ride? = nil
	for _, r in Config.Rides do
		if r.id == rideId then
			found = r
		end
	end
	if not layout or not found then
		return nil
	end
	local ride = found :: Config.Ride
	local mazeCF = CFrame.new(layout.center.X, 0, layout.center.Z) * CFrame.Angles(0, math.rad(layout.yaw), 0)
	local sx = if layout.mirror then -1 else 1
	local function toWorld(p: Vector2): Vector3
		local w = mazeCF * Vector3.new(p.X * sx, 0, p.Y)
		return Vector3.new(w.X, 0, w.Z)
	end
	local points: { Vector3 } = {}
	for _, p in localPath(layout.width, layout.lanes, layout.entry) do
		table.insert(points, toWorld(p))
	end
	local outward = flat(ride.entrance - ride.origin)
	local sign = Vector3.new(ride.entrance.X, 0, ride.entrance.Z)
	local inside = sign - outward * 4
	-- the walkway starts at the gap in the maze rail, 1.5 studs back
	local entryPt = points[#points]
	local walkway = { entryPt + flat(points[#points - 1] - entryPt) * 1.5, entryPt }
	local corner = layout.corner
	if corner then
		local c = Vector3.new(corner.X, 0, corner.Z)
		table.insert(points, c)
		table.insert(walkway, c)
	end
	table.insert(points, inside)
	table.insert(walkway, inside)
	local signIndex = #points + 1
	table.insert(points, sign)
	table.insert(points, sign + outward * QueueLine.OVERFLOW)
	local cum = { 0 }
	for i = 2, #points do
		cum[i] = cum[i - 1] + (points[i] - points[i - 1]).Magnitude
	end
	local walls = {}
	for _, w in localWalls(layout.width, layout.lanes, layout.entry) do
		table.insert(walls, { toWorld(w[1]), toWorld(w[2]) })
	end
	local line: Line = {
		ride = rideId,
		points = points,
		cum = cum,
		length = cum[#cum],
		signAt = cum[signIndex],
		mazeCFrame = mazeCF,
		mazeSize = Vector3.new(layout.width, 0, layout.lanes * QueueLine.LANE),
		walls = walls,
		walkway = walkway,
		gate = points[1],
		gateDir = flat(points[1] - points[2]),
		entrance = sign,
		outward = outward,
	}
	cache[rideId] = line
	return line
end

-- Position on the path `s` studs back from the gate, and the direction a
-- guest standing there faces (toward the front of the line).
function QueueLine.pointAt(line: Line, s: number): (Vector3, Vector3)
	local pts, cum = line.points, line.cum
	s = math.clamp(s, 0, line.length)
	for i = 2, #pts do
		if s <= cum[i] or i == #pts then
			local seg = cum[i] - cum[i - 1]
			local u = if seg > 0 then (s - cum[i - 1]) / seg else 0
			local a, b = pts[i - 1], pts[i]
			return a:Lerp(b, math.clamp(u, 0, 1)), flat(a - b)
		end
	end
	return pts[1], line.gateDir
end

-- Closest point on the path to `pos`: distance along the path and how far
-- away (flat) the position is.
function QueueLine.project(line: Line, pos: Vector3): (number, number)
	local p = Vector3.new(pos.X, 0, pos.Z)
	local bestS, bestD = 0, math.huge
	local pts, cum = line.points, line.cum
	for i = 2, #pts do
		local a, b = pts[i - 1], pts[i]
		local ab = b - a
		local len2 = ab:Dot(ab)
		local u = if len2 > 0 then math.clamp((p - a):Dot(ab) / len2, 0, 1) else 0
		local q = a + ab * u
		local d = (p - q).Magnitude
		if d < bestD then
			bestD = d
			bestS = cum[i - 1] + (cum[i] - cum[i - 1]) * u
		end
	end
	return bestS, bestD
end

-- Distance along the path where the guest at queue index `index`
-- (1 = next to board) stands.
function QueueLine.slot(index: number): number
	return (index - 1) * QueueLine.SPACING
end

-- How many guests fit between the gate and the entrance sign.
function QueueLine.capacity(line: Line): number
	return math.floor(line.signAt / QueueLine.SPACING) + 1
end

return QueueLine
