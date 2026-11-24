-- Track geometry and timing shared by the server (which builds rails and
-- knows how long a ride cycle lasts) and the clients (which animate the
-- vehicles along the exact same curve, in sync with server time).
--
-- A track is a closed centripetal Catmull-Rom spline through control points.
-- Each control point may carry an explicit "up" vector (used for loops and
-- rolls) or a bank angle in degrees (positive banks to the right).

local Track = {}

export type ControlPoint = {
	p: Vector3,
	up: Vector3?,
	bank: number?,
}

export type Zone = {
	from: number, -- control point index where the zone starts
	to: number, -- control point index where it ends (#points + 1 = end of track)
	mode: string, -- "drive" (powered: tires, chain lift, launch, current) or "brake"
	speed: number,
	accel: number,
}

export type Profile = {
	zones: { Zone },
	gravity: number?,
	drag: number?,
	minSpeed: number?,
}

export type Sampler = {
	length: number,
	pointS: { number },
	positions: { Vector3 },
	tangents: { Vector3 },
	ups: { Vector3 },
	cum: { number },
	count: number,
	cframeAt: (self: Sampler, s: number) -> CFrame,
	positionAt: (self: Sampler, s: number) -> Vector3,
}

export type Timing = {
	duration: number,
	times: { number },
	sampler: Sampler,
	distanceAt: (self: Timing, t: number) -> number,
	speedAt: (self: Timing, t: number) -> number,
}

local Y = Vector3.yAxis

local function catmullRom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, u: number): Vector3
	-- centripetal parameterisation (alpha = 0.5) avoids cusps and overshoot
	local function knot(a: Vector3, b: Vector3): number
		return math.max((b - a).Magnitude ^ 0.5, 1e-4)
	end
	local t0 = 0
	local t1 = t0 + knot(p0, p1)
	local t2 = t1 + knot(p1, p2)
	local t3 = t2 + knot(p2, p3)
	local t = t1 + (t2 - t1) * u
	local a1 = p0 * ((t1 - t) / (t1 - t0)) + p1 * ((t - t0) / (t1 - t0))
	local a2 = p1 * ((t2 - t) / (t2 - t1)) + p2 * ((t - t1) / (t2 - t1))
	local a3 = p2 * ((t3 - t) / (t3 - t2)) + p3 * ((t - t2) / (t3 - t2))
	local b1 = a1 * ((t2 - t) / (t2 - t0)) + a2 * ((t - t0) / (t2 - t0))
	local b2 = a2 * ((t3 - t) / (t3 - t1)) + a3 * ((t - t1) / (t3 - t1))
	return b1 * ((t2 - t) / (t2 - t1)) + b2 * ((t - t1) / (t2 - t1))
end

-- Rotate vector v around unit axis k by angle (radians), Rodrigues' formula.
function Track.rotate(v: Vector3, k: Vector3, angle: number): Vector3
	local c, s = math.cos(angle), math.sin(angle)
	return v * c + k:Cross(v) * s + k * (k:Dot(v) * (1 - c))
end

local function orthoUp(hint: Vector3, tangent: Vector3): Vector3
	local up = hint - tangent * hint:Dot(tangent)
	if up.Magnitude < 1e-3 then
		-- hint parallel to the tangent: fall back to any perpendicular
		up = tangent:Cross(Vector3.xAxis)
		if up.Magnitude < 1e-3 then
			up = tangent:Cross(Vector3.zAxis)
		end
	end
	return up.Unit
end

local SamplerMethods = {}
SamplerMethods.__index = SamplerMethods

local function locate(self: Sampler, s: number): (number, number)
	local L = self.length
	s = s % L
	local cum = self.cum
	local lo, hi = 1, self.count
	while hi - lo > 1 do
		local mid = (lo + hi) // 2
		if cum[mid] <= s then
			lo = mid
		else
			hi = mid
		end
	end
	local seg = cum[hi] - cum[lo]
	local a = if seg > 0 then (s - cum[lo]) / seg else 0
	return lo, a
end

function SamplerMethods.positionAt(self: Sampler, s: number): Vector3
	local i, a = locate(self, s)
	return self.positions[i]:Lerp(self.positions[i + 1], a)
end

function SamplerMethods.cframeAt(self: Sampler, s: number): CFrame
	local i, a = locate(self, s)
	local pos = self.positions[i]:Lerp(self.positions[i + 1], a)
	local tangent = self.tangents[i]:Lerp(self.tangents[i + 1], a)
	if tangent.Magnitude < 1e-4 then
		tangent = self.tangents[i]
	end
	tangent = tangent.Unit
	local up = orthoUp(self.ups[i]:Lerp(self.ups[i + 1], a), tangent)
	local right = tangent:Cross(up)
	return CFrame.fromMatrix(pos, right, up)
end

