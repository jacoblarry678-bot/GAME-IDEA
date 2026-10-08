-- Themed scenery for each land, the two show venues (Lakeside Stage and
-- the Backlot Stunt Arena), and trees scattered wherever there is room.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local QueueLine = require(Shared.QueueLine)
local Kit = require(script.Parent.Kit)
local Theming = require(script.Parent.Theming)

local M = Enum.Material
local C = Config.Colors
local HALF_PI = math.pi / 2

local Lands = {}

local function look(pos: Vector3, dir: Vector3): CFrame
	return CFrame.lookAt(pos, pos + dir)
end

-- Rectangles (x1, z1, x2, z2) where trees must not grow.
local blocked: { { number } } = {}
local function block(x1: number, z1: number, x2: number, z2: number)
	table.insert(blocked, { math.min(x1, x2), math.min(z1, z2), math.max(x1, x2), math.max(z1, z2) })
end
local function blockCircle(x: number, z: number, r: number)
	block(x - r, z - r, x + r, z + r)
end

local function isFree(x: number, z: number, margin: number): boolean
	for _, r in blocked do
		if x > r[1] - margin and x < r[3] + margin and z > r[2] - margin and z < r[4] + margin then
			return false
		end
	end
	return true
end

-- Big vintage truck statue ("Old No. 1"), facing cf.LookVector.
local function truckStatue(parent: Instance, cf: CFrame, color: Color3, scale: number)
	local s = scale
	Kit.block(parent, Vector3.new(14, 3, 26) * s, cf * CFrame.new(0, 1.5 * s, 0), Color3.fromRGB(150, 146, 140), M.Concrete)
	local base = cf * CFrame.new(0, 3 * s, 0)
	Kit.block(parent, Vector3.new(9, 1.5, 22) * s, base * CFrame.new(0, 2.2 * s, 0), Color3.fromRGB(40, 40, 44), M.Metal)
	Kit.block(parent, Vector3.new(9, 6, 7) * s, base * CFrame.new(0, 5.5 * s, -5 * s), color, M.SmoothPlastic)
	Kit.block(parent, Vector3.new(8, 4, 6) * s, base * CFrame.new(0, 4.5 * s, -10.5 * s), color, M.SmoothPlastic)
	Kit.block(parent, Vector3.new(6.6, 3, 0.4) * s, base * CFrame.new(0, 4.5 * s, -13.6 * s), Color3.fromRGB(200, 200, 205), M.Metal)
	local glass = Kit.block(parent, Vector3.new(7, 2.4, 0.3) * s, base * CFrame.new(0, 7 * s, -8.6 * s), Color3.fromRGB(150, 200, 230), M.Glass)
	glass.Transparency = 0.2
	Kit.block(parent, Vector3.new(9, 4, 9) * s, base * CFrame.new(0, 4.5 * s, 5.5 * s), Color3.fromRGB(240, 240, 236), M.SmoothPlastic)
	for _, sx in { -1, 1 } do
		Kit.post(parent, 7 * s, 0.9 * s, (base * CFrame.new(sx * 4.8 * s, 5 * s, -2.6 * s)).Position, Color3.fromRGB(200, 200, 205), M.Metal)
		for _, sz in { -9, 2, 7.5 } do
			Kit.cyl(parent, 1.6 * s, 4.4 * s, base * CFrame.new(sx * 4.4 * s, 2.2 * s, sz * s), Color3.fromRGB(25, 25, 25), M.SmoothPlastic)
		end
		Kit.ball(parent, 1.4 * s, (base * CFrame.new(sx * 3 * s, 4.2 * s, -13.8 * s)).Position, Color3.fromRGB(255, 240, 200), M.Neon)
	end
end

