-- Benton Diesel World: everything that defines the park lives here.
-- Coordinates are in studs. +X is east, -Z is north. The front gate is on
-- the south edge (Z = 280) and the parking lot is south of it.

local Config = {}

Config.ParkName = "Benton Diesel World"
Config.Version = "1.0.0"
Config.Currency = "Benton Bucks"
Config.CurrencyShort = "B$"

Config.Bounds = { minX = -375, maxX = 375, minZ = -405, maxZ = 280 }
Config.Spawn = Vector3.new(0, 3, 330)

Config.Colors = {
	Navy = Color3.fromRGB(22, 34, 58),
	NavyLight = Color3.fromRGB(38, 56, 92),
	Steel = Color3.fromRGB(116, 126, 140),
	Orange = Color3.fromRGB(255, 140, 26),
	Red = Color3.fromRGB(196, 40, 40),
	Blue = Color3.fromRGB(30, 110, 230),
	Cream = Color3.fromRGB(250, 243, 224),
	Brick = Color3.fromRGB(150, 62, 44),
	Gold = Color3.fromRGB(240, 196, 64),
	Green = Color3.fromRGB(64, 160, 72),
	Paver = Color3.fromRGB(214, 160, 140),
	Concrete = Color3.fromRGB(196, 190, 180),
}

Config.Economy = {
	StartingBucks = 300,
	StartingPasses = 1,
	RideReward = 15,
	FirstRideBonus = 35,
	ShowReward = 30,
	LandCompleteBonus = 150,
	PlaytimeReward = 10,
	PlaytimeInterval = 120, -- seconds
	DailyBonus = 100,
}

Config.Hunger = {
	Max = 100,
	DrainInterval = 8, -- seconds per point
	HungryAt = 25,
	NormalSpeed = 18,
	HungrySpeed = 14,
}

---------------------------------------------------------------------------
-- Lands
---------------------------------------------------------------------------

export type Land = {
	id: string,
	name: string,
	tagline: string,
	color: Color3,
	-- rectangles {x1, z1, x2, z2}; the first land whose rectangle contains a
	-- point wins, so more specific lands come first
	regions: { { number } },
	center: Vector3,
}

Config.Lands = {
	{
		id = "Plaza",
		name = "Benton Plaza",
		tagline = "Where every adventure starts",
		color = Color3.fromRGB(214, 120, 96),
		regions = { { -70, -125, 70, 280 } },
		center = Vector3.new(0, 0, 120),
	},
	{
		id = "Diesel",
		name = "Diesel District",
		tagline = "Built to keep the world moving",
		color = Color3.fromRGB(176, 72, 52),
		regions = { { -375, -140, -70, 125 } },
		center = Vector3.new(-190, 0, 10),
	},
	{
		id = "Haulers",
		name = "Little Haulers",
		tagline = "Big trucks for little drivers",
		color = Color3.fromRGB(240, 190, 40),
		regions = { { -375, 125, -70, 280 } },
		center = Vector3.new(-200, 0, 210),
	},
	{
		id = "Backwoods",
		name = "Backwoods Junction",
		tagline = "Tow trucks, timber and white water",
		color = Color3.fromRGB(120, 92, 56),
		regions = { { -375, -405, -110, -140 } },
		center = Vector3.new(-220, 0, -260),
	},
	{
		id = "Studios",
		name = "Benton Movie Studios",
		tagline = "Lights, camera, diesel!",
		color = Color3.fromRGB(150, 110, 200),
		regions = { { -110, -405, 115, -125 } },
		center = Vector3.new(0, 0, -260),
	},
	{
		id = "Velocity",
		name = "Velocity City",
		tagline = "Speed fuels people together",
		color = Color3.fromRGB(40, 120, 230),
		regions = { { 115, -405, 375, -60 }, { 70, -125, 375, -60 }, { 185, -60, 375, 30 } },
		center = Vector3.new(220, 0, -200),
	},
	{
		id = "Family",
		name = "Benton Family Landing",
		tagline = "Big dreams by the lake",
		color = Color3.fromRGB(70, 170, 120),
		regions = { { 70, -60, 375, 280 } },
		center = Vector3.new(225, 0, 150),
	},
} :: { Land }

