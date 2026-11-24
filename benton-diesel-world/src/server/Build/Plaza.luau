-- Benton Plaza: entry plaza, Main Street, the Hub with the Benton Globe,
-- the wait-times board, and the walkways that connect every land.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Kit = require(script.Parent.Kit)

local M = Enum.Material
local C = Config.Colors

local Plaza = {}

local PAVER = C.Paver
local WALK = Color3.fromRGB(205, 192, 176)

local function walkways(parent: Instance)
	local f = Kit.folder("Walkways", parent)
	-- entry plaza + Main Street + Hub
	Kit.pad(f, -62, 222, 62, 281, PAVER, M.Brick)
	Kit.pad(f, -26, -4, 26, 226, PAVER, M.Brick)
	Kit.pad(f, -30, -4, -26, 226, WALK, M.Pavement, 0.45)
	Kit.pad(f, 26, -4, 30, 226, WALK, M.Pavement, 0.45)
	Kit.roundPad(f, Vector3.new(0, 0, -60), 124, PAVER, M.Brick)
	-- Diesel District connector and square
	Kit.path(f, Vector3.new(-26, 0, 15), Vector3.new(-160, 0, 15), 22, WALK)
	Kit.pad(f, -228, -28, -156, 48, Color3.fromRGB(150, 140, 130), M.Concrete)
	Kit.path(f, Vector3.new(-200, 0, -28), Vector3.new(-292, 0, -40), 16, WALK)
	Kit.path(f, Vector3.new(-170, 0, 40), Vector3.new(-148, 0, 52), 14, WALK)
	Kit.path(f, Vector3.new(-152, 0, 48), Vector3.new(-152, 0, 192), 14, WALK)
	-- Little Haulers connector and plaza
	Kit.path(f, Vector3.new(-62, 0, 240), Vector3.new(-150, 0, 232), 20, WALK)
	Kit.roundPad(f, Vector3.new(-175, 0, 215), 64, Color3.fromRGB(240, 220, 150), M.Concrete)
	-- Backwoods Junction connector and plaza (packed dirt + planks)
	Kit.path(f, Vector3.new(-38, 0, -100), Vector3.new(-165, 0, -186), 22, WALK)
	Kit.pad(f, -245, -222, -150, -158, Color3.fromRGB(150, 118, 84), M.Ground)
	Kit.path(f, Vector3.new(-245, 0, -190), Vector3.new(-268, 0, -186), 12, Color3.fromRGB(150, 118, 84), M.Ground)
	-- Movie Studios connector, backlot street
	Kit.path(f, Vector3.new(0, 0, -118), Vector3.new(0, 0, -148), 30, WALK)
	Kit.pad(f, -22, -300, 22, -140, Color3.fromRGB(110, 110, 116), M.Asphalt)
	Kit.pad(f, -32, -300, -22, -140, WALK, M.Pavement, 0.45)
	Kit.pad(f, 22, -300, 30, -140, WALK, M.Pavement, 0.45)
	Kit.pad(f, -24, -318, 30, -300, WALK, M.Pavement)
	-- Velocity City connector and plaza
	Kit.path(f, Vector3.new(38, 0, -100), Vector3.new(128, 0, -150), 24, WALK)
	Kit.pad(f, 120, -210, 226, -86, Color3.fromRGB(90, 94, 104), M.Asphalt)
	Kit.path(f, Vector3.new(200, 0, -86), Vector3.new(205, 0, -62), 16, Color3.fromRGB(90, 94, 104), M.Asphalt)
	Kit.path(f, Vector3.new(58, 0, -60), Vector3.new(118, 0, -80), 18, WALK)
	-- Family Landing connectors and lakeside loop
	Kit.path(f, Vector3.new(26, 0, 60), Vector3.new(112, 0, 60), 20, WALK)
	Kit.path(f, Vector3.new(62, 0, 246), Vector3.new(112, 0, 246), 20, WALK)
	Kit.path(f, Vector3.new(112, 0, 46), Vector3.new(112, 0, 258), 18, WALK)
	Kit.path(f, Vector3.new(112, 0, 246), Vector3.new(300, 0, 246), 16, WALK)
	Kit.path(f, Vector3.new(112, 0, 60), Vector3.new(300, 0, 60), 14, WALK)
	Kit.path(f, Vector3.new(300, 0, 60), Vector3.new(300, 0, 246), 14, WALK)
	Kit.pad(f, 180, 202, 270, 244, Color3.fromRGB(196, 170, 130), M.WoodPlanks)
	-- Hub east spur to the Speedway / Pit Stop Pizza
	Kit.path(f, Vector3.new(118, 0, -80), Vector3.new(200, 0, -62), 14, Color3.fromRGB(90, 94, 104), M.Asphalt)