---------------------------------------------------------------------------
-- Diesel District
---------------------------------------------------------------------------
local function diesel(parent: Instance)
	local f = Kit.folder("DieselDistrict", parent)
	local land = Config.landById("Diesel") :: Config.Land
	Kit.arch(f, look(Vector3.new(-88, 0.4, 15), Vector3.new(-1, 0, 0)), 22, "DIESEL DISTRICT", { land.color, C.Cream })
	-- Benton Garage rooftop sign and slogan (the shop building is in Venues)
	local roof = CFrame.new(-250, 32.4, 12) * CFrame.Angles(0, math.rad(-90), 0)
	Kit.sign(f, "BENTON GARAGE", Vector3.new(44, 8, 0.6), roof * CFrame.new(0, 5, 0), { bg = C.Navy, fg = C.Cream, font = Enum.Font.GothamBlack, glow = true })
	Kit.gear(f, roof * CFrame.new(-27, 5, 0), 9, C.Gold)
	Kit.sign(f, "BUILT TO KEEP THE WORLD MOVING", Vector3.new(50, 6, 0.3), CFrame.new(-282, 18, -28.7), { transparentBg = true, fg = C.Cream, font = Enum.Font.GothamBlack })
	for _, z in { 30, 42 } do
		local stack = Kit.post(f, 20, 4, Vector3.new(-300, 32, z), C.Brick, M.Brick)
		local smoke = Instance.new("Smoke")
		smoke.Color = Color3.fromRGB(200, 200, 200)
		smoke.Opacity = 0.12
		smoke.RiseVelocity = 8
		smoke.Size = 4
		smoke.Parent = stack
	end
	-- fuel tanks
	for i, z in { 82, 106 } do
		local base = Vector3.new(-345, 0, z)
		Kit.post(f, 22, 18, base, Color3.fromRGB(210, 214, 220), M.Metal)
		Kit.disc(f, 19, 1, base + Vector3.new(0, 22.5, 0), C.Steel, M.Metal)
		Kit.sign(f, "BENTON FUEL " .. i, Vector3.new(12, 3, 0.2), CFrame.new(base + Vector3.new(9.15, 12, 0)) * CFrame.Angles(0, math.rad(-90), 0), { transparentBg = true, fg = C.Navy, font = Enum.Font.GothamBlack })
	end
	-- Old No. 1 on the district square
	truckStatue(f, CFrame.new(-192, 0.4, 10) * CFrame.Angles(0, math.rad(-120), 0), C.Red, 0.8)
	Kit.postSign(f, "OLD NO. 1\nThe first Benton diesel, 1952", Vector3.new(-178, 0.4, 30), Vector3.new(1, 0, 0.4).Unit, 10, 3.5, { bg = C.Navy, fg = C.Cream, font = Enum.Font.GothamBold })
	-- FUEL CITY billboard
	Kit.postSign(f, "FUEL. CITY. BLUE. REPEAT.", Vector3.new(-140, 0.4, -24), Vector3.new(1, 0, 1).Unit, 26, 8, { bg = Color3.fromRGB(30, 34, 44), fg = C.Orange, font = Enum.Font.GothamBlack, glow = true, both = true })
	-- crates and barrels
	local rng = Random.new(5)
	for _, center in { Vector3.new(-218, 0.4, -20), Vector3.new(-162, 0.4, 44), Vector3.new(-236, 0.4, 56) } do
		for _ = 1, 5 do
			local p = center + Vector3.new(rng:NextNumber(-5, 5), 0, rng:NextNumber(-5, 5))
			if rng:NextNumber() < 0.5 then
				Kit.box(f, Vector3.new(3, 3, 3), p, Color3.fromRGB(160, 120, 70), M.WoodPlanks, rng:NextNumber(0, 90))
			else
				Kit.post(f, 3.6, 2.4, p, if rng:NextNumber() < 0.5 then C.Blue else C.Red, M.Metal)
			end
		end
	end
	for _, p in { Vector3.new(-226, 0.4, -26), Vector3.new(-158, 0.4, -26), Vector3.new(-226, 0.4, 46), Vector3.new(-158, 0.4, 46) } do
		Kit.lamp(f, p)
	end
	for z = -14, 34, 16 do
		Kit.bench(f, CFrame.new(-160, 0.4, z) * CFrame.Angles(0, math.rad(90), 0))
	end
	block(-375, -140, -125, -40) -- Diesel Thunder
	block(-316, -30, -248, 54) -- Garage
	block(-222, 63, -165, 117) -- Canteen + patio
	block(-356, 70, -334, 116)
	blockCircle(-120, 78, 32) -- Piston Pounder
	block(-230, -30, -154, 50) -- square
end

---------------------------------------------------------------------------
-- Little Haulers
---------------------------------------------------------------------------
local function haulers(parent: Instance)
	local f = Kit.folder("LittleHaulers", parent)
	local land = Config.landById("Haulers") :: Config.Land
	Kit.arch(f, look(Vector3.new(-92, 0.4, 238), Vector3.new(-1, 0, 0)), 20, "LITTLE HAULERS", { C.Red, land.color })
	-- giant toy dump truck in the plaza
	local cf = CFrame.new(-175, 0.4, 215) * CFrame.Angles(0, math.rad(35), 0)
	Kit.block(f, Vector3.new(10, 1.6, 18), cf * CFrame.new(0, 3, 0), Color3.fromRGB(40, 40, 46), M.SmoothPlastic)
	Kit.block(f, Vector3.new(9, 6, 6), cf * CFrame.new(0, 6.6, -6), land.color, M.SmoothPlastic)
	local glass = Kit.block(f, Vector3.new(8, 2.5, 0.3), cf * CFrame.new(0, 8, -9.1), Color3.fromRGB(150, 200, 230), M.Glass)
	glass.Transparency = 0.2
	Kit.wedge(f, Vector3.new(10, 6, 12), cf * CFrame.new(0, 7, 4) * CFrame.Angles(math.rad(-15), math.pi, 0), C.Red, M.SmoothPlastic)
	for _, sx in { -1, 1 } do
		for _, sz in { -6, 5 } do
			Kit.cyl(f, 2, 5, cf * CFrame.new(sx * 5, 2.5, sz), Color3.fromRGB(25, 25, 25), M.SmoothPlastic)
		end
	end
	-- cones, road signs and a stop sign
	for k = 0, 11 do
		local a = k * math.pi / 6
		local p = Vector3.new(-175 + math.cos(a) * 29, 0.4, 215 + math.sin(a) * 29)
		Kit.post(f, 0.4, 2, p, Color3.fromRGB(255, 110, 20), M.SmoothPlastic)
		Kit.post(f, 1.4, 1.2, p + Vector3.new(0, 0.4, 0), Color3.fromRGB(255, 110, 20), M.SmoothPlastic)
		Kit.post(f, 0.5, 0.7, p + Vector3.new(0, 1.8, 0), Color3.new(1, 1, 1), M.SmoothPlastic)
	end
	Kit.postSign(f, "SLOW\nLITTLE HAULERS AT WORK", Vector3.new(-120, 0.4, 250), Vector3.new(1, 0, 0), 9, 4, { bg = C.Gold, fg = Color3.fromRGB(20, 20, 20), font = Enum.Font.GothamBlack, both = true })
	Kit.postSign(f, "STOP", Vector3.new(-210, 0.4, 190), Vector3.new(1, 0, 0.3).Unit, 4, 4, { bg = C.Red, fg = Color3.new(1, 1, 1), font = Enum.Font.GothamBlack, both = true })
	for _, p in { Vector3.new(-150, 0.4, 200), Vector3.new(-200, 0.4, 240), Vector3.new(-150, 0.4, 232) } do
		Kit.lamp(f, p)
	end
	block(-340, 155, -210, 255) -- Truck Trek
	block(-126, 176, -94, 224) -- Toy Garage
	blockCircle(-175, 215, 34)