---------------------------------------------------------------------------
-- Rides
---------------------------------------------------------------------------

export type Ride = {
	id: string,
	name: string,
	land: string,
	kind: string, -- coaster | flume | train | tram | trucks | karts | droptower | carousel | spinner | pendulum
	category: string, -- Thrill | Family | Kids
	thrill: number, -- 1..5
	description: string,
	origin: Vector3,
	yaw: number, -- degrees
	entrance: Vector3, -- queue sign + prompt
	exit: Vector3, -- where riders step off
	baseWait: number, -- posted wait (park minutes) at a normal crowd
	colors: { Color3 },
	-- track rides
	layout: string?,
	cars: number?,
	carSpacing: number?,
	carStyle: string?,
	firstCarSeats: number?,
	-- flat rides
	duration: number?,
	-- tram tour effects (fraction of the ride, effect name, side offset)
	cues: { { any } }?,
}

local C = Config.Colors

Config.Rides = {
	-- Diesel District -------------------------------------------------------
	{
		id = "DieselThunder",
		name = "Diesel Thunder",
		land = "Diesel",
		kind = "coaster",
		category = "Thrill",
		thrill = 4,
		description = "A red-steel coaster that roars out of the Benton Garage yard: a 70-stud drop, an airtime hill, a loop and a 540-degree helix.",
		origin = Vector3.new(-240, 0, -90),
		yaw = 0,
		entrance = Vector3.new(-302, 0, -40),
		exit = Vector3.new(-280, 0, -40),
		baseWait = 50,
		colors = { C.Red, Color3.fromRGB(60, 60, 66), C.Gold },
		layout = "DieselThunder",
		cars = 3,
		carSpacing = 7.5,
		carStyle = "coaster",
	},
	{
		id = "PistonPounder",
		name = "Piston Pounder",
		land = "Diesel",
		kind = "pendulum",
		category = "Thrill",
		thrill = 4,
		description = "A giant piston-arm pendulum that swings riders 115 degrees out over Diesel District while the gondola spins.",
		origin = Vector3.new(-120, 0, 78),
		yaw = 90,
		entrance = Vector3.new(-148, 0, 48),
		exit = Vector3.new(-92, 0, 48),
		baseWait = 30,
		colors = { C.Orange, Color3.fromRGB(70, 70, 76), C.Gold },
		duration = 46,
	},
	-- Little Haulers ---------------------------------------------------------
	{
		id = "TruckTrek",
		name = "Little Haulers Truck Trek",
		land = "Haulers",
		kind = "trucks",
		category = "Kids",
		thrill = 1,
		description = "Little drivers take the wheel of their very own big rig for a lap of the Haulers yard.",
		origin = Vector3.new(-275, 0, 205),
		yaw = 0,
		entrance = Vector3.new(-205, 0, 236),
		exit = Vector3.new(-205, 0, 262),
		baseWait = 15,
		colors = { C.Gold, C.Red, C.Blue },
		layout = "TruckTrek",
		cars = 6,
		carSpacing = 11,
		carStyle = "truck",
	},
	-- Backwoods Junction -----------------------------------------------------
	{
		id = "BackwoodsRapids",
		name = "Backwoods Rapids",
		land = "Backwoods",
		kind = "flume",
		category = "Family",
		thrill = 3,
		description = "Float a hollow log down the lazy river, ride the conveyor to the ridge, then plunge 40 studs into Splashdown Pool. You will get wet!",
		origin = Vector3.new(-295, 0, -300),
		yaw = 0,
		entrance = Vector3.new(-278, 0, -220),
		exit = Vector3.new(-256, 0, -220),
		baseWait = 45,
		colors = { Color3.fromRGB(122, 84, 52), Color3.fromRGB(90, 62, 40), Color3.fromRGB(70, 140, 200) },
		layout = "BackwoodsRapids",
		cars = 2,
		carSpacing = 12,
		carStyle = "log",
	},
	{
		id = "RunawayTowTruck",
		name = "Runaway Tow Truck",
		land = "Backwoods",
		kind = "coaster",
		category = "Family",
		thrill = 2,
		description = "Old Rusty the tow truck lost his brakes! Hang on for a rattling family coaster through the Backwoods hills.",
		origin = Vector3.new(-170, 0, -305),
		yaw = 0,
		entrance = Vector3.new(-160, 0, -232),
		exit = Vector3.new(-134, 0, -232),
		baseWait = 30,
		colors = { Color3.fromRGB(200, 120, 40), Color3.fromRGB(96, 70, 50), Color3.fromRGB(230, 200, 80) },
		layout = "RunawayTowTruck",
		cars = 3,
		carSpacing = 7.5,
		carStyle = "mine",
	},
	-- Benton Movie Studios ---------------------------------------------------
	{
		id = "BacklotTram",
		name = "Studio Backlot Tram Tour",
		land = "Studios",
		kind = "tram",
		category = "Family",
		thrill = 2,
		description = "Ride behind the scenes past all five soundstages - just watch out for the special effects crew.",
		origin = Vector3.new(0, 0, -355),
		yaw = 0,
		entrance = Vector3.new(-14, 0, -300),
		exit = Vector3.new(14, 0, -300),
		baseWait = 20,
		colors = { Color3.fromRGB(240, 236, 220), Color3.fromRGB(150, 110, 200), C.Gold },
		layout = "BacklotTram",
		cars = 3,
		carSpacing = 13,
		carStyle = "tram",
		cues = {
			{ 0.18, "fire", Vector3.new(-9, 0, 0) },
			{ 0.42, "flood", Vector3.new(-10, 0, 0) },
			{ 0.66, "explosion", Vector3.new(-14, 0, 0) },
			{ 0.86, "sparks", Vector3.new(-8, 0, 0) },
		},
	},
	-- Velocity City ----------------------------------------------------------
	{
		id = "VelocityViper",
		name = "Velocity Viper",
		land = "Velocity",
		kind = "coaster",
		category = "Thrill",
		thrill = 5,
		description = "The king of Velocity City: a 100-stud drop, two loops, an overbanked turn and a zero-g roll at nearly 90 studs per second.",
		origin = Vector3.new(255, 0, -310),
		yaw = 0,
		entrance = Vector3.new(232, 0, -222),
		exit = Vector3.new(272, 0, -222),
		baseWait = 65,
		colors = { C.Blue, Color3.fromRGB(230, 236, 246), Color3.fromRGB(20, 30, 50) },
		layout = "VelocityViper",
		cars = 4,
		carSpacing = 7.5,
		carStyle = "coaster",
	},
	{
		id = "NitroLoop",
		name = "Nitro Loop",
		land = "Velocity",
		kind = "coaster",
		category = "Thrill",
		thrill = 5,
		description = "Zero to 90 in two seconds! A hydraulic launch fires you straight into an Immelmann, a diving turn and a vertical loop.",
		origin = Vector3.new(295, 0, -140),
		yaw = 0,
		entrance = Vector3.new(232, 0, -112),
		exit = Vector3.new(232, 0, -84),
		baseWait = 60,
		colors = { C.Orange, Color3.fromRGB(40, 40, 46), Color3.fromRGB(255, 220, 120) },
		layout = "NitroLoop",
		cars = 3,
		carSpacing = 7.5,
		carStyle = "coaster",
	},
	{
		id = "TowerDrop",
		name = "Benton Tower Drop",
		land = "Velocity",
		kind = "droptower",
		category = "Thrill",
		thrill = 5,
		description = "Rise 150 studs up the Benton Tower for the best view in the park... then free-fall back down.",
		origin = Vector3.new(140, 0, -250),
		yaw = 0,
		entrance = Vector3.new(150, 0, -222),
		exit = Vector3.new(124, 0, -222),
		baseWait = 45,
		colors = { C.Blue, Color3.fromRGB(28, 32, 44), C.Orange },
		duration = 46,
	},
	{
		id = "VelocitySpeedway",
		name = "Velocity Speedway",
		land = "Velocity",
		kind = "karts",
		category = "Family",
		thrill = 3,
		description = "Two laps, eight karts, one checkered flag. Who will cross the line first?",
		origin = Vector3.new(275, 0, -20),
		yaw = 0,
		entrance = Vector3.new(214, 0, -64),
		exit = Vector3.new(196, 0, -64),
		baseWait = 25,
		colors = { C.Red, C.Blue, C.Gold, C.Green, C.Orange, Color3.fromRGB(160, 80, 200), Color3.fromRGB(240, 240, 240), Color3.fromRGB(30, 30, 30) },
		layout = "VelocitySpeedway",
		cars = 8,
		carSpacing = 7,
		carStyle = "kart",
		duration = 34,
	},
	-- Benton Family Landing --------------------------------------------------
	{
		id = "LakesideExpress",
		name = "Lakeside Express",
		land = "Family",
		kind = "train",
		category = "Family",
		thrill = 1,
		description = "All aboard the Benton steam train for a grand tour around Family Landing and the lake.",
		origin = Vector3.new(225, 0, 155),
		yaw = 0,
		entrance = Vector3.new(250, 0, 248),
		exit = Vector3.new(214, 0, 248),
		baseWait = 15,
		colors = { Color3.fromRGB(30, 90, 60), C.Red, C.Gold },
		layout = "LakesideExpress",
		cars = 5,
		carSpacing = 13,
		carStyle = "coach",
		firstCarSeats = 0,
	},
	{
		id = "GearwheelCarousel",
		name = "Gearwheel Carousel",
		land = "Family",
		kind = "carousel",
		category = "Kids",
		thrill = 1,
		description = "Hand-painted horses gallop around the great brass gearwheel.",
		origin = Vector3.new(148, 0, 205),
		yaw = 0,
		entrance = Vector3.new(150, 0, 234),
		exit = Vector3.new(126, 0, 232),
		baseWait = 10,
		colors = { C.Red, C.Gold, C.Cream },
		duration = 48,
	},
	{
		id = "SpinningPistons",
		name = "Spinning Pistons",
		land = "Family",
		kind = "spinner",
		category = "Family",
		thrill = 2,
		description = "Climb into a giant piston cup and spin as fast as you dare.",
		origin = Vector3.new(150, 0, 120),
		yaw = 0,
		entrance = Vector3.new(152, 0, 152),
		exit = Vector3.new(128, 0, 150),
		baseWait = 15,
		colors = { C.Blue, C.Red, C.Gold, C.Green, C.Orange, Color3.fromRGB(160, 80, 200) },
		duration = 44,
	},
} :: { Ride }

