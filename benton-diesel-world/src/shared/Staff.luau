--!strict
-- Park staff. Every ride has a crew: an operator at the control console
-- and one or two attendants who walk the loading platform during boarding,
-- checking every lap bar, harness or seatbelt before giving the operator a
-- thumbs up to dispatch. This module works out where they stand (shared by
-- the park builder, the Roblox client and the browser export), what kind of
-- restraint each ride has, the staff uniform and what the staff say.

local Config = require(script.Parent.Config)
local RideMotion = require(script.Parent.RideMotion)
local QueueLine = require(script.Parent.QueueLine)
local Props = require(script.Parent.Props)

local Staff = {}

-- Boarding timeline (seconds after the riders sit down; Config.BoardingTime
-- is the whole boarding window)
Staff.PULL_BY = 3.5 -- riders pull their own restraints down by now
Staff.CHECK_FROM = 2.5 -- attendants start walking the train
Staff.ALL_CLEAR = 1.6 -- seconds before dispatch: thumbs up to the operator
Staff.DISPATCH = 0.6 -- seconds before dispatch: the operator presses the button
Staff.WALK = 7 -- attendant walking speed (studs/s)
Staff.CHECK_TIME = 0.55 -- seconds spent at each car

export type Crew = {
	ride: string,
	restraint: string, -- "lapbar" | "harness" | "belt" | "none"
	console: CFrame, -- the control console (base center, facing the operator)
	operator: CFrame, -- where the operator stands (feet), facing the console
	stops: { CFrame }, -- where an attendant stands to check each car (feet, facing it)
	stopCars: { number }, -- which car each stop checks
	homes: { CFrame }, -- where attendants wait while the ride runs
	exit: CFrame, -- an attendant at the exit side waving riders off
	attendants: number,
}

local RESTRAINT = {
	coaster = "lapbar",
	spinner = "lapbar",
	droptower = "harness",
	pendulum = "harness",
	trucks = "belt",
	karts = "belt",
}

function Staff.restraint(ride: Config.Ride): string
	return RESTRAINT[ride.kind] or "none"
end

-- floor height and rim radius of each flat ride's loading area
type FlatSpec = { floor: number, rim: number }
local FLAT: { [string]: FlatSpec } = {
	carousel = { floor = 2.2, rim = 20 },
	spinner = { floor = 2.0, rim = 24 },
	pendulum = { floor = 4.6, rim = 10 },
	droptower = { floor = 2.4, rim = 12 },
}
Staff.FLAT = FLAT

local function flat(v: Vector3): Vector3
	local f = Vector3.new(v.X, 0, v.Z)
	return if f.Magnitude > 1e-6 then f.Unit else Vector3.new(0, 0, -1)
end

local function facing(p: Vector3, toward: Vector3): CFrame
	local d = flat(toward - p)
	return CFrame.lookAt(p, p + d)
end

-- Station platform frame shared with the ride builder's station().
export type StationFrame = { frame: CFrame, length: number, platformTop: number, halfGap: number }