end

---------------------------------------------------------------------------
-- Backwoods Junction
---------------------------------------------------------------------------
local function cabin(parent: Instance, cf: CFrame, w: number, d: number)
	local logColor = Color3.fromRGB(120, 84, 52)
	Kit.block(parent, Vector3.new(w, 10, d), cf * CFrame.new(0, 5, 0), logColor, M.Wood)
	for y = 1, 9, 2 do
		Kit.block(parent, Vector3.new(w + 0.6, 0.5, d + 0.6), cf * CFrame.new(0, y, 0), Color3.fromRGB(96, 66, 40), M.Wood)
	end
	Kit.wedge(parent, Vector3.new(w + 2, 5, d / 2 + 1), cf * CFrame.new(0, 12.5, -d / 4), Color3.fromRGB(70, 50, 40), M.WoodPlanks)
	Kit.wedge(parent, Vector3.new(w + 2, 5, d / 2 + 1), cf * CFrame.new(0, 12.5, d / 4) * CFrame.Angles(0, math.pi, 0), Color3.fromRGB(70, 50, 40), M.WoodPlanks)
	Kit.block(parent, Vector3.new(4, 7, 0.4), cf * CFrame.new(0, 3.5, -d / 2 - 0.1), Color3.fromRGB(70, 46, 30), M.Wood)
	Kit.post(parent, 6, 2, (cf * CFrame.new(w / 2 - 2, 10, d / 4)).Position, Color3.fromRGB(120, 110, 100), M.Cobblestone)
end

local function waterfall(parent: Instance, top: Vector3, height: number, width: number)
	local water = Kit.block(parent, Vector3.new(width, height, 1), CFrame.new(top - Vector3.new(0, height / 2, 0)), Color3.fromRGB(150, 200, 240), M.Glass)
	water.Transparency = 0.35
	water.CanCollide = false
	local foam = Kit.block(parent, Vector3.new(width + 4, 1, 6), CFrame.new(top - Vector3.new(0, height - 0.2, -2)), Color3.fromRGB(240, 250, 255), M.SmoothPlastic)
	foam.CanCollide = false
	local mist = Instance.new("ParticleEmitter")
	mist.Texture = "rbxasset://textures/particles/smoke_main.dds"
	mist.Color = ColorSequence.new(Color3.fromRGB(235, 245, 255))
	mist.Transparency = NumberSequence.new(0.5, 1)
	mist.Size = NumberSequence.new(2, 6)
	mist.Lifetime = NumberRange.new(1, 2)
	mist.Speed = NumberRange.new(2, 4)
	mist.Rate = 8
	mist.Parent = foam
end

local function backwoods(parent: Instance)
	local f = Kit.folder("BackwoodsJunction", parent)
	local land = Config.landById("Backwoods") :: Config.Land
	local dir = Vector3.new(-127, 0, -86).Unit
	Kit.arch(f, look(Vector3.new(-100, 0.4, -142), dir), 22, "BACKWOODS JUNCTION", { land.color, C.Cream })
	cabin(f, CFrame.new(-228, 0.4, -150), 16, 12)
	cabin(f, CFrame.new(-196, 0.4, -150), 14, 12)
	Kit.waterTower(f, Vector3.new(-340, 0, -165), "BACKWOODS", Color3.fromRGB(140, 100, 64), Color3.fromRGB(90, 66, 44))
	waterfall(f, Vector3.new(-300, 38, -394), 38, 10)
	waterfall(f, Vector3.new(-252, 30, -396), 30, 8)
	-- Old Rusty, the runaway tow truck, by the coaster queue
	truckStatue(f, CFrame.new(-190, 0.4, -238) * CFrame.Angles(0, math.rad(200), 0), Color3.fromRGB(200, 120, 40), 0.55)
	Kit.postSign(f, "OLD RUSTY\nHas anyone seen my brakes?", Vector3.new(-200, 0.4, -226), Vector3.new(0, 0, 1), 10, 3.5, { bg = Color3.fromRGB(90, 62, 40), fg = C.Cream, font = Enum.Font.GothamBold })
	-- mine carts and lanterns
	for i = 0, 2 do
		local p = Vector3.new(-232 + i * 6, 0.4, -212)
		Kit.box(f, Vector3.new(4, 3, 5), p + Vector3.new(0, 1, 0), Color3.fromRGB(90, 70, 50), M.CorrodedMetal)
		Kit.box(f, Vector3.new(3.4, 1, 4.4), p + Vector3.new(0, 4, 0), Color3.fromRGB(60, 60, 64), M.Slate)
	end
	for _, p in { Vector3.new(-244, 0.4, -160), Vector3.new(-152, 0.4, -160), Vector3.new(-244, 0.4, -220), Vector3.new(-152, 0.4, -220) } do
		Kit.lamp(f, p, Color3.fromRGB(255, 190, 120))
	end
	Kit.fence(f, Vector3.new(-245, 0.4, -224), Vector3.new(-150, 0.4, -224), 3, Color3.fromRGB(120, 84, 52))
	block(-358, -380, -232, -222) -- Backwoods Rapids
	block(-232, -380, -108, -232) -- Runaway Tow Truck
	block(-306, -202, -272, -158) -- Trading Post
	block(-148, -212, -112, -168) -- Pork Chop Diner
	block(-247, -224, -148, -156) -- plaza
	block(-238, -158, -186, -142) -- cabins
	blockCircle(-340, -165, 10)