Config.RideById = {} :: { [string]: Ride }
for _, ride in Config.Rides do
	Config.RideById[ride.id] = ride
end

Config.BoardingTime = 5 -- seconds riders sit in the station before dispatch
Config.UnloadTime = 3

---------------------------------------------------------------------------
-- Shows
---------------------------------------------------------------------------

export type Show = {
	id: string,
	name: string,
	land: string,
	venue: string,
	description: string,
	times: { number }, -- park minutes after midnight
	duration: number, -- real seconds
	center: Vector3, -- where the action is
	viewing: Vector3, -- where the audience stands
	viewRadius: number,
}

Config.Shows = {
	{
		id = "BigDreams",
		name = "Big Dreams Live!",
		land = "Family",
		venue = "Lakeside Stage",
		description = "The Benton Family Landing troupe sings and dances while the lake fountains light up.",
		times = { 10 * 60, 12 * 60, 14 * 60, 16 * 60, 18 * 60, 20 * 60 },
		duration = 70,
		center = Vector3.new(225, 0, 186),
		viewing = Vector3.new(225, 0, 222),
		viewRadius = 45,
	},
	{
		id = "StuntSpectacular",
		name = "Diesel Stunt Spectacular",
		land = "Studios",
		venue = "Backlot Stunt Arena",
		description = "Monster trucks, ramp jumps and real explosions from the Benton stunt team.",
		times = { 11 * 60, 13 * 60, 15 * 60, 17 * 60, 19 * 60 },
		duration = 75,
		center = Vector3.new(68, 0, -248),
		viewing = Vector3.new(68, 0, -200),
		viewRadius = 50,
	},
	{
		id = "BigRigParade",
		name = "Big Rig Parade",
		land = "Plaza",
		venue = "Main Street & the Hub",
		description = "Decorated big rigs, dancers and confetti roll from the Hub down Main Street.",
		times = { 12 * 60 + 30, 17 * 60 + 30 },
		duration = 110,
		center = Vector3.new(0, 0, 80),
		viewing = Vector3.new(0, 0, 80),
		viewRadius = 130,
	},
	{
		id = "BentonNights",
		name = "Benton Nights Fireworks",
		land = "Plaza",
		venue = "Over the Benton Globe",
		description = "The park's nighttime finale: fireworks burst over the Benton Globe and Movie Studios.",
		times = { 21 * 60 + 15 },
		duration = 95,
		center = Vector3.new(0, 0, -200),
		viewing = Vector3.new(0, 0, -20),
		viewRadius = 220,
	},
} :: { Show }