function Staff.stationFrame(ride: Config.Ride, rest: { CFrame }): StationFrame
	local first, last = rest[1], rest[#rest]
	local trackY = first.Y
	local dir = flat(first.Position - last.Position)
	if #rest == 1 then
		dir = flat(first.LookVector)
	end
	local center = (first.Position + last.Position) / 2
	local length = (first.Position - last.Position).Magnitude + 12
	local frame = CFrame.lookAt(Vector3.new(center.X, 0, center.Z), Vector3.new(center.X, 0, center.Z) + dir)
	local platformTop = math.max(1.2, trackY + (if ride.kind == "train" then -0.4 elseif ride.kind == "tram" then 0.6 else 0.6))
	local halfGap = if ride.kind == "train" or ride.kind == "tram" then 5.2 else 4.6
	return { frame = frame, length = length, platformTop = platformTop, halfGap = halfGap }
end

local cache: { [string]: Crew } = {}

function Staff.crew(rideId: string): Crew?
	if cache[rideId] then
		return cache[rideId]
	end
	local ride: Config.Ride? = nil
	for _, r in Config.Rides do
		if r.id == rideId then
			ride = r
		end
	end
	if not ride then
		return nil
	end
	local found = ride :: Config.Ride
	local motion = RideMotion.get(found.id)
	local rest = motion.pose(0)
	local line = QueueLine.get(found.id)
	local gate = if line then line.gate else found.entrance
	local crew: Crew
	if motion.sampler then
		-- track rides: along the loading platform beside the train
		local sf = Staff.stationFrame(found, rest)
		local frame, length = sf.frame, sf.length
		local floor = sf.platformTop
		local edge = sf.halfGap
		if found.kind == "karts" or found.kind == "trucks" then
			-- no station: the crew stands beside the cars on the road edge
			local drop = if found.kind == "karts" then 0.5 else 1.35
			local width = if found.kind == "karts" then 15 else 8
			floor = math.max(0.05, rest[1].Y - drop + 0.5)
			edge = width / 2 + 0.8
		end
		local localGate = frame:PointToObjectSpace(gate)
		local side = if localGate.X < 0 then -1 else 1
		local stops, stopCars = {}, {}
		for i, cf in rest do
			if #(motion.seats[i] or {}) > 0 then
				local z = frame:PointToObjectSpace(cf.Position).Z
				local p = (frame * CFrame.new(side * (edge + 1.0), 0, z)).Position
				p = Vector3.new(p.X, floor, p.Z)
				table.insert(stops, facing(p, p - frame.RightVector * side))
				table.insert(stopCars, i)
			end
		end
		local consoleP = (frame * CFrame.new(side * (edge + 1.5), 0, -length / 2 + 2.4)).Position
		local operatorP = (frame * CFrame.new(side * (edge + 3.0), 0, -length / 2 + 2.4)).Position
		consoleP = Vector3.new(consoleP.X, floor, consoleP.Z)
		operatorP = Vector3.new(operatorP.X, floor, operatorP.Z)
		local homes = {}
		local attendants = if #stops > 3 then 2 else 1
		for k = 1, attendants do
			local z = if k == 1 then length / 2 - 4 else 0
			local p = (frame * CFrame.new(side * (edge + 1.6), 0, z)).Position
			p = Vector3.new(p.X, floor, p.Z)
			table.insert(homes, facing(p, p - frame.RightVector * side))
		end
		local exitP = (frame * CFrame.new(-side * (edge + 1.6), 0, 0)).Position
		exitP = Vector3.new(exitP.X, floor, exitP.Z)
		crew = {
			ride = found.id,
			restraint = Staff.restraint(found),
			console = facing(consoleP, operatorP),
			operator = facing(operatorP, consoleP),
			stops = stops,
			stopCars = stopCars,
			homes = homes,
			exit = facing(exitP, exitP + frame.RightVector * side),
			attendants = attendants,
		}
	else
		-- flat rides: around the ring of cars on the loading floor
		local o = found.origin
		local spec: FlatSpec = FLAT[found.kind] or { floor = 0.4, rim = 14 }
		local floor = o.Y + spec.floor
		local stops, stopCars = {}, {}
		for i, cf in rest do
			local seats = motion.seats[i] or {}
			if #rest == 1 and #seats > 4 then
				-- one big car with seats all round: stop by every third seat
				for s = 2, #seats, 3 do
					local sp = (cf * seats[s]).Position
					local u = flat(sp - o)
					local r = (Vector3.new(sp.X, 0, sp.Z) - Vector3.new(o.X, 0, o.Z)).Magnitude
					local p = Vector3.new(o.X, floor, o.Z) + u * (r + 2.4)
					table.insert(stops, facing(p, Vector3.new(sp.X, floor, sp.Z)))
					table.insert(stopCars, i)
				end
			elseif #seats > 0 then
				local u = flat(cf.Position - o)
				local r = (Vector3.new(cf.X, 0, cf.Z) - Vector3.new(o.X, 0, o.Z)).Magnitude
				local p = Vector3.new(o.X, floor, o.Z) + u * (r + 3.2)
				table.insert(stops, facing(p, Vector3.new(cf.X, floor, cf.Z)))
				table.insert(stopCars, i)
			end
		end
		local toGate = flat(gate - o)
		local side = CFrame.Angles(0, math.rad(35), 0):VectorToWorldSpace(toGate)
		local consoleP = Vector3.new(o.X, 0.4, o.Z) + side * (spec.rim + 1.6)
		local operatorP = Vector3.new(o.X, 0.4, o.Z) + side * (spec.rim + 3.1)
		local homes = {}
		local attendants = if #stops > 3 then 2 else 1
		for k = 1, attendants do
			local a = CFrame.Angles(0, math.rad(if k == 1 then -12 else 12), 0):VectorToWorldSpace(toGate)
			local p = Vector3.new(o.X, 0.4, o.Z) + a * (spec.rim + 1.8)
			table.insert(homes, facing(p, o))
		end
		local exitP = Vector3.new(o.X, 0.4, o.Z) - toGate * (spec.rim + 1.8)
		crew = {
			ride = found.id,
			restraint = Staff.restraint(found),
			console = facing(consoleP, operatorP),
			operator = facing(operatorP, consoleP),
			stops = stops,
			stopCars = stopCars,
			homes = homes,
			exit = facing(exitP, o),
			attendants = attendants,
		}
	end
	cache[rideId] = crew
	return crew
end

-- Which stops each attendant covers (front half / back half).
function Staff.route(crew: Crew, k: number): { number }
	local n = #crew.stops
	local out = {}
	if crew.attendants == 1 then
		for i = 1, n do
			table.insert(out, i)
		end
	else
		local half = math.ceil(n / 2)
		if k == 1 then
			for i = 1, half do
				table.insert(out, i)
			end
		else
			for i = n, half + 1, -1 do
				table.insert(out, i)
			end
		end
	end
	return out
end

-- Uniform: a polo in the land's color, navy trousers, a name badge.
Staff.PANTS = Color3.fromRGB(34, 44, 72)
Staff.CAP = Color3.fromRGB(28, 34, 52)

function Staff.shirt(landId: string): Color3
	local land = Config.landById(landId)
	return if land then land.color else Color3.fromRGB(196, 40, 40)
end

-- A staff member in uniform (a part-built figure; see Props.guest).
function Staff.figure(seed: number, landId: string, pose: string): Model
	local rng = Random.new(seed + 17)
	local cap = if rng:NextNumber() < 0.45 then Staff.CAP else nil
	return Props.guest(seed, pose, { shirt = Staff.shirt(landId), pants = Staff.PANTS, cap = cap })
end

-- Place a standing staff figure with its feet at `at` and tag it, so other
-- renderers (the browser edition) can draw their own person there.
function Staff.place(parent: Instance, role: string, landId: string, seed: number, at: CFrame, rideId: string?, pose: string?): Model
	local m = Staff.figure(seed, landId, pose or "stand")
	m:PivotTo(at * CFrame.new(0, Props.STAND_HEIGHT, 0))
	m:SetAttribute("Role", role)
	m:SetAttribute("Land", landId)
	m:SetAttribute("Seed", seed)
	if rideId then
		m:SetAttribute("RideId", rideId)
	end
	m:AddTag("StaffSpot")
	m.Parent = parent
	return m
end

-- Things the staff say (speech bubbles).
Staff.LINES = {
	pull = { "Pull down on your lap bar, please!", "Lap bars down, folks!", "Push your restraint down until it clicks!" },
	pullHarness = { "Pull your harness down over your shoulders!", "Harnesses down, please!" },
	belt = { "Buckle up, please!", "Seatbelts on, everyone!" },
	check = { "You're all set!", "Nice and snug!", "Good to go!", "Have a great ride!" },
	checkNone = { "Keep your hands inside!", "Have fun out there!", "Enjoy the ride!" },
	clear = { "All clear!", "Clear!", "Good to go!" },
	dispatch = { "Clear to dispatch!", "Here we go!", "Enjoy your ride!" },
	unload = { "Welcome back!", "Thanks for riding!", "Exit to your right, please!", "Watch your step!" },
	wait = { "Step right up!", "Next train in just a moment!", "Line moves fast today!" },
	shop = { "Welcome in!", "Hi there! Take a look around!", "Let me know if you need anything!" },
	food = { "Hungry? We've got you covered!", "Welcome! What can I get you?", "Fresh and hot!" },
	greeter = { "Welcome to Benton Diesel World!", "Have a great day at the park!", "Grab a map and have fun!" },
	popcorn_cart = { "Popcorn! Fresh popcorn!", "Hot buttered popcorn here!", "Get it while it's warm!" },
	balloon_cart = { "Balloons! Get your balloons!", "Pick a color, any color!", "Don't let it float away!" },
	sweeper = { "Morning!", "Enjoy the park!", "Watch your step there!" },
}

return Staff