end

---------------------------------------------------------------------------
-- Benton Movie Studios
---------------------------------------------------------------------------
local function studios(parent: Instance)
	local f = Kit.folder("MovieStudios", parent)
	local cream = Color3.fromRGB(236, 228, 210)
	local purple = Color3.fromRGB(150, 110, 200)
	-- studio gate facade
	for _, seg in { { -100, -36 }, { 36, 100 } } do
		local x1, x2 = seg[1], seg[2]
		Kit.block(f, Vector3.new(x2 - x1, 22, 4), CFrame.new((x1 + x2) / 2, 11.4, -140), cream, M.Concrete)
		Kit.block(f, Vector3.new(x2 - x1 + 1, 1.4, 5), CFrame.new((x1 + x2) / 2, 23, -140), purple, M.SmoothPlastic)
		for x = x1 + 8, x2 - 8, 14 do
			local w = Kit.block(f, Vector3.new(6, 9, 0.3), CFrame.new(x, 12, -137.9), Color3.fromRGB(150, 196, 220), M.Glass)
			w.Transparency = 0.2
		end
	end
	for _, sx in { -1, 1 } do
		Kit.box(f, Vector3.new(10, 34, 10), Vector3.new(sx * 31, 0.4, -140), cream, M.Concrete)
		Kit.box(f, Vector3.new(12, 2, 12), Vector3.new(sx * 31, 34.4, -140), purple, M.SmoothPlastic)
		local spot = Kit.block(f, Vector3.new(2, 2, 3), CFrame.new(sx * 31, 37.4, -140) * CFrame.Angles(math.rad(60), 0, 0), Color3.fromRGB(40, 40, 46), M.Metal)
		local beam = Instance.new("SpotLight")
		beam.Angle = 25
		beam.Range = 60
		beam.Brightness = 3
		beam.Face = Enum.NormalId.Front
		beam.Color = Color3.fromRGB(255, 240, 210)
		beam.Parent = spot
	end
	Kit.block(f, Vector3.new(72, 10, 8), CFrame.new(0, 30.4, -140), cream, M.Concrete)
	Kit.sign(f, "BENTON MOVIE STUDIOS", Vector3.new(62, 6.5, 0.4), CFrame.new(0, 30.4, -135.8) * CFrame.Angles(0, math.pi, 0), { bg = C.Navy, fg = C.Gold, font = Enum.Font.GothamBlack, glow = true })
	Kit.sign(f, "NOW FILMING", Vector3.new(30, 4, 0.4), CFrame.new(0, 30.4, -144.2), { bg = C.Navy, fg = C.Cream, font = Enum.Font.GothamBlack, glow = true })
	Kit.gear(f, CFrame.new(0, 42, -140) * CFrame.Angles(0, math.pi, 0), 13, C.Gold)
	-- soundstages 1-5
	for i = 1, 5 do
		local x = -78 + (i - 1) * 39
		Kit.box(f, Vector3.new(34, 36, 45), Vector3.new(x, 0, -357.5), Color3.fromRGB(150, 152, 158), M.Concrete)
		Kit.box(f, Vector3.new(35, 3, 46), Vector3.new(x, 36, -357.5), Color3.fromRGB(110, 112, 118), M.Metal)
		Kit.sign(f, tostring(i), Vector3.new(10, 12, 0.3), CFrame.new(x, 22, -334.8) * CFrame.Angles(0, math.pi, 0), { transparentBg = true, fg = Color3.fromRGB(50, 52, 58), font = Enum.Font.GothamBlack })
		local door = Kit.block(f, Vector3.new(14, 16, 0.4), CFrame.new(x, 8.4, -334.9), Color3.fromRGB(120, 122, 128), M.DiamondPlate)
		door.Name = "StageDoor" .. i
	end
	Kit.sign(f, "BACKSTAGE", Vector3.new(30, 4, 0.4), CFrame.new(0, 33, -334.6) * CFrame.Angles(0, math.pi, 0), { bg = C.Navy, fg = C.Cream, font = Enum.Font.GothamBlack })
	-- New York street facades on the backlot
	local fronts = { { "HOTEL BENTON", Color3.fromRGB(170, 90, 70) }, { "DINER", Color3.fromRGB(80, 120, 160) }, { "THEATRE", Color3.fromRGB(150, 60, 80) } }
	for i, fr in fronts do
		local z = -270 - (i - 1) * 11
		local cf = CFrame.lookAt(Vector3.new(-48, 0.4, z), Vector3.new(0, 0.4, z))
		Kit.building(f, cf, { size = Vector3.new(10, 20 + i * 4, 10), wall = fr[2] :: Color3, trim = cream, windows = true, sign = fr[1] :: string, signColors = { C.Navy, C.Gold } })
	end
	Kit.waterTower(f, Vector3.new(-92, 0, -305), "STUDIOS", Color3.fromRGB(230, 230, 230), Color3.fromRGB(120, 120, 126))
	for z = -160, -290, -26 do
		Kit.tree(f, Vector3.new(25, 0.4, z), "palm", 0.9)
		Kit.lamp(f, Vector3.new(-25, 0.4, z - 13))
	end
	block(-110, -400, 115, -318) -- tram + soundstages
	block(-80, -300, -30, -160) -- west buildings
	block(28, -290, 112, -182) -- arena
	blockCircle(-92, -305, 9)