Config.ShowById = {} :: { [string]: Show }
for _, show in Config.Shows do
	Config.ShowById[show.id] = show
end

---------------------------------------------------------------------------
-- Shops & restaurants (menus/items live in Items.luau)
---------------------------------------------------------------------------

export type Venue = {
	id: string,
	name: string,
	land: string,
	kind: string, -- "shop" | "restaurant"
	description: string,
	position: Vector3, -- center of the building footprint
	size: Vector3,
	facing: string, -- "N" | "S" | "E" | "W" (which side the counter faces)
	items: { string },
	color: Color3,
}

Config.Venues = {
	-- shops
	{
		id = "Emporium",
		name = "Main Gate Emporium",
		land = "Plaza",
		kind = "shop",
		description = "Gear Ears, balloons and Express Passes.",
		position = Vector3.new(-50, 0, 170),
		size = Vector3.new(40, 26, 36),
		facing = "E",
		items = { "GearEars", "GearBalloon", "GlobeBalloon", "ExpressPass" },
		color = Color3.fromRGB(196, 90, 70),
	},
	{
		id = "GarageOutfitters",
		name = "Benton Garage Outfitters",
		land = "Diesel",
		kind = "shop",
		description = "Workwear for people who keep the world moving.",
		position = Vector3.new(-282, 0, 12),
		size = Vector3.new(80, 32, 64),
		facing = "E",
		items = { "TruckerCap", "HardHat", "WrenchTool", "ExpressPass" },
		color = C.Brick,
	},
	{
		id = "ToyGarage",
		name = "Little Haulers Toy Garage",
		land = "Haulers",
		kind = "shop",
		description = "Toy trucks, cones and the shiniest balloons.",
		position = Vector3.new(-110, 0, 200),
		size = Vector3.new(44, 20, 28),
		facing = "W",
		items = { "ToyTruck", "ConeHat", "TruckBalloon" },
		color = Color3.fromRGB(240, 190, 40),
	},
	{
		id = "TradingPost",
		name = "Tow & Repair Trading Post",
		land = "Backwoods",
		kind = "shop",
		description = "Cowboy hats, lanterns and Old Rusty souvenirs.",
		position = Vector3.new(-290, 0, -180),
		size = Vector3.new(40, 22, 30),
		facing = "E",
		items = { "CowboyHat", "Lantern", "RustyBalloon" },
		color = Color3.fromRGB(130, 92, 60),
	},
	{
		id = "StudioStore",
		name = "Studio Store",
		land = "Studios",
		kind = "shop",
		description = "Director's berets, clapperboards and star shades.",
		position = Vector3.new(-58, 0, -242),
		size = Vector3.new(40, 26, 40),
		facing = "E",
		items = { "DirectorBeret", "StarShades", "Clapperboard", "ExpressPass" },
		color = Color3.fromRGB(150, 110, 200),
	},
	{
		id = "VictoryLane",
		name = "Victory Lane Gear",
		land = "Velocity",
		kind = "shop",
		description = "Racing helmets, checkered flags and passes for the fast lane.",
		position = Vector3.new(135, 0, -180),
		size = Vector3.new(30, 22, 30),
		facing = "E",
		items = { "RacingHelmet", "CheckeredFlag", "ExpressPass" },
		color = C.Blue,
	},
	{
		id = "LakesideGifts",
		name = "Lakeside Gifts",
		land = "Family",
		kind = "shop",
		description = "Captain hats, duck balloons and lakeside keepsakes.",
		position = Vector3.new(323, 0, 115),
		size = Vector3.new(30, 20, 30),
		facing = "W",
		items = { "CaptainHat", "DuckBalloon", "GearBalloon" },
		color = Color3.fromRGB(70, 170, 160),
	},
	-- restaurants
	{
		id = "Bakery",
		name = "Main Street Bakery",
		land = "Plaza",
		kind = "restaurant",
		description = "Gear donuts, cinnamon rolls and fresh coffee.",
		position = Vector3.new(50, 0, 170),
		size = Vector3.new(40, 26, 36),
		facing = "W",
		items = { "GearDonut", "CinnamonRoll", "Coffee" },
		color = Color3.fromRGB(240, 200, 150),
	},
	{
		id = "FuelUpCanteen",
		name = "Fuel Up Canteen",
		land = "Diesel",
		kind = "restaurant",
		description = "Diesel Dogs, pretzels and the legendary Turbo Shake.",
		position = Vector3.new(-205, 0, 90),
		size = Vector3.new(50, 18, 30),
		facing = "E",
		items = { "DieselDog", "Pretzel", "TurboShake" },
		color = Color3.fromRGB(60, 60, 70),
	},
	{
		id = "PorkChopDiner",
		name = "The Pork Chop Diner",
		land = "Backwoods",
		kind = "restaurant",
		description = "Smoky BBQ platters, brisket sandwiches and sweet tea.",
		position = Vector3.new(-130, 0, -190),
		size = Vector3.new(40, 22, 32),
		facing = "W",
		items = { "PorkChopPlatter", "BrisketSandwich", "SweetTea" },
		color = Color3.fromRGB(150, 60, 50),
	},
	{
		id = "Commissary",
		name = "Studio Commissary",
		land = "Studios",
		kind = "restaurant",
		description = "Movie-night popcorn, tacos and nachos for the crew.",
		position = Vector3.new(-58, 0, -188),
		size = Vector3.new(40, 26, 40),
		facing = "E",
		items = { "Popcorn", "StuntTaco", "Nachos" },
		color = Color3.fromRGB(220, 200, 120),
	},
	{
		id = "PitStopPizza",
		name = "Pit Stop Pizza",
		land = "Velocity",
		kind = "restaurant",
		description = "Pizza by the slice, garlic knots and Nitro Soda.",
		position = Vector3.new(135, 0, -88),
		size = Vector3.new(36, 20, 30),
		facing = "W",
		items = { "PizzaSlice", "GarlicKnots", "NitroSoda" },
		color = Color3.fromRGB(220, 60, 50),
	},
	{
		id = "DepotGrill",
		name = "The Depot Grill",
		land = "Family",
		kind = "restaurant",
		description = "Burgers and crinkle fries at the Lakeside Express depot.",
		position = Vector3.new(322, 0, 226),
		size = Vector3.new(36, 20, 30),
		facing = "W",
		items = { "DepotBurger", "CrinkleFries", "Lemonade" },
		color = Color3.fromRGB(150, 90, 60),
	},
} :: { Venue }

Config.VenueById = {} :: { [string]: Venue }
for _, venue in Config.Venues do
	Config.VenueById[venue.id] = venue
end

function Config.landById(id: string): Land?
	for _, land in Config.Lands do
		if land.id == id then
			return land
		end
	end
	return nil
end

function Config.landAt(pos: Vector3): Land?
	for _, land in Config.Lands do
		for _, r in land.regions do
			if pos.X >= r[1] and pos.X <= r[3] and pos.Z >= r[2] and pos.Z <= r[4] then
				return land
			end
		end
	end
	return nil
end

-- Unit vector a venue's counter faces.
function Config.facingVector(facing: string): Vector3
	if facing == "N" then
		return Vector3.new(0, 0, -1)
	elseif facing == "S" then
		return Vector3.new(0, 0, 1)
	elseif facing == "E" then
		return Vector3.new(1, 0, 0)
	end
	return Vector3.new(-1, 0, 0)
end

return Config