-- Build a sampler for a closed track. `spacing` is the approximate distance
-- between dense samples in studs.
function Track.new(points: { ControlPoint }, spacing: number?): Sampler
	local step = spacing or 1.5
	local n = #points
	assert(n >= 4, "a track needs at least 4 control points")
	local function P(i: number): Vector3
		return points[(i - 1) % n + 1].p
	end

	-- resolve an up hint for every control point
	local hints = table.create(n) :: { Vector3 }
	for i = 1, n do
		local cp = points[i]
		local tangent = (P(i + 1) - P(i - 1)).Unit
		local hint: Vector3
		if cp.up then
			hint = cp.up.Unit
		else
			hint = Y
			if cp.bank and cp.bank ~= 0 then
				local flat = Vector3.new(tangent.X, 0, tangent.Z)
				local axis = if flat.Magnitude > 1e-3 then flat.Unit else tangent
				hint = Track.rotate(Y, axis, math.rad(cp.bank))
			end
		end
		hints[i] = hint
	end

	local positions: { Vector3 } = {}
	local ups: { Vector3 } = {}
	local pointS: { number } = {}
	for i = 1, n do
		local p0, p1, p2, p3 = P(i - 1), P(i), P(i + 1), P(i + 2)
		local h1, h2 = hints[i], hints[i % n + 1]
		local segLen = (p2 - p1).Magnitude
		local steps = math.max(2, math.ceil(segLen / step))
		pointS[i] = #positions + 1 -- index for now, converted to distance below
		for k = 0, steps - 1 do
			local u = k / steps
			table.insert(positions, catmullRom(p0, p1, p2, p3, u))
			local w = u * u * (3 - 2 * u)
			local h = h1:Lerp(h2, w)
			if h.Magnitude < 1e-3 then
				h = h1
			end
			table.insert(ups, h.Unit)
		end
	end
	-- close the loop by repeating the first sample
	table.insert(positions, positions[1])
	table.insert(ups, ups[1])

	local count = #positions
	local cum = table.create(count, 0) :: { number }
	for i = 2, count do
		cum[i] = cum[i - 1] + (positions[i] - positions[i - 1]).Magnitude
	end
	local tangents = table.create(count) :: { Vector3 }
	for i = 1, count do
		local prev = if i == 1 then positions[count - 1] else positions[i - 1]
		local nxt = if i == count then positions[2] else positions[i + 1]
		local d = nxt - prev
		tangents[i] = if d.Magnitude > 1e-6 then d.Unit else Vector3.zAxis
	end
	for i = 1, n do
		pointS[i] = cum[pointS[i]]
	end
	table.insert(pointS, cum[count]) -- index n + 1 = end of track

	local self = {
		length = cum[count],
		pointS = pointS,
		positions = positions,
		tangents = tangents,
		ups = ups,
		cum = cum,
		count = count,
	}
	return (setmetatable(self, SamplerMethods) :: any) :: Sampler
end

local TimingMethods = {}
TimingMethods.__index = TimingMethods

function TimingMethods.distanceAt(self: Timing, t: number): number
	local times = self.times
	local count = #times
	if t <= 0 then
		return 0
	end
	if t >= times[count] then
		return self.sampler.length
	end
	local lo, hi = 1, count
	while hi - lo > 1 do
		local mid = (lo + hi) // 2
		if times[mid] <= t then
			lo = mid
		else
			hi = mid
		end
	end
	local cum = self.sampler.cum
	local dt = times[hi] - times[lo]
	local a = if dt > 0 then (t - times[lo]) / dt else 0
	return cum[lo] + (cum[hi] - cum[lo]) * a
end

function TimingMethods.speedAt(self: Timing, t: number): number
	local d1 = self:distanceAt(t - 0.05)
	local d2 = self:distanceAt(t + 0.05)
	return (d2 - d1) / 0.1
end

-- Integrate the train's speed around the track: gravity and drag everywhere,
-- overridden by powered zones (station tires, lift chains, launches, water
-- current) and brake zones. Returns a lookup from elapsed time to distance.
function Track.timing(sampler: Sampler, profile: Profile): Timing
	local g = profile.gravity or 40
	local drag = profile.drag or 0.0006
	local minSpeed = profile.minSpeed or 5
	local zones = {}
	for _, z in profile.zones do
		table.insert(zones, {
			a = sampler.pointS[z.from],
			b = sampler.pointS[z.to],
			mode = z.mode,
			speed = z.speed,
			accel = z.accel,
		})
	end
	local positions, cum = sampler.positions, sampler.cum
	local times = table.create(sampler.count, 0) :: { number }
	local v = 0
	for i = 1, sampler.count - 1 do
		local ds = cum[i + 1] - cum[i]
		local mid = cum[i] + ds * 0.5
		local zone = nil
		for _, z in zones do
			if mid >= z.a and mid < z.b then
				zone = z
				break
			end
		end
		local v2 = v * v
		if zone and zone.mode == "drive" then
			local target2 = zone.speed * zone.speed
			if v2 < target2 then
				v2 = math.min(target2, v2 + 2 * zone.accel * ds)
			else
				v2 = math.max(target2, v2 - 2 * zone.accel * ds)
			end
		else
			local dh = positions[i + 1].Y - positions[i].Y
			v2 = v2 - 2 * g * dh - drag * v2 * ds
			if zone and zone.mode == "brake" then
				local target2 = zone.speed * zone.speed
				if v2 > target2 then
					v2 = math.max(target2, v2 - 2 * zone.accel * ds)
				end
			end
			v2 = math.max(v2, minSpeed * minSpeed)
		end
		local vNew = math.sqrt(v2)
		local avg = math.max((v + vNew) * 0.5, 0.25)
		times[i + 1] = times[i] + ds / avg
		v = vNew
	end
	local self = {
		duration = times[sampler.count],
		times = times,
		sampler = sampler,
	}
	return (setmetatable(self, TimingMethods) :: any) :: Timing