end

-- The Backlot Stunt Arena (show venue).
local function stuntArena(parent: Instance)
	local f = Kit.folder("StuntArena", parent)
	local dirt = Color3.fromRGB(150, 120, 90)
	Kit.pad(f, 32, -282, 108, -214, dirt, M.Ground, 0.5)
	-- walls (north, east, west)
	Kit.box(f, Vector3.new(78, 6, 2), Vector3.new(70, 0.4, -283), Color3.fromRGB(70, 72, 80), M.Concrete)
	Kit.box(f, Vector3.new(2, 6, 70), Vector3.new(31, 0.4, -248), Color3.fromRGB(70, 72, 80), M.Concrete)
	Kit.box(f, Vector3.new(2, 6, 70), Vector3.new(109, 0.4, -248), Color3.fromRGB(70, 72, 80), M.Concrete)
	-- bleachers on the south side, facing north
	for step = 0, 4 do
		local z = -210 + step * 4
		local y = 1 + step * 2.2
		Kit.block(f, Vector3.new(76, y, 4), CFrame.new(70, y / 2 + 0.4, z), Color3.fromRGB(110, 114, 124), M.Concrete)
		for x = 36, 104, 6 do
			local seat = Instance.new("Seat")
			seat.Size = Vector3.new(4, 0.6, 2)
			seat.CFrame = CFrame.new(x, y + 0.7, z) * CFrame.Angles(0, 0, 0)
			seat.Anchored = true
			seat.Color = if step % 2 == 0 then C.Red else C.Navy
			seat.Material = M.SmoothPlastic
			seat.Parent = f
		end
	end
	Kit.box(f, Vector3.new(80, 1, 2), Vector3.new(70, 0.4, -212.5), C.Gold, M.Metal)
	-- ramps used by the stunt trucks
	local rampA = Kit.wedge(f, Vector3.new(10, 6, 16), CFrame.new(52, 3.5, -250) * CFrame.Angles(0, math.rad(90), 0), Color3.fromRGB(110, 110, 116), M.DiamondPlate)
	local rampB = Kit.wedge(f, Vector3.new(10, 6, 16), CFrame.new(88, 3.5, -250) * CFrame.Angles(0, math.rad(-90), 0), Color3.fromRGB(110, 110, 116), M.DiamondPlate)
	rampA.Name = "RampA"
	rampB.Name = "RampB"
	-- wrecked cars and fire pots as set dressing
	for _, p in { Vector3.new(40, 0.5, -274), Vector3.new(100, 0.5, -274) } do
		Kit.box(f, Vector3.new(6, 3, 10), p, Color3.fromRGB(90, 60, 50), M.CorrodedMetal, 25)
	end
	for _, p in { Vector3.new(36, 0.5, -220), Vector3.new(104, 0.5, -220), Vector3.new(36, 0.5, -278), Vector3.new(104, 0.5, -278) } do
		local pot = Kit.post(f, 3, 3, p, Color3.fromRGB(50, 50, 54), M.Metal)
		pot.Name = "FirePot"
		pot:AddTag("StuntFirePot")
	end
	-- marquee
	Kit.postSign(f, "DIESEL STUNT SPECTACULAR", Vector3.new(70, 0.4, -286), Vector3.new(0, 0, 1), 46, 7, { bg = C.Navy, fg = C.Orange, font = Enum.Font.GothamBlack, glow = true })
end

