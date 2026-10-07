-- Deterministic ride motion. Given a ride and the seconds since dispatch,
-- returns the world CFrame of every car (and of moving scenery such as a
-- carousel platform or a pendulum arm). The server uses it for seat
-- positions and cycle length; every client uses it to animate the ride
-- smoothly in sync with server time.

local Config = require(script.Parent.Config)
local Track = require(script.Parent.Track)
local Layouts = require(script.Parent.Layouts)

type Ride = Config.Ride

export type Motion = {
	ride: Ride,
	duration: number,
	carCount: number,
	seats: { { CFrame } }, -- seats[car][n] = rider root CFrame in car space
	capacity: number,
	originCF: CFrame,
	sampler: Track.Sampler?,
	timing: Track.Timing?,
	extras: { string },
	pose: (t: number) -> ({ CFrame }, { [string]: CFrame }),
}

local RideMotion = {}

local TAU = math.pi * 2

local function smoothstep(x: number): number
	x = math.clamp(x, 0, 1)
	return x * x * (3 - 2 * x)
end

-- Angle swept by something that ramps up to `omega`, holds, and ramps down.
local function rampAngle(t: number, T: number, ramp: number, omega: number): number
	if t <= 0 then
		return 0
	end
	local total = omega * (T - ramp)
	if t >= T then
		return total
	elseif t < ramp then
		return 0.5 * omega / ramp * t * t
	elseif t < T - ramp then
		return 0.5 * omega * ramp + omega * (t - ramp)
	end
	local r = T - t
	return total - 0.5 * omega / ramp * r * r
end

RideMotion.rampAngle = rampAngle

-- Seat layouts (rider HumanoidRootPart targets) per vehicle style.
local SeatStyles: { [string]: { CFrame } } = {
	coaster = {
		CFrame.new(-1.25, 2.1, -1.3),
		CFrame.new(1.25, 2.1, -1.3),
		CFrame.new(-1.25, 2.1, 1.5),
		CFrame.new(1.25, 2.1, 1.5),
	},
	mine = {
		CFrame.new(-1.2, 2.1, -1.3),
		CFrame.new(1.2, 2.1, -1.3),
		CFrame.new(-1.2, 2.1, 1.5),
		CFrame.new(1.2, 2.1, 1.5),
	},
	log = {
		CFrame.new(0, 1.9, -3),
		CFrame.new(0, 1.9, -1),
		CFrame.new(0, 1.9, 1),
		CFrame.new(0, 1.9, 3),
	},
	coach = {
		CFrame.new(-1.4, 3.3, -2.4),
		CFrame.new(1.4, 3.3, -2.4),
		CFrame.new(-1.4, 3.3, 2.2),
		CFrame.new(1.4, 3.3, 2.2),
	},
	tram = {
		CFrame.new(-1.5, 3.1, -3.6),
		CFrame.new(1.5, 3.1, -3.6),
		CFrame.new(-1.5, 3.1, 0),
		CFrame.new(1.5, 3.1, 0),
		CFrame.new(-1.5, 3.1, 3.6),
		CFrame.new(1.5, 3.1, 3.6),
	},
	truck = {
		CFrame.new(-0.9, 2.4, -1.6),
		CFrame.new(0.9, 2.4, -1.6),
	},
	kart = {
		CFrame.new(0, 1.7, 0.4),
	},
}

local function ring(count: number, radius: number, height: number, inward: boolean?): { CFrame }
	local out = {}
	for k = 0, count - 1 do
		local a = TAU * k / count
		if inward then
			table.insert(out, CFrame.Angles(0, a, 0) * CFrame.new(0, height, radius))
		else
			table.insert(out, CFrame.Angles(0, a, 0) * CFrame.new(0, height, -radius))
		end
	end
	return out
end

local function originOf(ride: Ride): CFrame
	return CFrame.new(ride.origin) * CFrame.Angles(0, math.rad(ride.yaw), 0)
end