end

---------------------------------------------------------------------------
-- Layout helpers (used by Layouts.luau)
---------------------------------------------------------------------------

function Track.P(x: number, y: number, z: number, bank: number?): ControlPoint
	return { p = Vector3.new(x, y, z), bank = bank }
end

-- Points strictly inside a vertical loop (or part of one). `dir` is the
-- horizontal travel direction at the entry, `lateral` the side the loop
-- drifts toward so the exit clears the entry. Angles in degrees, 0 = bottom.
function Track.loop(
	entry: Vector3,
	dir: Vector3,
	radius: number,
	lateral: Vector3,
	shift: number,
	steps: number,
	fromDeg: number?,
	toDeg: number?
): { ControlPoint }
	local a0 = math.rad(fromDeg or 0)
	local a1 = math.rad(toDeg or 360)
	local out = {}
	for k = 1, steps - 1 do
		local f = k / steps
		local th = a0 + (a1 - a0) * f
		local frac = (th - a0) / (math.rad(360))
		local p = entry + dir * (radius * math.sin(th)) + Y * (radius * (1 - math.cos(th))) + lateral * (shift * frac)
		local up = (-dir * math.sin(th) + Y * math.cos(th)).Unit
		table.insert(out, { p = p, up = up })
	end
	return out
end

-- Points along a circular arc (optionally climbing/descending). Angles in
-- degrees measured from +X toward +Z; increasing angle is a right turn.
function Track.arc(
	center: Vector3,
	radius: number,
	fromDeg: number,
	toDeg: number,
	y0: number,
	y1: number,
	steps: number,
	bank: number?
): { ControlPoint }
	local out = {}
	local sign = if toDeg >= fromDeg then 1 else -1
	for k = 0, steps do
		local f = k / steps
		local a = math.rad(fromDeg + (toDeg - fromDeg) * f)
		local y = y0 + (y1 - y0) * f
		local p = Vector3.new(center.X + math.cos(a) * radius, y, center.Z + math.sin(a) * radius)
		local b = (bank or 0) * sign
		-- ease the bank in and out at the ends of the arc
		local ease = math.sin(math.pi * math.clamp(f, 0, 1))
		if steps >= 2 then
			b *= 0.35 + 0.65 * ease
		end
		table.insert(out, { p = p, bank = b })
	end
	return out
end

-- A rounded rectangle centered on the origin, traversed clockwise when seen
-- from above with north (-Z) up: east along the north edge, south along the
-- east edge, and so on. Starts at the middle of the south edge heading west.
function Track.roundedRect(hx: number, hz: number, r: number, y: number, cornerSteps: number): { ControlPoint }
	local out: { ControlPoint } = {}
	local function add(x: number, z: number)
		table.insert(out, { p = Vector3.new(x, y, z) })
	end
	local function corner(cx: number, cz: number, fromDeg: number)
		for k = 0, cornerSteps do
			local a = math.rad(fromDeg + 90 * k / cornerSteps)
			add(cx + math.cos(a) * r, cz + math.sin(a) * r)
		end
	end
	-- south edge heading west (x decreasing at z = +hz)
	add(0, hz)
	add(-(hx - r) * 0.5, hz)
	corner(-(hx - r), hz - r, 90) -- south-west corner, turning north
	add(-hx, 0)
	corner(-(hx - r), -(hz - r), 180) -- north-west corner, turning east
	add(0, -hz)
	corner(hx - r, -(hz - r), 270) -- north-east corner, turning south
	add(hx, 0)
	corner(hx - r, hz - r, 0) -- south-east corner, turning west
	add((hx - r) * 0.5, hz)
	return out
end

-- Rotate a list so that index `start` comes first.
function Track.rotateList(points: { ControlPoint }, start: number): { ControlPoint }
	local out = {}
	local n = #points
	for i = 0, n - 1 do
		table.insert(out, points[(start - 1 + i) % n + 1])
	end
	return out
end

function Track.concat(...: { ControlPoint } | ControlPoint): { ControlPoint }
	local out: { ControlPoint } = {}
	for _, item in { ... } do
		local t = item :: any
		if t.p then
			table.insert(out, t :: ControlPoint)
		else
			for _, cp in t :: { ControlPoint } do
				table.insert(out, cp)
			end
		end
	end
	return out
end

-- Transform local control points into world space.
function Track.transform(points: { ControlPoint }, cf: CFrame): { ControlPoint }
	local out = {}
	for _, cp in points do
		local up = cp.up
		table.insert(out, {
			p = cf:PointToWorldSpace(cp.p),
			up = if up then cf:VectorToWorldSpace(up) else nil,
			bank = cp.bank,
		})
	end
	return out
end

return Track