---------------------------------------------------------------------------
-- Velocity City
---------------------------------------------------------------------------
local function velocity(parent: Instance)
	local f = Kit.folder("VelocityCity", parent)
	local land = Config.landById("Velocity") :: Config.Land
	local dir = Vector3.new(90, 0, -50).Unit
	Kit.arch(f, look(Vector3.new(78, 0.4, -122), dir), 24, "VELOCITY CITY", { Color3.fromRGB(30, 34, 44), land.color })
	-- checkered stripes across the plaza
	for i = 0, 15 do
		for row = 0, 1 do
			local color = if (i + row) % 2 == 0 then Color3.new(1, 1, 1) else Color3.fromRGB(20, 20, 20)
			local tile = Kit.block(f, Vector3.new(4, 0.1, 4), CFrame.new(140 + i * 4, 0.46, -150 + row * 4), color, M.SmoothPlastic)
			tile.CastShadow = false
		end
	end
	-- the Velocity car on a turntable pedestal
	Kit.disc(f, 22, 2, Vector3.new(185, 2.4, -128), Color3.fromRGB(30, 34, 44), M.Metal)
	local carCF = CFrame.new(185, 2.4, -128) * CFrame.Angles(0, math.rad(30), 0)
	Kit.block(f, Vector3.new(7, 1.6, 16), carCF * CFrame.new(0, 1.6, 0), land.color, M.SmoothPlastic)
	Kit.wedge(f, Vector3.new(6, 1.6, 5), carCF * CFrame.new(0, 2.4, -6), land.color, M.SmoothPlastic)
	Kit.block(f, Vector3.new(3, 1.6, 4), carCF * CFrame.new(0, 3.2, 1), Color3.fromRGB(20, 20, 26), M.Glass)
	Kit.block(f, Vector3.new(8, 0.4, 2), carCF * CFrame.new(0, 4.2, 7), Color3.fromRGB(20, 20, 26), M.SmoothPlastic)
	for _, sx in { -1, 1 } do
		for _, sz in { -5, 5 } do
			Kit.cyl(f, 1.4, 3, carCF * CFrame.new(sx * 3.8, 1.5, sz), Color3.fromRGB(20, 20, 20), M.SmoothPlastic)
		end
	end
	-- SPEED FUELS PEOPLE TOGETHER billboard
	Kit.postSign(f, "SPEED FUELS PEOPLE TOGETHER", Vector3.new(185, 0.4, -214), Vector3.new(0, 0, 1), 48, 10, { bg = Color3.fromRGB(20, 22, 30), fg = Color3.new(1, 1, 1), font = Enum.Font.GothamBlack, glow = true, both = true })
	Kit.postSign(f, "RACE TODAY\nADMIRE TOMORROW", Vector3.new(214, 0.4, -84), Vector3.new(-0.5, 0, 1).Unit, 14, 6, { bg = Color3.fromRGB(20, 22, 30), fg = land.color, font = Enum.Font.GothamBlack, glow = true, both = true })
	-- start-light gantry over the plaza entrance
	for _, sx in { -1, 1 } do
		Kit.post(f, 16, 1, Vector3.new(128 + sx * 8, 0.4, -158), Color3.fromRGB(40, 40, 46), M.Metal)
	end
	Kit.block(f, Vector3.new(18, 2, 1.4), CFrame.new(128, 16.4, -158), Color3.fromRGB(40, 40, 46), M.Metal)
	for i = -3, 3 do
		local bulb = Kit.ball(f, 1.2, Vector3.new(128 + i * 2.2, 16.4, -157.1), if i < 2 then C.Red else C.Green, M.Neon)
		bulb.CastShadow = false
	end
	-- tire stacks
	for _, p in { Vector3.new(124, 0.4, -95), Vector3.new(222, 0.4, -95), Vector3.new(222, 0.4, -205) } do
		for k = 0, 3 do
			Kit.post(f, 1, 3, p + Vector3.new(0, k * 1, 0), Color3.fromRGB(20, 20, 20), M.Rubber)
		end
	end
	for _, p in { Vector3.new(124, 0.4, -120), Vector3.new(222, 0.4, -120), Vector3.new(124, 0.4, -205), Vector3.new(160, 0.4, -205) } do
		Kit.lamp(f, p, Color3.fromRGB(170, 200, 255))
	end
	block(150, -400, 360, -224) -- Velocity Viper
	block(228, -222, 360, -60) -- Nitro Loop
	blockCircle(140, -250, 18) -- Tower
	block(190, -60, 360, 18) -- Speedway
	block(116, -212, 230, -84) -- plaza
end

---------------------------------------------------------------------------
-- Benton Family Landing
---------------------------------------------------------------------------
local function lakesideStage(parent: Instance)
	local f = Kit.folder("LakesideStage", parent)
	local wood = Color3.fromRGB(170, 120, 80)
	Kit.box(f, Vector3.new(52, 4, 22), Vector3.new(225, 0.2, 187), wood, M.WoodPlanks)
	Kit.box(f, Vector3.new(56, 20, 2), Vector3.new(225, 4.2, 177), Color3.fromRGB(40, 60, 90), M.SmoothPlastic)
	Kit.sign(f, "LAKESIDE STAGE", Vector3.new(30, 4, 0.4), CFrame.new(225, 19, 178.3) * CFrame.Angles(0, math.pi, 0), { bg = C.Navy, fg = C.Gold, font = Enum.Font.GothamBlack, glow = true })
	Kit.sign(f, "BIG DREAMS LIVE!", Vector3.new(22, 3, 0.4), CFrame.new(225, 14, 178.3) * CFrame.Angles(0, math.pi, 0), { transparentBg = true, fg = C.Cream, font = Enum.Font.GothamBlack, glow = true })
	-- roof on posts
	for _, x in { 199, 251 } do
		for _, z in { 178, 197 } do
			Kit.post(f, 22, 1, Vector3.new(x, 4.2, z), Color3.fromRGB(60, 60, 66), M.Metal)
		end
	end
	Kit.block(f, Vector3.new(60, 1.2, 26), CFrame.new(225, 26.8, 187.5), Color3.fromRGB(240, 240, 236), M.Fabric)
	-- light rig the show animates
	for i = 0, 5 do
		local x = 205 + i * 8
		local can = Kit.block(f, Vector3.new(1.6, 1.6, 2.4), CFrame.new(x, 25.4, 196) * CFrame.Angles(math.rad(-50), 0, 0), Color3.fromRGB(30, 30, 34), M.Metal)
		can.Name = "StageLight" .. (i + 1)
		can:AddTag("StageLight")
		local spot = Instance.new("SpotLight")
		spot.Angle = 40
		spot.Range = 40
		spot.Brightness = 0
		spot.Face = Enum.NormalId.Front
		spot.Parent = can
	end
	for _, x in { 193, 257 } do
		Kit.box(f, Vector3.new(5, 12, 5), Vector3.new(x, 0.4, 194), Color3.fromRGB(30, 30, 34), M.SmoothPlastic)
	end
	-- audience benches
	for row = 0, 4 do
		local z = 210 + row * 7
		for _, x in { 207, 243 } do
			Kit.bench(f, CFrame.new(x - 6, 0.4, z) * CFrame.Angles(0, 0, 0))
			Kit.bench(f, CFrame.new(x + 6, 0.4, z) * CFrame.Angles(0, 0, 0))
		end
	end
	-- lake fountains (switched on by the show on each client)
	for k = 0, 6 do
		local a = math.rad(200 + k * 20)
		local p = Vector3.new(235 + math.cos(a) * 30, -1, 125 - math.sin(a) * 30)
		local jet = Kit.block(f, Vector3.new(1, 1, 1), CFrame.new(p), Color3.fromRGB(80, 80, 86), M.Metal)
		jet.Name = "Fountain" .. (k + 1)
		jet.Transparency = 1
		jet.CanCollide = false
		jet:AddTag("LakeFountain")
		local spray = Instance.new("ParticleEmitter")
		spray.Name = "Spray"
		spray.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		spray.Color = ColorSequence.new(Color3.fromRGB(200, 230, 255))
		spray.Size = NumberSequence.new(1.2, 0.4)
		spray.Speed = NumberRange.new(34, 40)
		spray.SpreadAngle = Vector2.new(5, 5)
		spray.Lifetime = NumberRange.new(1.6, 2)
		spray.Acceleration = Vector3.new(0, -40, 0)
		spray.Rate = 60
		spray.EmissionDirection = Enum.NormalId.Top
		spray.LightEmission = 0.6
		spray.Enabled = false
		spray.Parent = jet
	end