end

local function storefront(parent: Instance, x: number, z: number, width: number, depth: number, height: number, facing: string, wall: Color3, name: string)
	local yaw = if facing == "E" then -90 else 90
	local cf = CFrame.new(x, 0, z) * CFrame.Angles(0, math.rad(yaw), 0)
	Kit.building(parent, cf, {
		size = Vector3.new(width, height, depth),
		wall = wall,
		trim = C.Cream,
		roof = Color3.fromRGB(70, 60, 60),
		material = M.Brick,
		windows = true,
		awning = nil,
		sign = name,
		signColors = { C.Navy, C.Cream },
	})
end

local function mainStreet(parent: Instance)
	local f = Kit.folder("MainStreet", parent)
	local walls = {
		Color3.fromRGB(196, 90, 70),
		Color3.fromRGB(222, 196, 150),
		Color3.fromRGB(120, 140, 170),
		Color3.fromRGB(170, 110, 80),
		Color3.fromRGB(210, 170, 120),
	}
	local west = { { 112, "BENTON GAZETTE" }, { 80, "PHOTO DEPOT" }, { 48, "CANDY CO." }, { 212, "GUEST SERVICES" } }
	local east = { { 112, "GEARWORKS ARCADE" }, { 80, "BENTON BANK" }, { 48, "HAT & HUB" }, { 212, "LOCKERS" } }
	for i, w in west do
		storefront(f, -50, w[1] :: number, 30, 36, 22 + (i % 2) * 6, "E", walls[i], w[2] :: string)
	end
	for i, e in east do
		storefront(f, 50, e[1] :: number, 30, 36, 22 + ((i + 1) % 2) * 6, "W", walls[(i + 2) % #walls + 1], e[2] :: string)
	end
	-- banner poles and lamps down both sides of the street
	for z = 10, 220, 22 do
		Kit.bannerPole(f, Vector3.new(-23, 0.4, z), if (z // 22) % 2 == 0 then C.Red else C.Navy, Vector3.new(1, 0, 0))
		Kit.bannerPole(f, Vector3.new(23, 0.4, z + 11), if (z // 22) % 2 == 0 then C.Navy else C.Red, Vector3.new(-1, 0, 0))
		if z % 44 == 10 then
			Kit.tree(f, Vector3.new(-28, 0.4, z + 6), "round", 0.9)
			Kit.tree(f, Vector3.new(28, 0.4, z + 16), "round", 0.9)
		end
	end
	for z = 30, 210, 45 do
		Kit.bench(f, CFrame.new(-27, 0.4, z) * CFrame.Angles(0, math.rad(-90), 0))
		Kit.bench(f, CFrame.new(27, 0.4, z + 20) * CFrame.Angles(0, math.rad(90), 0))
	end
	-- BENTON PLAZA arch across the street
	Kit.arch(f, CFrame.new(0, 0.4, 132) * CFrame.Angles(0, 0, 0), 46, "BENTON PLAZA", { C.Red, C.Cream })
	-- entry plaza: flower beds, flags, the wait-times board
	Kit.flowerBed(f, Vector3.new(-40, 0.4, 262), 14, 8)
	Kit.flowerBed(f, Vector3.new(40, 0.4, 262), 14, 8)
	for _, x in { -55, 55 } do
		Kit.flag(f, Vector3.new(x, 0.4, 270), C.Red, 26)
	end
	for _, p in { Vector3.new(-58, 0.4, 230), Vector3.new(58, 0.4, 230), Vector3.new(-58, 0.4, 276), Vector3.new(58, 0.4, 276) } do
		Kit.lamp(f, p)
	end
end

-- The big wait-times board. Rows are filled in by RideService.
local function waitBoard(parent: Instance, cf: CFrame, name: string): Part
	local f = Kit.model(name, parent)
	local w, h = 30, 26
	local dark = Color3.fromRGB(16, 22, 36)
	for _, sx in { -1, 1 } do
		Kit.block(f, Vector3.new(1.4, h + 6, 1.4), cf * CFrame.new(sx * (w / 2 + 0.7), (h + 6) / 2, 0), C.Navy, M.Metal)
	end
	local board = Kit.block(f, Vector3.new(w, h, 1), cf * CFrame.new(0, 6 + h / 2, 0), dark, M.SmoothPlastic)
	board.Name = "Board"
	Kit.block(f, Vector3.new(w + 2, 3, 2), cf * CFrame.new(0, 6 + h + 1.5, 0), C.Orange, M.SmoothPlastic)
	local title = Kit.sign(f, "RIDE WAIT TIMES", Vector3.new(w, 2.6, 0.3), cf * CFrame.new(0, 6 + h + 1.5, -1.1), {
		bg = C.Orange,
		fg = C.Navy,
		font = Enum.Font.GothamBlack,
		glow = true,
	})
	title.Name = "Title"
	Kit.label(board, Enum.NormalId.Back, "BENTON DIESEL WORLD\nRide wait times on the other side", { fg = C.Cream, font = Enum.Font.GothamBlack })
	return board
end

local function hub(parent: Instance)
	local f = Kit.folder("Hub", parent)
	local center = Vector3.new(0, 0, -60)
	-- fountain basin
	Kit.disc(f, 48, 2.4, center + Vector3.new(0, 2.6, 0), Color3.fromRGB(196, 190, 180), M.Concrete)
	local water = Kit.disc(f, 44, 0.6, center + Vector3.new(0, 2.7, 0), Color3.fromRGB(60, 140, 200), M.Glass)
	water.Transparency = 0.25
	water.CanCollide = false
	Kit.disc(f, 14, 6, center + Vector3.new(0, 8, 0), Color3.fromRGB(196, 190, 180), M.Concrete)
	-- the Benton Globe (spun slowly by clients)
	local globe = Kit.model("BentonGlobe", f)
	local ball = Kit.ball(globe, 26, center + Vector3.new(0, 22, 0), Color3.fromRGB(40, 110, 210), M.SmoothPlastic)
	ball.Name = "Globe"
	globe.PrimaryPart = ball
	local land = Color3.fromRGB(70, 160, 80)
	local spots = { { 0.4, 0.3, 0.2 }, { -0.5, 0.1, 0.4 }, { 0.2, -0.4, -0.6 }, { -0.3, 0.5, -0.5 }, { 0.6, -0.2, 0.5 }, { -0.6, -0.4, -0.1 } }
	for _, s in spots do
		local dir = Vector3.new(s[1], s[2], s[3]).Unit
		local pos = center + Vector3.new(0, 22, 0) + dir * 12.6
		Kit.ellipsoid(globe, Vector3.new(9, 6, 2.4), CFrame.lookAt(pos, pos + dir), land, M.SmoothPlastic)
	end
	-- golden gear ring around the globe
	local ringCF = CFrame.new(center + Vector3.new(0, 22, 0)) * CFrame.Angles(0, math.rad(30), 0)
	for k = 0, 23 do
		local a = k * math.pi / 12
		local cf = ringCF * CFrame.Angles(0, 0, a) * CFrame.new(0, 17, 0)
		Kit.block(globe, Vector3.new(4.6, 2.2, 2.2), cf, C.Gold, M.Metal)
		if k % 2 == 0 then
			Kit.block(globe, Vector3.new(2.2, 2.4, 2.2), cf * CFrame.new(0, 1.6, 0), C.Gold, M.Metal)
		end
	end
	globe:SetAttribute("SpinSpeed", 0.12)
	globe:AddTag("Spinner")
	local glow = Kit.light(ball, Color3.fromRGB(150, 200, 255), 40, 1)
	glow.Shadows = false
	-- fountain jets
	for k = 0, 7 do
		local a = k * math.pi / 4
		local p = center + Vector3.new(math.cos(a) * 18, 3, math.sin(a) * 18)
		local jet = Kit.block(f, Vector3.new(1, 1, 1), CFrame.new(p), Color3.fromRGB(196, 190, 180), M.Concrete)
		local spray = Instance.new("ParticleEmitter")
		spray.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		spray.Color = ColorSequence.new(Color3.fromRGB(200, 230, 255))
		spray.Size = NumberSequence.new(0.6, 0.2)
		spray.Speed = NumberRange.new(16, 20)
		spray.SpreadAngle = Vector2.new(4, 4)
		spray.Lifetime = NumberRange.new(0.9, 1.1)
		spray.Acceleration = Vector3.new(0, -30, 0)
		spray.Rate = 40
		spray.EmissionDirection = Enum.NormalId.Top
		spray.LightEmission = 0.4
		spray.Parent = jet
	end
	-- flower ring, benches, lamps
	for k = 0, 7 do
		local a = k * math.pi / 4 + math.pi / 8
		local p = center + Vector3.new(math.cos(a) * 38, 0.4, math.sin(a) * 38)
		Kit.flowerBed(f, p, 8, 8)
		local lp = center + Vector3.new(math.cos(a + 0.35) * 54, 0.4, math.sin(a + 0.35) * 54)
		Kit.lamp(f, lp)
		local bp = center + Vector3.new(math.cos(a - 0.35) * 30, 0.4, math.sin(a - 0.35) * 30)
		Kit.bench(f, CFrame.lookAt(bp, center))
	end
	Kit.postSign(f, "THE HUB\nAll lands this way", center + Vector3.new(0, 0.4, 44), Vector3.new(0, 0, 1), 14, 5, {
		bg = C.Navy,
		fg = C.Cream,
		font = Enum.Font.GothamBold,
		both = true,
	})
end

-- Direction posts at the Hub pointing to each land.
local function signposts(parent: Instance)
	local f = Kit.folder("Signposts", parent)
	local base = Vector3.new(-14, 0.4, -6)
	Kit.post(f, 18, 0.8, base, C.Navy, M.Metal)
	local targets = {
		{ "Diesel District", Vector3.new(-190, 0, 10) },
		{ "Little Haulers", Vector3.new(-175, 0, 215) },
		{ "Backwoods Junction", Vector3.new(-200, 0, -190) },
		{ "Movie Studios", Vector3.new(0, 0, -150) },
		{ "Velocity City", Vector3.new(170, 0, -150) },
		{ "Family Landing", Vector3.new(200, 0, 140) },
	}
	for i, t in targets do
		local target = t[2] :: Vector3
		local dir = Vector3.new(target.X - base.X, 0, target.Z - base.Z).Unit
		local y = 6 + i * 1.8
		local mid = base + Vector3.new(0, y, 0) + dir * 4.5
		local land = Config.Lands[i + 1]
		local arrow = Kit.block(f, Vector3.new(0.3, 1.5, 8), CFrame.lookAt(mid, mid + dir), if land then land.color else C.Navy, M.SmoothPlastic)
		for _, face in { Enum.NormalId.Left, Enum.NormalId.Right } do
			Kit.label(arrow, face, t[1] :: string, { fg = C.Cream, font = Enum.Font.GothamBold })
		end
	end
end

function Plaza.build(root: Instance): { Part }
	local f = Kit.folder("BentonPlaza", root)
	walkways(f)
	mainStreet(f)
	hub(f)
	signposts(f)
	local boards = {
		waitBoard(f, CFrame.new(-44, 0.4, 238) * CFrame.Angles(0, math.rad(-135), 0), "WaitTimesBoard"),
		waitBoard(f, CFrame.new(44, 0.4, -16) * CFrame.Angles(0, math.rad(45), 0), "HubWaitTimesBoard"),
	}
	return boards
end

return Plaza