local function trackMotion(ride: Ride): Motion
	local layoutFn = (Layouts :: any)[ride.layout :: string] :: (() -> Layouts.Layout)?
	assert(layoutFn, "missing layout for " .. ride.id)
	local layout = layoutFn()
	local originCF = originOf(ride)
	local sampler = Track.new(Track.transform(layout.points, originCF), layout.spacing)
	local timing = Track.timing(sampler, {
		zones = layout.zones,
		gravity = layout.gravity,
		drag = layout.drag,
		minSpeed = layout.minSpeed,
	})
	local cars = ride.cars or 1
	local spacing = ride.carSpacing or 8
	local style = SeatStyles[ride.carStyle or "coaster"] or SeatStyles.coaster
	local seats = {}
	local capacity = 0
	for i = 1, cars do
		if i == 1 and ride.firstCarSeats == 0 then
			seats[i] = {}
		else
			seats[i] = style
			capacity += #style
		end
	end

	local pose: (t: number) -> ({ CFrame }, { [string]: CFrame })
	local duration: number
	if ride.kind == "karts" then
		duration = ride.duration or 34
		local L = sampler.length
		local rng = Random.new(42)
		local amp, freq, phase = {}, {}, {}
		for i = 1, cars do
			amp[i] = rng:NextNumber(5, 15)
			freq[i] = rng:NextInteger(1, 3)
			phase[i] = rng:NextNumber(0, TAU)
		end
		pose = function(t: number): ({ CFrame }, { [string]: CFrame })
			local u = math.clamp(t / duration, 0, 1)
			local base = 2 * L * (u - math.sin(TAU * u) / TAU)
			local env = math.sin(math.pi * u) ^ 2
			local out: { CFrame } = {}
			for i = 1, cars do
				local s = -(i - 1) * spacing + base + amp[i] * env * math.sin(TAU * freq[i] * u + phase[i]) - amp[i] * env * math.sin(phase[i])
				local lane = (if i % 2 == 0 then 3 else -3) + 1.2 * env * math.sin(TAU * 3 * u + i)
				out[i] = sampler:cframeAt(s) * CFrame.new(lane, 0, 0)
			end
			return out, {}
		end
	else
		duration = timing.duration
		pose = function(t: number): ({ CFrame }, { [string]: CFrame })
			local s = timing:distanceAt(t)
			local out: { CFrame } = {}
			for i = 1, cars do
				out[i] = sampler:cframeAt(s - (i - 1) * spacing)
			end
			return out, {}
		end
	end

	return {
		ride = ride,
		duration = duration,
		carCount = cars,
		seats = seats,
		capacity = capacity,
		originCF = originCF,
		sampler = sampler,
		timing = timing,
		extras = {},
		pose = pose,
	}
end

local function dropTowerMotion(ride: Ride): Motion
	local originCF = originOf(ride)
	local T = ride.duration or 46
	local H = 150
	local g = 45
	local fallTo = 60
	local tFall = math.sqrt(2 * (H - fallTo) / g)
	local vFall = g * tFall
	local brakeDist = fallTo - 3
	local decel = vFall * vFall / (2 * brakeDist)
	local tBrake = vFall / decel
	local tTop, tHold = 30, 34
	local tLand = tHold + tFall + tBrake
	local function height(t: number): number
		if t < 3 then
			return 0
		elseif t < tTop then
			return H * smoothstep((t - 3) / (tTop - 3))
		elseif t < tHold then
			return H
		elseif t < tHold + tFall then
			local tau = t - tHold
			return H - 0.5 * g * tau * tau
		elseif t < tLand then
			local tau = t - tHold - tFall
			return fallTo - (vFall * tau - 0.5 * decel * tau * tau)
		elseif t < tLand + 3 then
			return 3 * (1 - smoothstep((t - tLand) / 3))
		end
		return 0
	end
	local seats = { ring(12, 8.6, 1.6) }
	return {
		ride = ride,
		duration = T,
		carCount = 1,
		seats = seats,
		capacity = 12,
		originCF = originCF,
		extras = {},
		pose = function(t: number): ({ CFrame }, { [string]: CFrame })
			local rot = TAU * smoothstep((t - 3) / (tTop - 3))
			return { originCF * CFrame.new(0, 4 + height(t), 0) * CFrame.Angles(0, rot, 0) }, {}
		end,
	}
end