end

local function playground(parent: Instance, center: Vector3)
	local f = Kit.folder("Playground", parent)
	Kit.pad(f, center.X - 22, center.Z - 14, center.X + 22, center.Z + 14, Color3.fromRGB(80, 150, 200), M.Rubber, 0.5)
	local colors = { C.Red, C.Gold, C.Blue, C.Green }
	for i, dx in { -12, 0, 12 } do
		local base = center + Vector3.new(dx, 0.5, 0)
		Kit.box(f, Vector3.new(6, 8, 6), base, colors[i], M.SmoothPlastic)
		Kit.wedge(f, Vector3.new(6, 4, 6), CFrame.new(base + Vector3.new(0, 10, 0)), colors[i + 1], M.SmoothPlastic)
		Kit.wedge(f, Vector3.new(3, 8, 10), CFrame.new(base + Vector3.new(0, 4, 8)) * CFrame.Angles(0, math.pi, 0), Color3.fromRGB(220, 220, 225), M.Metal)
	end
	Kit.beam(f, center + Vector3.new(-12, 8.5, 0), center + Vector3.new(12, 8.5, 0), 1, C.Orange, M.Metal, true)
end

local function family(parent: Instance)
	local f = Kit.folder("FamilyLanding", parent)
	local land = Config.landById("Family") :: Config.Land
	Kit.arch(f, look(Vector3.new(92, 0.4, 60), Vector3.new(1, 0, 0)), 20, "BENTON FAMILY LANDING", { Color3.fromRGB(120, 84, 52), land.color })
	Kit.arch(f, look(Vector3.new(92, 0.4, 246), Vector3.new(1, 0, 0)), 20, "BENTON FAMILY LANDING", { Color3.fromRGB(120, 84, 52), land.color })
	lakesideStage(f)
	playground(f, Vector3.new(150, 0, 80))
	Kit.waterTower(f, Vector3.new(362, 0, 120), "BIG DREAMS", Color3.fromRGB(210, 214, 220), Color3.fromRGB(120, 120, 126))
	-- dock and rowboats on the east shore
	Kit.box(f, Vector3.new(26, 1, 6), Vector3.new(278, 0.2, 125), Color3.fromRGB(150, 110, 70), M.WoodPlanks)
	for i, z in { 115, 135 } do
		local boat = Kit.block(f, Vector3.new(4, 1.4, 9), CFrame.new(268, 0.2, z) * CFrame.Angles(0, math.rad(80 + i * 15), 0), if i == 1 then C.Red else C.Blue, M.Wood)
		boat.CanCollide = false
	end
	-- railroad crossings where walkways meet the Lakeside Express
	for _, z in { 60, 246 } do
		for _, dz in { -11, 11 } do
			local base = Vector3.new(103, 0.4, z + dz)
			Kit.post(f, 10, 0.5, base, Color3.new(1, 1, 1), M.Metal)
			for _, a in { 35, -35 } do
				local cross = Kit.block(f, Vector3.new(0.3, 1, 7), CFrame.new(base + Vector3.new(0, 9, 0)) * CFrame.Angles(math.rad(a), 0, 0), Color3.new(1, 1, 1), M.SmoothPlastic)
				Kit.label(cross, Enum.NormalId.Left, "RAILROAD", { fg = Color3.fromRGB(20, 20, 20), font = Enum.Font.GothamBlack })
				Kit.label(cross, Enum.NormalId.Right, "CROSSING", { fg = Color3.fromRGB(20, 20, 20), font = Enum.Font.GothamBlack })
			end
			Kit.ball(f, 1, base + Vector3.new(0, 7, 0.6), C.Red, M.Neon)
		end
	end
	Kit.postSign(f, "LAKESIDE DEPOT", Vector3.new(252, 0.4, 276), Vector3.new(0, 0, -1), 22, 4, { bg = Color3.fromRGB(30, 90, 60), fg = C.Gold, font = Enum.Font.GothamBlack, both = true })
	for _, p in { Vector3.new(120, 0.4, 100), Vector3.new(120, 0.4, 170), Vector3.new(300, 0.4, 90), Vector3.new(300, 0.4, 200), Vector3.new(180, 0.4, 246), Vector3.new(284, 0.4, 248) } do
		Kit.lamp(f, p)
	end
	for _, p in { Vector3.new(175, 0.4, 180), Vector3.new(290, 0.4, 175) } do
		Kit.flowerBed(f, p, 10, 6)
	end
	blockCircle(235, 125, 60) -- lake
	block(190, 170, 262, 248) -- stage + audience
	blockCircle(148, 205, 24) -- carousel
	blockCircle(150, 120, 28) -- spinner
	block(126, 64, 174, 96) -- playground
	block(300, 205, 340, 250) -- depot grill
	block(305, 95, 340, 135) -- gifts
	blockCircle(362, 120, 9)
