-- Track layouts for every track-based ride, in the ride's local space
-- (origin at the ride's origin, +Y up, -Z north). Each layout returns its
-- control points plus the powered/brake zones that shape its speed.
--
-- Point 1 is always where the front of the train rests in the station; the
-- rest of the train trails behind it, at the end of the circuit.

local Track = require(script.Parent.Track)

type ControlPoint = Track.ControlPoint
type Zone = Track.Zone

export type Layout = {
	points: { ControlPoint },
	zones: { Zone },
	gravity: number?,
	drag: number?,
	minSpeed: number?,
	spacing: number?,
}

local P = Track.P
local V = Vector3.new
local Y = Vector3.yAxis

local function up(x: number, y: number, z: number, p: Vector3): ControlPoint
	return { p = p, up = V(x, y, z).Unit }
end

local function nearestIndex(points: { ControlPoint }, x: number, z: number): number
	local best, bestD = 1, math.huge
	for i, cp in points do
		local d = (cp.p.X - x) ^ 2 + (cp.p.Z - z) ^ 2
		if d < bestD then
			best, bestD = i, d
		end
	end
	return best
end

local Layouts = {}

-- Diesel Thunder: red steel coaster. Lift east, banked drop, airtime hill,
-- vertical loop, and a 540-degree helix home.
function Layouts.DieselThunder(): Layout
	local station = {
		P(-50, 4, 32), -- 1 station
		P(-30, 4, 32), -- 2
		P(-8, 5, 32), -- 3 lift base
		P(8, 15, 32), -- 4
		P(48, 58, 32), -- 5
		P(62, 68, 32), -- 6 crest
	}
	local drop = {
		P(76, 69, 30, -20),
		P(91, 57, 19, -45),
		P(98, 30, -2, -45),
		P(92, 8, -27, -35),
		P(74, 5, -40, -10),
		P(54, 10, -41),
		P(42, 24, -41),
		P(31, 34, -41), -- airtime hill
		P(20, 22, -41),
		P(8, 9, -41),
		P(-4, 4, -41),
		P(-15, 4, -41), -- loop entry
	}
	local loop = Track.loop(V(-15, 4, -41), V(-1, 0, 0), 17, V(0, 0, 1), 8, 10)
	local afterLoop = {
		P(-15, 4, -33), -- loop exit
		P(-36, 6, -33),
		P(-60, 15, -30, -15),
	}
	local helix = Track.arc(V(-85, 0, -2), 26, -90, -630, 22, 6, 12, 40)
	local home = {
		P(-68, 4.5, 30),
	}
	local points = Track.concat(station, drop, loop, afterLoop, helix, home)
	local n = #points
	return {
		points = points,
		zones = {
			{ from = 1, to = 3, mode = "drive", speed = 6, accel = 8 },
			{ from = 3, to = 6, mode = "drive", speed = 11, accel = 12 },
			{ from = n - 1, to = n, mode = "brake", speed = 12, accel = 40 },
			{ from = n, to = n + 1, mode = "drive", speed = 4, accel = 25 },
		},
	}
end

-- Velocity Viper: the park's tallest coaster. Chain lift, 100-stud drop,
-- two vertical loops, an overbanked turn and a zero-g roll.
function Layouts.VelocityViper(): Layout
	local station = {
		P(0, 5, 70), -- 1 station (heading west)
		P(-20, 5, 70), -- 2
		P(-45, 5, 70), -- 3
	}
	local toLift = Track.arc(V(-70, 0, 55), 15, 90, 180, 5, 6, 3, 25)
	local lift = {
		P(-85, 8, 40), -- lift base
		P(-85, 20, 28),
		P(-85, 92, -42),
		P(-85, 100, -52), -- top
	}
	local topTurn = Track.arc(V(-70, 0, -55), 15, 180, 270, 102, 101, 3, 20)
	local drop = {
		P(-50, 92, -72),
		P(-38, 60, -76),
		P(-26, 18, -79),
		P(-14, 5, -80),
		P(4, 5, -80), -- loop 1 entry
	}
	local loop1 = Track.loop(V(4, 5, -80), V(1, 0, 0), 22, V(0, 0, 1), 9, 10)
	local camel = {
		P(4, 5, -71), -- loop 1 exit
		P(24, 6, -71),
		P(40, 22, -71),
		P(52, 44, -70), -- camelback
		P(64, 22, -69),
	}
	local overbank = Track.arc(V(82, 0, -45), 20, -90, 90, 10, 18, 6, 70)
	local roll = {
		P(62, 22, -25),
		up(0, math.cos(math.rad(72)), -math.sin(math.rad(72)), V(48, 28, -25)),
		up(0, math.cos(math.rad(144)), -math.sin(math.rad(144)), V(36, 31, -25)),
		up(0, math.cos(math.rad(216)), -math.sin(math.rad(216)), V(24, 31, -25)),
		up(0, math.cos(math.rad(288)), -math.sin(math.rad(288)), V(12, 28, -25)),
		P(0, 22, -25),
		P(-18, 7, -25),
		P(-32, 5, -25), -- loop 2 entry
	}
	local loop2 = Track.loop(V(-32, 5, -25), V(-1, 0, 0), 18, V(0, 0, 1), 8, 10)
	local back = {
		P(-32, 5, -17), -- loop 2 exit
		P(-48, 6, -15),
	}
	local westTurn = Track.arc(V(-62, 0, 2), 17, -90, -270, 7, 8, 6, 45)
	local hops = {
		P(-40, 6, 21),
		P(-20, 20, 23),
		P(0, 7, 25),
		P(20, 18, 25),
		P(40, 7, 25),
		P(56, 6, 26),
	}
	local eastTurn = Track.arc(V(72, 0, 48), 22, -90, 90, 6, 5, 6, 40)
	local brakes = {
		P(50, 5, 70),
		P(25, 5, 70),
	}
	local points = Track.concat(station, toLift, lift, topTurn, drop, loop1, camel, overbank, roll, loop2, back, westTurn, hops, eastTurn, brakes)
	local liftStart = #station + #toLift + 1
	local liftEnd = liftStart + #lift - 1
	local n = #points
	return {
		points = points,
		zones = {
			{ from = 1, to = liftStart, mode = "drive", speed = 7, accel = 8 },
			{ from = liftStart, to = liftEnd + 2, mode = "drive", speed = 12, accel = 12 },
			{ from = n - 2, to = n, mode = "brake", speed = 14, accel = 45 },
			{ from = n, to = n + 1, mode = "drive", speed = 4, accel = 25 },
		},
	}
end

-- Nitro Loop: launched coaster. Hydraulic launch straight into an
-- Immelmann, a diving turn, a vertical loop and a hilltop finale.
function Layouts.NitroLoop(): Layout
	local station = {
		P(-50, 5, 25), -- 1 station (heading north)
		P(-50, 5, 12), -- 2
		P(-50, 5, 0), -- 3 launch start
		P(-50, 5, -18), -- 4
		P(-50, 5, -30), -- 5 launch end / half-loop entry
	}
	local half = Track.loop(V(-50, 5, -30), V(0, 0, -1), 32, V(1, 0, 0), 24, 6, 0, 180)
	local top: { ControlPoint } = {
		{ p = V(-38, 69, -30), up = -Y },
		up(math.sin(math.rad(60)), -math.cos(math.rad(60)), 0, V(-38, 70, -18)),
		up(math.sin(math.rad(120)), -math.cos(math.rad(120)), 0, V(-38, 70.5, -6)),
		P(-38, 69, 5),
	}
	local dive = {
		P(-36, 52, 15, -20),
		P(-27, 25, 26, -40),
		P(-10, 7, 31, -25),
		P(12, 6, 31),
	}
	local turn = Track.arc(V(35, 0, 10), 21, 90, 0, 6, 6, 3, 40)
	local loop = Track.concat(P(56, 5, -2), Track.loop(V(56, 5, -2), V(0, 0, -1), 19, V(-1, 0, 0), 9, 10))
	local hill = {
		P(47, 5, -2), -- loop exit
		P(47, 6, -24),
		P(45, 28, -42),
	}
	local northTurn = Track.arc(V(25, 0, -62), 13, 0, -180, 12, 14, 6, 40)
	local column = {
		P(8, 20, -40),
		P(-6, 28, -15),
		P(-10, 30, 10),
		P(-10, 24, 32),
	}
	local uturn = Track.arc(V(-30, 0, 50), 20, 0, 180, 12, 5, 6, 35)
	local home = { P(-50, 5, 38) }
	local points = Track.concat(station, half, top, dive, turn, loop, hill, northTurn, column, uturn, home)
	local n = #points
	return {
		points = points,
		zones = {
			{ from = 1, to = 3, mode = "drive", speed = 5, accel = 8 },
			{ from = 3, to = 5, mode = "drive", speed = 90, accel = 135 },
			{ from = n - #uturn, to = n, mode = "brake", speed = 16, accel = 35 },
			{ from = n, to = n + 1, mode = "drive", speed = 4, accel = 25 },
		},
	}
end

-- Runaway Tow Truck: family mine-train style coaster through Backwoods.
function Layouts.RunawayTowTruck(): Layout
	local station = {
		P(15, 4, 50), -- 1 station (heading west)
		P(0, 4, 50), -- 2
		P(-14, 5, 50), -- 3 lift base
		P(-24, 11, 50),
		P(-40, 27, 50), -- 5 lift top
	}
	local first = {
		P(-48, 29, 47, 15),
		P(-53, 26, 36, 20),
		P(-52, 14, 18),
		P(-48, 7, 0),
	}
	local turn1 = Track.arc(V(-30, 0, -30), 18, 180, 270, 7, 9, 3, 30)
	local run = {
		P(-10, 10, -50),
		P(8, 19, -52),
		P(22, 9, -52),
	}
	local turn2 = Track.arc(V(35, 0, -35), 17, 270, 360, 8, 7, 3, 30)
	local back = {
		P(51, 9, -18),
		P(51, 14, -6),
	}
	local helix = Track.arc(V(35, 0, 6), 16, 0, 360, 16, 6, 8, 30)
	local turn3 = Track.arc(V(31, 0, 35), 15, 0, 90, 5, 4, 3, 25)
	local points = Track.concat(station, first, turn1, run, turn2, back, helix, turn3)
	local n = #points
	return {
		points = points,
		zones = {
			{ from = 1, to = 3, mode = "drive", speed = 6, accel = 8 },
			{ from = 3, to = 5, mode = "drive", speed = 9, accel = 10 },
			{ from = n - 2, to = n + 1, mode = "drive", speed = 4, accel = 18 },
		},
		minSpeed = 7,
	}
end

-- Backwoods Rapids: log flume. Lazy river, conveyor lift, elevated channel
-- and a big splashdown.
function Layouts.BackwoodsRapids(): Layout
	local river = {
		P(15, 3, 65), -- 1 station (heading west)
		P(0, 3, 65),
		P(-15, 3, 63),
		P(-28, 3, 57),
		P(-40, 3, 45),
		P(-48, 3, 28),
		P(-42, 3, 12),
		P(-46, 3, -4),
	}
	local lift = {
		P(-45, 4, -16), -- lift start
		P(-45, 10, -22),
		P(-45, 40, -50),
		P(-45, 43, -56), -- lift top
	}
	local topTurn = Track.arc(V(-30, 0, -58), 15, 180, 270, 43.5, 43.5, 3, 0)
	local channel = {
		P(-10, 43.5, -72),
	}
	local turn2 = Track.arc(V(15, 0, -50), 16, 270, 360, 43.5, 43.5, 3, 0)
	local drop = {
		P(31, 43, -38), -- drop start
		P(31, 31, -26),
		P(31, 11, -8),
		P(31, 3, 4), -- splash
		P(32, 3, 18),
		P(38, 3, 34),
	}
	local home = Track.arc(V(30, 0, 50), 15, 0, 90, 3, 3, 3, 0)
	local points = Track.concat(river, lift, topTurn, channel, turn2, drop, home)
	local liftStart = #river + 1
	local liftEnd = liftStart + #lift - 1
	local dropStart = liftEnd + #topTurn + #channel + #turn2 + 1
	local splash = dropStart + 3
	local n = #points
	return {
		points = points,
		zones = {
			{ from = 1, to = liftStart, mode = "drive", speed = 9, accel = 6 },
			{ from = liftStart, to = liftEnd, mode = "drive", speed = 7, accel = 8 },
			{ from = liftEnd, to = dropStart, mode = "drive", speed = 8, accel = 6 },
			{ from = splash, to = splash + 1, mode = "brake", speed = 12, accel = 140 },
			{ from = splash + 1, to = n, mode = "drive", speed = 8, accel = 10 },
			{ from = n, to = n + 1, mode = "drive", speed = 4, accel = 10 },
		},
		minSpeed = 4,
	}
end

-- Lakeside Express: steam train around Benton Family Landing.
function Layouts.LakesideExpress(): Layout
	local points = Track.roundedRect(122, 108, 30, 2.2, 3)
	local n = #points
	return {
		points = points,
		zones = {
			{ from = 1, to = n, mode = "drive", speed = 16, accel = 5 },
			{ from = n, to = n + 1, mode = "drive", speed = 3, accel = 6 },
		},
		spacing = 2,
	}
end

-- Studio Backlot Tram Tour: around the five soundstages.
function Layouts.BacklotTram(): Layout
	local points = Track.roundedRect(110, 34, 14, 1, 3)
	local n = #points
	return {
		points = points,
		zones = {
			{ from = 1, to = n, mode = "drive", speed = 12, accel = 4 },
			{ from = n, to = n + 1, mode = "drive", speed = 3, accel = 4 },
		},
		spacing = 2,
	}
end

-- Little Haulers Truck Trek: a gentle oval with a couple of bumps.
function Layouts.TruckTrek(): Layout
	local points = Track.roundedRect(58, 42, 40, 0.8, 4)
	-- a few little bumps on the straights
	for i, cp in points do
		if i % 3 == 0 then
			points[i] = { p = cp.p + V(0, 1.2, 0) }
		end
	end
	local n = #points
	return {
		points = points,
		zones = {
			{ from = 1, to = n, mode = "drive", speed = 9, accel = 4 },
			{ from = n, to = n + 1, mode = "drive", speed = 3, accel = 4 },
		},
		spacing = 2,
	}
end

-- Velocity Speedway: kart circuit (karts race with their own motion; this
-- is just the racing line). Starts on the north straight heading east.
function Layouts.VelocitySpeedway(): Layout
	local raw = Track.roundedRect(76, 28, 18, 0.6, 3)
	local points = Track.rotateList(raw, nearestIndex(raw, 0, -28))
	return {
		points = points,
		zones = {},
		spacing = 2,
	}
end

return Layouts