local function carouselMotion(ride: Ride): Motion
	local originCF = originOf(ride)
	local T = ride.duration or 48
	local ramp = 6
	local omega = TAU * 3 / (T - ramp) -- exactly three turns per cycle
	local count = 12
	local seats = {}
	for i = 1, count do
		seats[i] = { CFrame.new(0, 2.2, 0.3) }
	end
	return {
		ride = ride,
		duration = T,
		carCount = count,
		seats = seats,
		capacity = count,
		originCF = originCF,
		extras = { "Platform" },
		pose = function(t: number): ({ CFrame }, { [string]: CFrame })
			local theta = rampAngle(t, T, ramp, omega)
			local out: { CFrame } = {}
			for i = 1, count do
				local phi = TAU * (i - 1) / count
				local bob = 1.1 * math.sin(3 * theta + i * 1.7)
				local r = if i % 2 == 0 then 10 else 14
				out[i] = originCF * CFrame.Angles(0, theta + phi, 0) * CFrame.new(r, 4.6 + bob, 0)
			end
			return out, { Platform = originCF * CFrame.Angles(0, theta, 0) }
		end,
	}
end

local function spinnerMotion(ride: Ride): Motion
	local originCF = originOf(ride)
	local T = ride.duration or 44
	local ramp = 5
	local omegaP = TAU * 2 / (T - ramp)
	local omegaC = TAU * 9 / (T - ramp)
	local count = 6
	local seats = {}
	for i = 1, count do
		seats[i] = ring(3, 2.3, 1.9, true)
	end
	return {
		ride = ride,
		duration = T,
		carCount = count,
		seats = seats,
		capacity = count * 3,
		originCF = originCF,
		extras = { "Platform" },
		pose = function(t: number): ({ CFrame }, { [string]: CFrame })
			local theta = rampAngle(t, T, ramp, omegaP)
			local spin = rampAngle(t, T, ramp, omegaC)
			local out: { CFrame } = {}
			for i = 1, count do
				local phi = TAU * (i - 1) / count
				local dir = if i % 2 == 0 then 1 else -1
				out[i] = originCF * CFrame.Angles(0, theta + phi, 0) * CFrame.new(11, 2, 0) * CFrame.Angles(0, spin * dir, 0)
			end
			return out, { Platform = originCF * CFrame.Angles(0, theta, 0) }
		end,
	}
end

local function pendulumMotion(ride: Ride): Motion
	local originCF = originOf(ride)
	local T = ride.duration or 46
	local pivotCF = originCF * CFrame.new(0, 34, 0)
	local period = 6.4
	local maxA = math.rad(115)
	local spinOmega = TAU * 3 / (T - 2 - 6)
	return {
		ride = ride,
		duration = T,
		carCount = 1,
		seats = { ring(12, 5, 1.6) },
		capacity = 12,
		originCF = originCF,
		extras = { "Arm" },
		pose = function(t: number): ({ CFrame }, { [string]: CFrame })
			local env
			if t < 2 then
				env = 0
			elseif t < 20 then
				env = (t - 2) / 18
			elseif t < 34 then
				env = 1
			elseif t < 44 then
				env = 1 - (t - 34) / 10
			else
				env = 0
			end
			local phi = maxA * env * math.sin(TAU * math.max(t - 2, 0) / period)
			local spin = rampAngle(t - 2, T - 2, 6, spinOmega)
			local arm = pivotCF * CFrame.Angles(0, 0, phi)
			return { arm * CFrame.new(0, -28, 0) * CFrame.Angles(0, spin, 0) }, { Arm = arm }
		end,
	}
end

local cache: { [string]: Motion } = {}

function RideMotion.get(rideId: string): Motion
	local cached = cache[rideId]
	if cached then
		return cached
	end
	local ride = Config.RideById[rideId]
	assert(ride, "unknown ride " .. rideId)
	local motion: Motion
	if ride.kind == "droptower" then
		motion = dropTowerMotion(ride)
	elseif ride.kind == "carousel" then
		motion = carouselMotion(ride)
	elseif ride.kind == "spinner" then
		motion = spinnerMotion(ride)
	elseif ride.kind == "pendulum" then
		motion = pendulumMotion(ride)
	else
		motion = trackMotion(ride)
	end
	cache[rideId] = motion
	return motion
end

-- Flattened seat list: { {car, seatIndex}, ... } in boarding order.
function RideMotion.seatList(motion: Motion): { { number } }
	local out = {}
	for car = 1, motion.carCount do
		for s = 1, #motion.seats[car] do
			table.insert(out, { car, s })
		end
	end
	return out
end

return RideMotion