end

---------------------------------------------------------------------------
-- Trees everywhere there is room
---------------------------------------------------------------------------
local function trees(parent: Instance)
	local f = Kit.folder("Trees", parent)
	-- walkways and main street
	block(-75, -125, 75, 285)
	block(-30, 5, -160, 25)
	block(-160, -200, -30, -95)
	block(25, -160, 140, -55)
	block(20, 50, 120, 70)
	block(55, 236, 120, 256)
	block(-160, 225, -55, 250)
	block(100, 40, 115, 265)
	block(100, 250, 350, 270) -- train south row
	block(100, 35, 350, 55) -- train north row
	block(340, 40, 352, 265) -- train east column
	block(-160, 40, -144, 195)
	block(-35, -320, 35, -110)
	local rng = Random.new(31)
	local placed = 0
	local tries = 0
	local b = Config.Bounds
	while placed < 260 and tries < 6000 do
		tries += 1
		local x = rng:NextNumber(b.minX + 6, b.maxX - 6)
		local z = rng:NextNumber(b.minZ + 6, b.maxZ - 6)
		if isFree(x, z, 5) then
			local land = Config.landAt(Vector3.new(x, 0, z))
			local kind = "round"
			if land and land.id == "Backwoods" then
				kind = "pine"
			elseif land and land.id == "Velocity" then
				kind = if rng:NextNumber() < 0.5 then "round" else "pine"
			elseif land and land.id == "Studios" then
				kind = "palm"
			else
				kind = if rng:NextNumber() < 0.7 then "round" else "pine"
			end
			Kit.tree(f, Vector3.new(x, 0, z), kind, nil)
			block(x - 3, z - 3, x + 3, z + 3)
			placed += 1
		end
	end
	-- a ring of trees outside the walls
	for i = 0, 70 do
		local t = i / 70
		local x, z
		if i % 2 == 0 then
			x = b.minX - 14 - rng:NextNumber(0, 30)
			z = b.minZ + (b.maxZ - b.minZ) * t
		else
			x = b.maxX + 14 + rng:NextNumber(0, 30)
			z = b.minZ + (b.maxZ - b.minZ) * t
		end
		Kit.tree(f, Vector3.new(x, 0, z), if rng:NextNumber() < 0.5 then "pine" else "round", rng:NextNumber(1.1, 1.6))
	end
	for i = 0, 40 do
		local x = b.minX + (b.maxX - b.minX) * (i / 40)
		Kit.tree(f, Vector3.new(x, 0, b.minZ - 16 - rng:NextNumber(0, 30)), "pine", rng:NextNumber(1.2, 1.8))
	end
end

function Lands.build(root: Instance)
	local f = Kit.folder("Lands", root)
	diesel(f)
	haulers(f)
	backwoods(f)
	studios(f)
	stuntArena(f)
	velocity(f)
	family(f)
	-- shops and restaurants are built by Venues; keep trees off them too
	for _, venue in Config.Venues do
		local p = venue.position
		local r = math.max(venue.size.X, venue.size.Z) / 2 + 8
		block(p.X - r, p.Z - r, p.X + r, p.Z + r)
	end
	for _, ride in Config.Rides do
		blockCircle(ride.entrance.X, ride.entrance.Z, 12)
		blockCircle(ride.exit.X, ride.exit.Z, 8)
		-- queue maze and its walkway
		local line = QueueLine.get(ride.id)
		if line then
			local cf, size = line.mazeCFrame, line.mazeSize
			local a = cf * Vector3.new(-size.X / 2 - 2, 0, -size.Z / 2 - 2)
			local b = cf * Vector3.new(size.X / 2 + 2, 0, size.Z / 2 + 2)
			block(a.X, a.Z, b.X, b.Z)
			for i = 2, #line.walkway do
				local p, q = line.walkway[i - 1], line.walkway[i]
				block(math.min(p.X, q.X) - 3, math.min(p.Z, q.Z) - 3, math.max(p.X, q.X) + 3, math.max(p.Z, q.Z) + 3)
			end
		end
	end
	-- themed set dressing (keep trees off it)
	for _, fp in Theming.build(f) do
		blockCircle(fp[1], fp[2], fp[3])
	end
	trees(f)
	local _ = HALF_PI
end

return Lands
