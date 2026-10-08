-- Themed set dressing for every land: carts, signs, props, overhead lights
-- and a few moving pieces (windmill, gears, film reels, spinning show cars,
-- the lighthouse lamp). Spots come from a search of the built park for
-- clear ground near the walkways (see PROPS at the bottom of this file).
--
-- Tags used by the clients: "Spinner" (models that turn; attributes
-- SpinSpeed in rad/s and SpinAxis "X"/"Y"/"Z"), "SteamVent", "Campfire",
-- "Searchlight", "NightLight" (lights that only shine at night) and
-- "ParkLamp".

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Kit = require(script.Parent.Kit)

local M = Enum.Material
local C = Config.Colors
local HALF_PI = math.pi / 2

local Theming = {}

local rgb = Color3.fromRGB
local V = Vector3.new
local DARK = rgb(30, 34, 44)
local WOOD = rgb(120, 84, 52)
local DARK_WOOD = rgb(90, 62, 40)
local STEEL = rgb(150, 154, 160)
local RUBBER = rgb(24, 24, 26)
local BRIGHT = { rgb(230, 60, 60), rgb(250, 200, 40), rgb(40, 130, 230), rgb(60, 180, 90), rgb(240, 130, 30), rgb(170, 90, 220) }

type Builder = (f: Instance, cf: CFrame, lc: Color3, rng: Random) -> ()

local function part(f: Instance, size: Vector3, cf: CFrame, color: Color3, mat: Enum.Material?): Part
	return Kit.block(f, size, cf, color, mat or M.SmoothPlastic)
end

-- upright cylinder whose base sits at cf (cf's up axis)
local function upright(f: Instance, height: number, diameter: number, cf: CFrame, color: Color3, mat: Enum.Material?): Part
	return Kit.cyl(f, height, diameter, cf * CFrame.new(0, height / 2, 0) * CFrame.Angles(0, 0, HALF_PI), color, mat or M.SmoothPlastic)
end

local function spinner(f: Instance, name: string, pivot: CFrame, speed: number, axis: string): Model
	local m = Kit.model(name, f)
	local p = part(m, V(0.4, 0.4, 0.4), pivot, Color3.new(1, 1, 1))
	p.Transparency = 1
	p.CanCollide = false
	p.Name = "Pivot"
	m.PrimaryPart = p
	m:SetAttribute("SpinSpeed", speed)
	m:SetAttribute("SpinAxis", axis)
	m:AddTag("Spinner")
	return m
end

local function nightLight(p: BasePart, color: Color3, range: number, kind: string?)
	local light: Light
	if kind == "spot" then
		local s = Instance.new("SpotLight")
		s.Face = Enum.NormalId.Top
		s.Angle = 22
		s.Range = range
		light = s
	else
		local pl = Instance.new("PointLight")
		pl.Range = range
		light = pl
	end
	light.Color = color
	light.Brightness = 2
	light.Shadows = false
	light.Enabled = false
	light.Parent = p
	p:AddTag("NightLight")
end

---------------------------------------------------------------------------
-- Everywhere
---------------------------------------------------------------------------
local function trashCan(f: Instance, cf: CFrame, lc: Color3)
	upright(f, 3.2, 2.2, cf, rgb(46, 58, 54), M.Metal)
	upright(f, 0.6, 2.35, cf * CFrame.new(0, 2.1, 0), lc, M.Metal)
	upright(f, 0.35, 2.5, cf * CFrame.new(0, 3.2, 0), rgb(46, 58, 54), M.Metal)
	upright(f, 0.5, 0.9, cf * CFrame.new(0, 3.5, 0), rgb(46, 58, 54), M.Metal)
end

local function planter(f: Instance, cf: CFrame, lc: Color3, rng: Random)
	part(f, V(4, 1.6, 4), cf * CFrame.new(0, 0.8, 0), rgb(150, 140, 130), M.Brick)
	part(f, V(3.4, 0.2, 3.4), cf * CFrame.new(0, 1.65, 0), rgb(80, 56, 40), M.Ground)
	part(f, V(4.3, 0.3, 4.3), cf * CFrame.new(0, 1.5, 0), lc, M.SmoothPlastic)
	Kit.ball(f, 2.6, (cf * CFrame.new(0, 2.6, 0)).Position, rgb(60, 130, 60), M.Grass)
	for k = 0, 4 do
		local a = k * math.pi * 2 / 5
		Kit.ball(f, 0.8, (cf * CFrame.new(math.cos(a) * 1.3, 2.4 + (k % 2) * 0.6, math.sin(a) * 1.3)).Position, BRIGHT[rng:NextInteger(1, #BRIGHT)], M.SmoothPlastic).CastShadow = false
	end
end

local function flowerBed(f: Instance, cf: CFrame)
	Kit.flowerBed(f, cf.Position, 8, 6)
end

---------------------------------------------------------------------------
-- Benton Plaza
---------------------------------------------------------------------------
local function cartBase(f: Instance, cf: CFrame, body: Color3)
	part(f, V(5, 2.6, 3), cf * CFrame.new(0, 2.3, 0), body)
	part(f, V(5.3, 0.3, 3.3), cf * CFrame.new(0, 3.7, 0), C.Cream)
	for _, sx in { -1.8, 1.8 } do
		Kit.cyl(f, 0.4, 2, cf * CFrame.new(sx, 1, 1.6) * CFrame.Angles(0, HALF_PI, 0), RUBBER, M.Rubber)
		Kit.cyl(f, 0.4, 2, cf * CFrame.new(sx, 1, -1.6) * CFrame.Angles(0, HALF_PI, 0), RUBBER, M.Rubber)
	end
	Kit.beam(f, (cf * CFrame.new(2.6, 3, 0)).Position, (cf * CFrame.new(4, 3.6, 0)).Position, 0.25, STEEL, M.Metal, true)
end

local function popcornCart(f: Instance, cf: CFrame)
	cartBase(f, cf, rgb(200, 40, 40))
	local glass = part(f, V(4, 2.6, 2.4), cf * CFrame.new(0, 5.1, 0), rgb(220, 240, 250), M.Glass)
	glass.Transparency = 0.5
	part(f, V(3.6, 1.2, 2), cf * CFrame.new(0, 4.4, 0), rgb(250, 230, 150))
	for _, sx in { -2.2, 2.2 } do
		upright(f, 4.6, 0.25, cf * CFrame.new(sx, 3.8, 1.3), STEEL, M.Metal)
		upright(f, 4.6, 0.25, cf * CFrame.new(sx, 3.8, -1.3), STEEL, M.Metal)
	end
	for k = -2, 2 do
		part(f, V(1.1, 0.4, 3.8), cf * CFrame.new(k * 1.1, 8.6, 0), if k % 2 == 0 then rgb(220, 40, 40) else rgb(250, 250, 245)).CastShadow = false
	end
	Kit.sign(f, "POPCORN", V(4.4, 1.2, 0.2), cf * CFrame.new(0, 9.5, -0.5) * CFrame.Angles(0, math.pi, 0), { bg = rgb(220, 40, 40), fg = C.Gold, font = Enum.Font.GothamBlack, both = true })
end

local function balloonCart(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	cartBase(f, cf, rgb(40, 110, 200))
	upright(f, 7, 0.3, cf * CFrame.new(0, 3.8, 0), STEEL, M.Metal)
	local top = (cf * CFrame.new(0, 10.8, 0)).Position
	for k = 0, 8 do
		local a = k * 2.4
		local r = if k == 0 then 0 else 1.6 + (k % 3) * 0.5
		local p = top + V(math.cos(a) * r, 1 + (k % 3) * 1.1, math.sin(a) * r)
		Kit.ball(f, 2, p, BRIGHT[rng:NextInteger(1, #BRIGHT)], M.SmoothPlastic)
		Kit.beam(f, top, p - V(0, 1, 0), 0.06, rgb(240, 240, 240), M.SmoothPlastic)
	end
end

local function gasPump(f: Instance, cf: CFrame)
	part(f, V(2.6, 0.4, 2), cf * CFrame.new(0, 0.2, 0), rgb(150, 150, 150), M.Concrete)
	part(f, V(1.8, 5.6, 1.3), cf * CFrame.new(0, 3.2, 0), rgb(200, 40, 40))
	part(f, V(1.4, 1.2, 0.1), cf * CFrame.new(0, 4.6, -0.7), rgb(240, 240, 230)).CastShadow = false
	Kit.ball(f, 1.6, (cf * CFrame.new(0, 6.8, 0)).Position, rgb(255, 250, 230), M.Neon)
	Kit.beam(f, (cf * CFrame.new(1, 4, 0)).Position, (cf * CFrame.new(1.4, 1.6, -0.6)).Position, 0.3, RUBBER, M.Rubber, true)
	Kit.sign(f, "BENTON", V(1.7, 0.6, 0.1), cf * CFrame.new(0, 3, -0.7) * CFrame.Angles(0, math.pi, 0), { bg = C.Navy, fg = C.Gold, font = Enum.Font.GothamBlack })
end

local function clockPost(f: Instance, cf: CFrame)
	upright(f, 1, 1.6, cf, DARK, M.Metal)
	upright(f, 10, 0.6, cf, DARK, M.Metal)
	part(f, V(3.4, 3.4, 1.4), cf * CFrame.new(0, 11.6, 0), DARK, M.Metal)
	for _, side in { -1, 1 } do
		local face = Kit.cyl(f, 0.1, 2.8, cf * CFrame.new(0, 11.6, side * 0.72) * CFrame.Angles(0, HALF_PI, 0), rgb(250, 245, 230), M.SmoothPlastic)
		face.CastShadow = false
		part(f, V(0.18, 1.1, 0.06), cf * CFrame.new(0, 12.1, side * 0.8), DARK)
		part(f, V(0.8, 0.18, 0.06), cf * CFrame.new(0.35, 11.6, side * 0.8), DARK)
	end
	Kit.ball(f, 1, (cf * CFrame.new(0, 13.8, 0)).Position, C.Gold, M.Metal)
end

---------------------------------------------------------------------------
-- Diesel District
---------------------------------------------------------------------------
local CONTAINER_COLORS = { rgb(170, 50, 40), rgb(40, 90, 160), rgb(50, 120, 70), rgb(220, 130, 40), rgb(110, 110, 116) }

local function containerBox(f: Instance, cf: CFrame, color: Color3)
	part(f, V(8, 8.4, 20), cf * CFrame.new(0, 4.2, 0), color, M.CorrodedMetal)
	for k = -3, 3 do
		part(f, V(8.3, 7.6, 0.3), cf * CFrame.new(0, 4.2, k * 2.8), color:Lerp(Color3.new(0, 0, 0), 0.15), M.Metal)
	end
	part(f, V(7, 1.4, 0.1), cf * CFrame.new(0, 6.6, -10.05), rgb(240, 240, 235)).CastShadow = false
end

local function container(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	containerBox(f, cf, CONTAINER_COLORS[rng:NextInteger(1, #CONTAINER_COLORS)])
	if rng:NextNumber() < 0.5 then
		containerBox(f, cf * CFrame.new(0, 8.4, rng:NextNumber(-2, 2)) * CFrame.Angles(0, math.rad(rng:NextNumber(-8, 8)), 0), CONTAINER_COLORS[rng:NextInteger(1, #CONTAINER_COLORS)])
	end
end

local function crane(f: Instance, cf: CFrame)
	local yellow = rgb(240, 190, 40)
	part(f, V(8, 1, 8), cf * CFrame.new(0, 0.5, 0), rgb(120, 120, 126), M.Concrete)
	for _, sx in { -1.6, 1.6 } do
		for _, sz in { -1.6, 1.6 } do
			upright(f, 34, 0.5, cf * CFrame.new(sx, 1, sz), yellow, M.Metal)
		end
	end
	for y = 4, 32, 4 do
		part(f, V(3.6, 0.3, 0.3), cf * CFrame.new(0, y, -1.6), yellow, M.Metal)
		part(f, V(3.6, 0.3, 0.3), cf * CFrame.new(0, y, 1.6), yellow, M.Metal)
		part(f, V(0.3, 0.3, 3.6), cf * CFrame.new(-1.6, y + 2, 0), yellow, M.Metal)
		part(f, V(0.3, 0.3, 3.6), cf * CFrame.new(1.6, y + 2, 0), yellow, M.Metal)
	end
	part(f, V(3.6, 3, 4), cf * CFrame.new(0, 36.5, 0), yellow, M.Metal)
	part(f, V(2.6, 1.6, 0.1), cf * CFrame.new(0, 36.8, -2.05), rgb(150, 200, 230), M.Glass)
	part(f, V(2.4, 2, 30), cf * CFrame.new(0, 39, -10), yellow, M.Metal)
	part(f, V(3.4, 3.4, 4), cf * CFrame.new(0, 38, 7), rgb(110, 110, 116), M.Concrete)
	Kit.beam(f, (cf * CFrame.new(0, 38, -22)).Position, (cf * CFrame.new(0, 18, -22)).Position, 0.15, DARK, M.Metal)
	part(f, V(1.2, 1.6, 1.2), cf * CFrame.new(0, 17.4, -22), rgb(200, 60, 40), M.Metal)
	Kit.sign(f, "BENTON", V(6, 1.6, 0.2), cf * CFrame.new(0, 39, -2) * CFrame.Angles(0, HALF_PI, 0), { bg = yellow, fg = DARK, font = Enum.Font.GothamBlack, both = true })
end

local function pipeRun(f: Instance, cf: CFrame)
	for _, sz in { -6, 0, 6 } do
		part(f, V(5, 3.2, 0.8), cf * CFrame.new(0, 1.6, sz), rgb(110, 110, 116), M.Concrete)
	end
	Kit.cyl(f, 16, 1.4, cf * CFrame.new(-1.2, 3.9, 0) * CFrame.Angles(0, HALF_PI, 0), STEEL, M.Metal)
	Kit.cyl(f, 16, 1, cf * CFrame.new(1.3, 3.7, 0) * CFrame.Angles(0, HALF_PI, 0), rgb(200, 120, 40), M.Metal)
	upright(f, 4, 1, cf * CFrame.new(1.3, 3.7, 8), rgb(200, 120, 40), M.Metal)
	Kit.cyl(f, 0.3, 2.2, cf * CFrame.new(-1.2, 5.3, -3) * CFrame.Angles(0, 0, HALF_PI), C.Red, M.Metal)
	upright(f, 0.8, 0.3, cf * CFrame.new(-1.2, 4.5, -3), STEEL, M.Metal)
end

local function forklift(f: Instance, cf: CFrame)
	local yellow = rgb(240, 180, 30)
	part(f, V(4, 2.4, 6), cf * CFrame.new(0, 2, 0.5), yellow)
	part(f, V(4, 2.2, 1.6), cf * CFrame.new(0, 2.4, 3.6), rgb(60, 60, 64), M.Metal)
	for _, sx in { -1.7, 1.7 } do
		upright(f, 4, 0.25, cf * CFrame.new(sx, 3.2, -1.6), DARK, M.Metal)
		upright(f, 4, 0.25, cf * CFrame.new(sx, 3.2, 2.2), DARK, M.Metal)
		upright(f, 7, 0.4, cf * CFrame.new(sx * 0.7, 0.8, -2.8), DARK, M.Metal)
		part(f, V(0.4, 0.25, 4), cf * CFrame.new(sx * 0.7, 1.2, -4.8), DARK, M.Metal)
		Kit.cyl(f, 1, 2, cf * CFrame.new(sx * 1.1, 1, -1.6), RUBBER, M.Rubber)
		Kit.cyl(f, 1, 1.6, cf * CFrame.new(sx * 1.1, 0.8, 2.6), RUBBER, M.Rubber)
	end
	part(f, V(4, 0.3, 4), cf * CFrame.new(0, 7.3, 0.3), DARK, M.Metal)
	part(f, V(1.6, 0.8, 1.6), cf * CFrame.new(0, 3.6, 1.2), RUBBER)
end

local function gearSculpture(f: Instance, cf: CFrame, lc: Color3)
	part(f, V(4, 3, 4), cf * CFrame.new(0, 1.5, 0), rgb(110, 110, 116), M.Concrete)
	local pivot = cf * CFrame.new(0, 8.2, 0)
	local m = spinner(f, "GearSculpture", pivot, 0.5, "Z")
	Kit.gear(m, pivot, 9, C.Gold)
	upright(f, 3, 1, cf * CFrame.new(0, 3, 0), lc, M.Metal)
end

local function steamVent(f: Instance, cf: CFrame)
	part(f, V(3.4, 0.6, 3.4), cf * CFrame.new(0, 0.3, 0), rgb(90, 90, 96), M.DiamondPlate)
	upright(f, 4, 1.2, cf * CFrame.new(0, 0.6, 0), STEEL, M.Metal)
	local cap = upright(f, 0.5, 1.6, cf * CFrame.new(0, 4.6, 0), rgb(70, 70, 76), M.Metal)
	cap.Name = "SteamVent"
	cap:AddTag("SteamVent")
	local smoke = Instance.new("Smoke")
	smoke.Color = rgb(235, 235, 235)
	smoke.Opacity = 0.18
	smoke.RiseVelocity = 7
	smoke.Size = 3
	smoke.Parent = cap
	part(f, V(2.6, 0.4, 0.1), cf * CFrame.new(0, 2.2, -0.62), rgb(250, 200, 40)).CastShadow = false
end

local function oilDrums(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	local colors = { rgb(30, 90, 170), rgb(190, 40, 40), rgb(240, 180, 30), rgb(60, 60, 64) }
	local n = rng:NextInteger(3, 5)
	for k = 1, n do
		local a = k * 2.1
		local c = colors[rng:NextInteger(1, #colors)]
		local base = cf * CFrame.new(math.cos(a) * 1.5, 0, math.sin(a) * 1.5)
		upright(f, 3.4, 2.2, base, c, M.Metal)
		upright(f, 0.15, 2.3, base * CFrame.new(0, 1.1, 0), c:Lerp(Color3.new(0, 0, 0), 0.3), M.Metal)
		upright(f, 0.15, 2.3, base * CFrame.new(0, 2.3, 0), c:Lerp(Color3.new(0, 0, 0), 0.3), M.Metal)
	end
	Kit.cyl(f, 3.4, 2.2, cf * CFrame.new(3, 1.1, 1) * CFrame.Angles(0, 0.4, 0), colors[1], M.Metal)
end

local function hazardBarrier(f: Instance, cf: CFrame)
	for _, sx in { -3.2, 3.2 } do
		local b = cf * CFrame.new(sx, 0, 0)
		part(f, V(6, 2.4, 1.6), b * CFrame.new(0, 1.2, 0), rgb(200, 200, 196), M.Concrete)
		for k = -2, 2 do
			part(f, V(0.6, 1.2, 0.05), b * CFrame.new(k * 1.2, 1.4, -0.82) * CFrame.Angles(0, 0, 0.6), if k % 2 == 0 then rgb(250, 200, 30) else rgb(30, 30, 30)).CastShadow = false
		end
	end
end

local function tireStack(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	local n = rng:NextInteger(3, 5)
	for k = 0, n - 1 do
		upright(f, 1, 3, cf * CFrame.new(rng:NextNumber(-0.2, 0.2), k * 1, rng:NextNumber(-0.2, 0.2)), RUBBER, M.Rubber)
	end
	upright(f, 1.02, 1.4, cf * CFrame.new(0, (n - 1) * 1, 0), rgb(50, 50, 52), M.Rubber)
end

---------------------------------------------------------------------------
-- Little Haulers
---------------------------------------------------------------------------
local function digger(f: Instance, cf: CFrame)
	local yellow = rgb(250, 190, 30)
	for _, sx in { -2.2, 2.2 } do
		part(f, V(1.6, 1.6, 7), cf * CFrame.new(sx, 0.8, 0), RUBBER, M.Rubber)
	end
	part(f, V(5, 1, 5), cf * CFrame.new(0, 2.1, 0), DARK, M.Metal)
	part(f, V(5, 2.6, 5.4), cf * CFrame.new(0, 3.9, 0.6), yellow)
	part(f, V(2.6, 2.6, 2.6), cf * CFrame.new(-1, 6.5, 1), yellow)
	part(f, V(2.2, 1.6, 0.1), cf * CFrame.new(-1, 6.8, -0.31), rgb(150, 200, 230), M.Glass)
	local boom = cf * CFrame.new(1.2, 5, -2) * CFrame.Angles(math.rad(35), 0, 0)
	part(f, V(1, 1, 7), boom * CFrame.new(0, 0, -3.5), yellow)
	local stick = boom * CFrame.new(0, 0, -7) * CFrame.Angles(math.rad(-85), 0, 0)
	part(f, V(0.8, 0.8, 5), stick * CFrame.new(0, 0, -2.5), yellow)
	Kit.wedge(f, V(2.4, 1.6, 2), stick * CFrame.new(0, -0.4, -5.6) * CFrame.Angles(0, math.pi, 0), rgb(120, 120, 126), M.Metal)
end

local function toyBlocks(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	local letters = { "B", "E", "N", "T", "O", "N" }
	local spots = { V(-3.2, 0, 0), V(0, 0, 0), V(3.2, 0, 0), V(-1.6, 3.2, 0), V(1.6, 3.2, 0), V(0, 6.4, 0) }
	local n = rng:NextInteger(4, 6)
	for k = 1, n do
		local s = spots[k]
		local b = part(f, V(3, 3, 3), cf * CFrame.new(s.X, 1.5 + s.Y, 0) * CFrame.Angles(0, math.rad(rng:NextNumber(-10, 10)), 0), BRIGHT[(k - 1) % #BRIGHT + 1])
		Kit.label(b, Enum.NormalId.Front, letters[k], { fg = Color3.new(1, 1, 1), font = Enum.Font.GothamBlack })
	end
end

local function miniTruck(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	local c = BRIGHT[rng:NextInteger(1, #BRIGHT)]
	part(f, V(5, 2.2, 9), cf * CFrame.new(0, 2.4, 0), c)
	part(f, V(4.6, 2.2, 3.4), cf * CFrame.new(0, 4.6, -1.6), c)
	part(f, V(4.2, 1.4, 0.1), cf * CFrame.new(0, 4.8, -3.35), rgb(150, 200, 230), M.Glass)
	part(f, V(5.2, 0.6, 4), cf * CFrame.new(0, 3.8, 2.6), rgb(250, 250, 245))
	for _, sx in { -2.4, 2.4 } do
		for _, sz in { -3, 3 } do
			Kit.cyl(f, 1.2, 2.8, cf * CFrame.new(sx, 1.4, sz), RUBBER, M.Rubber)
			Kit.cyl(f, 1.25, 1.2, cf * CFrame.new(sx, 1.4, sz), rgb(220, 220, 225), M.Metal)
		end
	end
	Kit.ball(f, 0.8, (cf * CFrame.new(-1.6, 2.6, -4.55)).Position, rgb(255, 250, 220), M.Neon)
	Kit.ball(f, 0.8, (cf * CFrame.new(1.6, 2.6, -4.55)).Position, rgb(255, 250, 220), M.Neon)
end

local function cone(f: Instance, cf: CFrame)
	local orange = rgb(255, 110, 20)
	part(f, V(1.8, 0.3, 1.8), cf * CFrame.new(0, 0.15, 0), orange)
	upright(f, 0.9, 1.3, cf * CFrame.new(0, 0.3, 0), orange)
	upright(f, 0.5, 0.95, cf * CFrame.new(0, 1.2, 0), rgb(250, 250, 250))
	upright(f, 0.6, 0.6, cf * CFrame.new(0, 1.7, 0), orange)
end

local function coneCluster(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	for k = 1, rng:NextInteger(3, 4) do
		local a = k * 1.9
		cone(f, cf * CFrame.new(math.cos(a) * 1.8, 0, math.sin(a) * 1.8))
	end
end

local ROAD_SIGNS = {
	{ "SCHOOL\nZONE", rgb(250, 210, 40), rgb(20, 20, 20) },
	{ "TRUCK\nCROSSING", rgb(250, 210, 40), rgb(20, 20, 20) },
	{ "SPEED\nLIMIT 5", rgb(250, 250, 250), rgb(20, 20, 20) },
	{ "DIG SITE\nAHEAD", rgb(255, 130, 20), rgb(20, 20, 20) },
	{ "YIELD", rgb(220, 40, 40), rgb(250, 250, 250) },
	{ "ONE WAY", rgb(20, 20, 20), rgb(250, 250, 250) },
}
local signIndex = 0
local function roadSign(f: Instance, cf: CFrame)
	signIndex += 1
	local s = ROAD_SIGNS[(signIndex - 1) % #ROAD_SIGNS + 1]
	Kit.postSign(f, s[1] :: string, cf.Position, cf.LookVector, 3.6, 3, { bg = s[2] :: Color3, fg = s[3] :: Color3, font = Enum.Font.GothamBlack, both = true })
end

---------------------------------------------------------------------------
-- Backwoods Junction
---------------------------------------------------------------------------
local function windmill(f: Instance, cf: CFrame)
	local wood = rgb(110, 80, 56)
	local h = 24
	for _, sx in { -1, 1 } do
		for _, sz in { -1, 1 } do
			local a = (cf * CFrame.new(sx * 3.2, 0, sz * 3.2)).Position
			local b = (cf * CFrame.new(sx * 0.8, h, sz * 0.8)).Position
			Kit.beam(f, a, b, 0.5, wood, M.Wood)
		end
	end
	for y = 6, h - 4, 6 do
		local w = 3.2 - y / h * 2.4
		for _, sz in { -1, 1 } do
			part(f, V(w * 2, 0.3, 0.3), cf * CFrame.new(0, y, sz * w), wood, M.Wood)
			part(f, V(0.3, 0.3, w * 2), cf * CFrame.new(sz * w, y, 0), wood, M.Wood)
		end
	end
	part(f, V(2.4, 2, 3), cf * CFrame.new(0, h + 1, 0.4), rgb(140, 140, 146), M.Metal)
	part(f, V(0.2, 3, 5), cf * CFrame.new(0, h + 1.6, 4.4), rgb(200, 60, 40), M.Metal)
	local hub = cf * CFrame.new(0, h + 1, -1.4)
	local m = spinner(f, "Windmill", hub, 1.1, "Z")
	upright(m, 0.6, 1.4, hub * CFrame.Angles(HALF_PI, 0, 0), rgb(140, 140, 146), M.Metal)
	for k = 0, 11 do
		local a = k * math.pi / 6
		part(m, V(0.9, 5.5, 0.15), hub * CFrame.Angles(0, 0, a) * CFrame.new(0, 3.6, 0) * CFrame.Angles(0, 0.35, 0), rgb(230, 228, 220), M.Metal)
	end
	Kit.cyl(f, 0.3, 13, hub * CFrame.new(0, 0, 0.2) * CFrame.Angles(0, HALF_PI, 0), rgb(150, 150, 156), M.Metal).Transparency = 0.6
end

local function campfire(f: Instance, cf: CFrame)
	for k = 0, 9 do
		local a = k * math.pi / 5
		Kit.ball(f, 1.1, (cf * CFrame.new(math.cos(a) * 2, 0.3, math.sin(a) * 2)).Position, rgb(120, 116, 110), M.Slate)
	end
	for k = 0, 3 do
		Kit.cyl(f, 3, 0.6, cf * CFrame.new(0, 0.9, 0) * CFrame.Angles(0, k * math.pi / 4, 0.5), DARK_WOOD, M.Wood)
	end
	local center = part(f, V(1, 1, 1), cf * CFrame.new(0, 1.2, 0), Color3.new(1, 0.5, 0))
	center.Transparency = 1
	center.CanCollide = false
	center.Name = "Campfire"
	center:AddTag("Campfire")
	local fire = Instance.new("Fire")
	fire.Size = 4
	fire.Heat = 6
	fire.Parent = center
	local light = Instance.new("PointLight")
	light.Color = rgb(255, 150, 60)
	light.Range = 18
	light.Brightness = 1.6
	light.Parent = center
	-- log benches
	for _, a in { 0, 2.1, 4.2 } do
		Kit.cyl(f, 4.4, 1.3, cf * CFrame.new(math.cos(a) * 5, 0.65, math.sin(a) * 5) * CFrame.Angles(0, -a + HALF_PI, 0), WOOD, M.Wood)
	end
end

local function logPile(f: Instance, cf: CFrame)
	local rows = { { -1.5, 0, 1.5 }, { -0.75, 0.75 }, { 0 } }
	for r, row in rows do
		for _, x in row do
			local log = Kit.cyl(f, 8, 1.5, cf * CFrame.new(x, 0.75 + (r - 1) * 1.3, 0) * CFrame.Angles(0, HALF_PI, 0), WOOD, M.Wood)
			log.Size = V(8, 1.5, 1.5)
			Kit.cyl(f, 0.1, 1.2, cf * CFrame.new(x, 0.75 + (r - 1) * 1.3, -4.02) * CFrame.Angles(0, HALF_PI, 0), rgb(200, 160, 110), M.Wood)
		end
	end
	upright(f, 3, 0.4, cf * CFrame.new(2.3, 0, 3), DARK_WOOD, M.Wood)
	part(f, V(0.2, 0.8, 1.6), cf * CFrame.new(2.6, 2.6, 3.4) * CFrame.Angles(0, 0, 0.3), STEEL, M.Metal)
end

local function rockPile(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	for k = 1, rng:NextInteger(3, 5) do
		local s = rng:NextNumber(1.8, 4.2)
		local p = cf * CFrame.new(rng:NextNumber(-2.4, 2.4), s * 0.3, rng:NextNumber(-2.4, 2.4)) * CFrame.Angles(rng:NextNumber(0, 1), rng:NextNumber(0, 6), 0)
		Kit.block(f, V(s, s * 0.8, s * 1.1), p, rgb(120, 118, 112):Lerp(rgb(90, 86, 80), rng:NextNumber()), M.Slate)
	end
end

local function wagonWheel(f: Instance, cf: CFrame)
	upright(f, 4, 0.5, cf * CFrame.new(0, 0, 0.8), DARK_WOOD, M.Wood)
	local hubCF = cf * CFrame.new(0, 2.1, 0) * CFrame.Angles(math.rad(-12), 0, 0)
	Kit.cyl(f, 0.3, 4, hubCF * CFrame.Angles(0, HALF_PI, 0), DARK_WOOD, M.Wood)
	Kit.cyl(f, 0.32, 3.2, hubCF * CFrame.Angles(0, HALF_PI, 0), rgb(110, 150, 90), M.Grass).Transparency = 0
	Kit.cyl(f, 0.5, 0.8, hubCF * CFrame.Angles(0, HALF_PI, 0), STEEL, M.Metal)
	for k = 0, 5 do
		part(f, V(0.2, 3.4, 0.2), hubCF * CFrame.Angles(0, 0, k * math.pi / 6), DARK_WOOD, M.Wood)
	end
end

local function barrels(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	for k = 1, rng:NextInteger(2, 3) do
		local base = cf * CFrame.new((k - 2) * 2.6, 0, rng:NextNumber(-0.6, 0.6))
		upright(f, 3.4, 2.4, base, WOOD, M.Wood)
		upright(f, 0.2, 2.5, base * CFrame.new(0, 0.6, 0), rgb(70, 70, 74), M.Metal)
		upright(f, 0.2, 2.5, base * CFrame.new(0, 2.6, 0), rgb(70, 70, 74), M.Metal)
	end
end

local SIGNPOST = {
	{ "RAPIDS", "TOW TRUCK", "TRADING POST" },
	{ "PORK CHOP DINER", "WATER TOWER", "HUB" },
	{ "GOLD MINE", "FISHIN' HOLE", "BEAR CROSSING" },
	{ "BACKWOODS", "1 MILE", "YEEHAW!" },
}
local postIndex = 0
local function signpost(f: Instance, cf: CFrame)
	postIndex += 1
	local words = SIGNPOST[(postIndex - 1) % #SIGNPOST + 1]
	upright(f, 9, 0.6, cf, DARK_WOOD, M.Wood)
	for k, w in words do
		local yaw = (k - 2) * 0.9
		local board = part(f, V(5, 1.2, 0.3), cf * CFrame.new(0, 8 - k * 1.6, 0) * CFrame.Angles(0, yaw, 0) * CFrame.new(2.2, 0, 0), rgb(150, 110, 70), M.WoodPlanks)
		Kit.label(board, Enum.NormalId.Front, w, { fg = C.Cream, font = Enum.Font.GothamBold })
		Kit.label(board, Enum.NormalId.Back, w, { fg = C.Cream, font = Enum.Font.GothamBold })
	end
end

local function lanternPost(f: Instance, cf: CFrame)
	upright(f, 8, 0.6, cf, DARK_WOOD, M.Wood)
	part(f, V(0.4, 0.4, 2.4), cf * CFrame.new(0, 7.6, -1), DARK_WOOD, M.Wood)
	part(f, V(1.2, 0.3, 1.2), cf * CFrame.new(0, 7.1, -2), rgb(40, 40, 44), M.Metal)
	local glass = part(f, V(1, 1.4, 1), cf * CFrame.new(0, 6.2, -2), rgb(255, 220, 160), M.Glass)
	glass.Transparency = 0.4
	local flame = Kit.ball(f, 0.6, (cf * CFrame.new(0, 6.2, -2)).Position, rgb(255, 190, 110), M.Neon)
	flame.CastShadow = false
	flame:AddTag("ParkLamp")
	local light = Instance.new("PointLight")
	light.Color = rgb(255, 180, 110)
	light.Range = 16
	light.Brightness = 1
	light.Shadows = false
	light.Enabled = false
	light.Parent = flame
end

---------------------------------------------------------------------------
-- Benton Movie Studios
---------------------------------------------------------------------------
local function stageCan(f: Instance, cf: CFrame, color: Color3)
	part(f, V(1.2, 1.2, 1.8), cf, rgb(36, 36, 40), M.Metal)
	Kit.cyl(f, 0.1, 1, cf * CFrame.new(0, 0, -0.95) * CFrame.Angles(0, HALF_PI, 0), color, M.Neon).CastShadow = false
end

local function spotTruss(f: Instance, cf: CFrame)
	local grey = rgb(170, 172, 178)
	for _, sx in { -6, 6 } do
		for _, dx in { -0.5, 0.5 } do
			for _, dz in { -0.5, 0.5 } do
				upright(f, 12, 0.2, cf * CFrame.new(sx + dx, 0, dz), grey, M.Metal)
			end
		end
		part(f, V(2, 0.4, 2), cf * CFrame.new(sx, 0.2, 0), DARK, M.Metal)
	end
	for _, dy in { -0.5, 0.5 } do
		for _, dz in { -0.5, 0.5 } do
			part(f, V(13, 0.2, 0.2), cf * CFrame.new(0, 12 + dy, dz), grey, M.Metal)
		end
	end
	for k = -1, 1 do
		stageCan(f, cf * CFrame.new(k * 3.5, 10.6, 0) * CFrame.Angles(math.rad(-35), 0, 0), BRIGHT[k + 2])
	end
end

local function clapper(f: Instance, cf: CFrame)
	part(f, V(4, 2, 3), cf * CFrame.new(0, 1, 0), rgb(110, 110, 116), M.Concrete)
	local board = part(f, V(8, 6, 0.8), cf * CFrame.new(0, 5.2, 0) * CFrame.Angles(math.rad(-6), 0, 0), rgb(26, 26, 30))
	Kit.label(board, Enum.NormalId.Front, "BENTON STUDIOS\nSCENE 1  TAKE 1", { fg = Color3.new(1, 1, 1), font = Enum.Font.GothamBold })
	Kit.label(board, Enum.NormalId.Back, "QUIET ON SET!", { fg = Color3.new(1, 1, 1), font = Enum.Font.GothamBold })
	local top = cf * CFrame.new(-4, 8.4, 0) * CFrame.Angles(0, 0, math.rad(18))
	for k = 0, 5 do
		part(f, V(1.35, 1, 0.8), top * CFrame.new(0.7 + k * 1.35, 0, 0), if k % 2 == 0 then Color3.new(1, 1, 1) else rgb(26, 26, 30))
	end
	for k = 0, 5 do
		part(f, V(1.35, 0.8, 0.8), cf * CFrame.new(-3.3 + k * 1.35, 8.4, 0) * CFrame.Angles(math.rad(-6), 0, 0), if k % 2 == 1 then Color3.new(1, 1, 1) else rgb(26, 26, 30))
	end
end

local function searchlight(f: Instance, cf: CFrame)
	part(f, V(4, 1.6, 6), cf * CFrame.new(0, 1.6, 0), rgb(60, 70, 60), M.Metal)
	for _, sx in { -2.2, 2.2 } do
		Kit.cyl(f, 0.6, 2.2, cf * CFrame.new(sx, 1.1, 0), RUBBER, M.Rubber)
	end
	for _, sx in { -1.4, 1.4 } do
		part(f, V(0.4, 2.4, 0.6), cf * CFrame.new(sx, 3.4, 0), rgb(60, 70, 60), M.Metal)
	end
	local head = cf * CFrame.new(0, 4.4, 0) * CFrame.Angles(math.rad(-12), 0, 0)
	local barrel = Kit.cyl(f, 3, 2.4, head * CFrame.Angles(0, 0, HALF_PI), rgb(70, 80, 70), M.Metal)
	local lens = Kit.cyl(f, 0.1, 2.2, head * CFrame.new(0, 1.55, 0) * CFrame.Angles(0, 0, HALF_PI), rgb(255, 250, 220), M.Neon)
	lens.CastShadow = false
	local beam = part(f, V(0.4, 0.4, 0.4), head * CFrame.new(0, 1.6, 0), Color3.new(1, 1, 1))
	beam.Transparency = 1
	beam.CanCollide = false
	beam.Name = "Searchlight"
	beam:AddTag("Searchlight")
	nightLight(beam, rgb(255, 245, 220), 60, "spot")
	local _ = barrel
end

local function filmReel(f: Instance, cf: CFrame)
	for _, sx in { -1.4, 1.4 } do
		upright(f, 5, 0.5, cf * CFrame.new(sx, 0, 0), DARK, M.Metal)
	end
	part(f, V(4, 0.6, 2), cf * CFrame.new(0, 0.3, 0), DARK, M.Metal)
	local hub = cf * CFrame.new(0, 5.6, 0)
	local m = spinner(f, "FilmReel", hub, 0.8, "X")
	Kit.cyl(m, 0.4, 6.4, hub, rgb(180, 182, 190), M.Metal)
	Kit.cyl(m, 0.5, 1.4, hub, rgb(40, 40, 44), M.Metal)
	for k = 0, 2 do
		local a = k * math.pi * 2 / 3
		Kit.cyl(m, 0.45, 1.6, hub * CFrame.Angles(a, 0, 0) * CFrame.new(0, 1.9, 0), rgb(40, 40, 44), M.Metal)
	end
end

local function movieCamera(f: Instance, cf: CFrame)
	local top = (cf * CFrame.new(0, 5, 0)).Position
	for k = 0, 2 do
		local a = k * math.pi * 2 / 3
		Kit.beam(f, (cf * CFrame.new(math.cos(a) * 1.8, 0, math.sin(a) * 1.8)).Position, top, 0.3, rgb(40, 40, 44), M.Metal)
	end
	part(f, V(2, 2.2, 3.4), cf * CFrame.new(0, 6.1, 0), rgb(40, 40, 44), M.Metal)
	Kit.cyl(f, 1.6, 1.2, cf * CFrame.new(0, 6.1, -2.4) * CFrame.Angles(0, HALF_PI, 0), rgb(30, 30, 34), M.Metal)
	for _, z in { -0.8, 1 } do
		Kit.cyl(f, 0.4, 2.2, cf * CFrame.new(0, 8.2, z), rgb(180, 182, 190), M.Metal)
	end
end

local function directorChair(f: Instance, cf: CFrame, color: Color3, label: string)
	for _, sx in { -1, 1 } do
		for _, sz in { -0.8, 0.8 } do
			upright(f, 2.4, 0.2, cf * CFrame.new(sx, 0, sz), WOOD, M.Wood)
		end
		upright(f, 2, 0.2, cf * CFrame.new(sx, 2.4, 0.8), WOOD, M.Wood)
	end
	part(f, V(2, 0.2, 1.6), cf * CFrame.new(0, 2.4, 0), color, M.Fabric)
	local back = part(f, V(2.2, 1, 0.1), cf * CFrame.new(0, 3.9, 0.85), color, M.Fabric)
	Kit.label(back, Enum.NormalId.Back, label, { fg = Color3.new(1, 1, 1), font = Enum.Font.GothamBlack })
end

local function directorChairs(f: Instance, cf: CFrame)
	directorChair(f, cf * CFrame.new(-1.6, 0, 0), rgb(40, 40, 44), "DIRECTOR")
	directorChair(f, cf * CFrame.new(1.6, 0, 0), rgb(150, 40, 50), "STAR")
end

---------------------------------------------------------------------------
-- Velocity City
---------------------------------------------------------------------------
local function raceCar(f: Instance, cf: CFrame, lc: Color3, rng: Random)
	Kit.disc(f, 13, 0.8, (cf * CFrame.new(0, 0.8, 0)).Position, rgb(30, 34, 44), M.Metal)
	local colors = { lc, rgb(255, 140, 26), rgb(200, 40, 40), rgb(240, 240, 240) }
	local c = colors[rng:NextInteger(1, #colors)]
	local pivot = cf * CFrame.new(0, 0.8, 0)
	local m = spinner(f, "ShowCar", pivot, 0.25, "Y")
	part(m, V(4.4, 1.2, 10), pivot * CFrame.new(0, 1.2, 0), c)
	Kit.wedge(m, V(3.6, 1, 3), pivot * CFrame.new(0, 2, -3.6), c, M.SmoothPlastic)
	part(m, V(2, 1, 2.6), pivot * CFrame.new(0, 2.3, 0.6), rgb(20, 20, 26), M.Glass)
	part(m, V(5.6, 0.25, 1.2), pivot * CFrame.new(0, 3, 4.6), rgb(20, 20, 26))
	part(m, V(5.6, 0.2, 1.2), pivot * CFrame.new(0, 0.9, -5.2), rgb(20, 20, 26))
	for _, sx in { -2.4, 2.4 } do
		for _, sz in { -3.2, 3.4 } do
			Kit.cyl(m, 1, 2.2, pivot * CFrame.new(sx, 1.1, sz), RUBBER, M.Rubber)
		end
	end
	part(m, V(0.6, 0.6, 0.05), pivot * CFrame.new(0, 1.4, -5.02), Color3.new(1, 1, 1)).CastShadow = false
end

local BILLBOARDS = { "NITRO FUEL\nGO FURTHER", "BENTON RACING\nSINCE 1952", "FASTER THAN\nYOUR SHADOW", "PIT STOP PIZZA\nFUEL UP" }
local boardIndex = 0
local function billboard(f: Instance, cf: CFrame, lc: Color3)
	boardIndex += 1
	Kit.postSign(f, BILLBOARDS[(boardIndex - 1) % #BILLBOARDS + 1], cf.Position, cf.LookVector, 16, 7, { bg = rgb(20, 22, 30), fg = if boardIndex % 2 == 0 then C.Orange else lc, font = Enum.Font.GothamBlack, glow = true, both = true })
end

local function podium(f: Instance, cf: CFrame)
	local steps = { { 0, 4, "1", C.Gold }, { -4, 2.6, "2", rgb(200, 200, 210) }, { 4, 1.8, "3", rgb(200, 130, 70) } }
	for _, s in steps do
		local h = s[2] :: number
		local b = part(f, V(4, h, 4), cf * CFrame.new(s[1] :: number, h / 2, 0), rgb(240, 240, 240))
		Kit.label(b, Enum.NormalId.Front, s[3] :: string, { fg = s[4] :: Color3, font = Enum.Font.GothamBlack })
		part(f, V(4.1, 0.3, 4.1), cf * CFrame.new(s[1] :: number, h, 0), s[4] :: Color3, M.Metal)
	end
	upright(f, 1.4, 1.2, cf * CFrame.new(0, 4.1, 0), C.Gold, M.Metal)
	Kit.ball(f, 1.8, (cf * CFrame.new(0, 6.2, 0)).Position, C.Gold, M.Metal)
	Kit.cyl(f, 0.4, 2.6, cf * CFrame.new(0, 7.2, 0) * CFrame.Angles(0, HALF_PI, 0), C.Gold, M.Metal)
end

local function tireBarrier(f: Instance, cf: CFrame)
	for k = -2, 2 do
		for y = 0, 1 do
			upright(f, 1, 2.6, cf * CFrame.new(k * 2.6, y, 0), if (k + y) % 2 == 0 then rgb(220, 40, 40) else rgb(240, 240, 240), M.Rubber)
		end
	end
end

local function chevronSign(f: Instance, cf: CFrame)
	Kit.postSign(f, ">>>", cf.Position, cf.LookVector, 6, 2.2, { bg = rgb(220, 40, 40), fg = Color3.new(1, 1, 1), font = Enum.Font.GothamBlack, both = true })
end

local function checkerFlag(f: Instance, cf: CFrame)
	upright(f, 11, 0.3, cf, rgb(200, 200, 205), M.Metal)
	for i = 0, 3 do
		for j = 0, 2 do
			part(f, V(0.9, 0.9, 0.08), cf * CFrame.new(0.6 + i * 0.9, 9.9 - j * 0.9, 0), if (i + j) % 2 == 0 then Color3.new(1, 1, 1) else rgb(20, 20, 20)).CastShadow = false
		end
	end
end

local function neonPost(f: Instance, cf: CFrame, lc: Color3)
	upright(f, 9, 0.8, cf, rgb(30, 34, 44), M.Metal)
	part(f, V(0.25, 7, 0.25), cf * CFrame.new(0, 4.5, -0.42), lc, M.Neon).CastShadow = false
	part(f, V(0.25, 7, 0.25), cf * CFrame.new(0, 4.5, 0.42), rgb(255, 140, 26), M.Neon).CastShadow = false
	upright(f, 0.4, 1.2, cf * CFrame.new(0, 9, 0), rgb(30, 34, 44), M.Metal)
end

---------------------------------------------------------------------------
-- Benton Family Landing
---------------------------------------------------------------------------
local function lighthouse(f: Instance, cf: CFrame)
	upright(f, 1.2, 12, cf, rgb(150, 146, 140), M.Cobblestone)
	local y = 1.2
	for k = 0, 5 do
		local d = 7 - k * 0.6
		upright(f, 4, d, cf * CFrame.new(0, y, 0), if k % 2 == 0 then rgb(240, 240, 236) else rgb(200, 40, 40), M.SmoothPlastic)
		y += 4
	end
	upright(f, 0.6, 6.4, cf * CFrame.new(0, y, 0), DARK, M.Metal)
	local glass = upright(f, 3, 3.6, cf * CFrame.new(0, y + 0.6, 0), rgb(255, 250, 220), M.Glass)
	glass.Transparency = 0.5
	upright(f, 1, 4.4, cf * CFrame.new(0, y + 3.6, 0), rgb(200, 40, 40), M.Metal)
	upright(f, 1, 2.6, cf * CFrame.new(0, y + 4.6, 0), rgb(200, 40, 40), M.Metal)
	Kit.ball(f, 0.8, (cf * CFrame.new(0, y + 6, 0)).Position, DARK, M.Metal)
	local lampCF = cf * CFrame.new(0, y + 2.1, 0)
	local m = spinner(f, "LighthouseLamp", lampCF, 0.9, "Y")
	local lamp = Kit.ball(m, 1.4, lampCF.Position, rgb(255, 245, 200), M.Neon)
	lamp.CastShadow = false
	local beamPart = part(m, V(0.4, 0.4, 0.4), lampCF * CFrame.Angles(HALF_PI, 0, 0), Color3.new(1, 1, 1))
	beamPart.Transparency = 1
	beamPart.CanCollide = false
	beamPart.Name = "Lighthouse"
	beamPart:AddTag("Lighthouse")
	nightLight(beamPart, rgb(255, 245, 210), 120, "spot")
	-- door and a little railing
	part(f, V(2, 3.2, 0.3), cf * CFrame.new(0, 2.8, -3.4), DARK_WOOD, M.Wood)
end

local function gazebo(f: Instance, cf: CFrame)
	upright(f, 1.2, 16, cf, rgb(240, 236, 228), M.WoodPlanks)
	for k = 0, 7 do
		local a = k * math.pi / 4
		upright(f, 9, 0.6, cf * CFrame.new(math.cos(a) * 7, 1.2, math.sin(a) * 7), rgb(250, 250, 248), M.Wood)
		if k ~= 2 then
			local a2 = a + math.pi / 4
			local p1 = (cf * CFrame.new(math.cos(a) * 7, 3.6, math.sin(a) * 7)).Position
			local p2 = (cf * CFrame.new(math.cos(a2) * 7, 3.6, math.sin(a2) * 7)).Position
			Kit.beam(f, p1, p2, 0.3, rgb(250, 250, 248), M.Wood)
		end
	end
	upright(f, 0.8, 17, cf * CFrame.new(0, 10.2, 0), rgb(70, 140, 110), M.SmoothPlastic)
	upright(f, 1.6, 12, cf * CFrame.new(0, 11, 0), rgb(70, 140, 110), M.SmoothPlastic)
	upright(f, 1.6, 7, cf * CFrame.new(0, 12.6, 0), rgb(70, 140, 110), M.SmoothPlastic)
	upright(f, 1.4, 2.6, cf * CFrame.new(0, 14.2, 0), rgb(70, 140, 110), M.SmoothPlastic)
	Kit.ball(f, 1.2, (cf * CFrame.new(0, 16, 0)).Position, C.Gold, M.Metal)
	-- string of bulbs around the eaves
	for k = 0, 23 do
		local a = k * math.pi / 12
		Kit.ball(f, 0.45, (cf * CFrame.new(math.cos(a) * 8.2, 10, math.sin(a) * 8.2)).Position, rgb(255, 236, 190), M.Neon).CastShadow = false
	end
end

local function rowboat(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	local colors = { rgb(200, 60, 50), rgb(40, 110, 200), rgb(240, 240, 236), rgb(60, 150, 90) }
	local c = colors[rng:NextInteger(1, #colors)]
	local base = cf * CFrame.new(0, -0.5, 0)
	part(f, V(3.4, 1.2, 7), base * CFrame.new(0, 0.6, 0), c, M.Wood)
	Kit.wedge(f, V(3.4, 1.2, 2.4), base * CFrame.new(0, 0.6, -4.7), c, M.Wood)
	part(f, V(3, 0.2, 6.6), base * CFrame.new(0, 1.05, 0), rgb(170, 130, 90), M.WoodPlanks)
	part(f, V(3.2, 0.3, 0.8), base * CFrame.new(0, 1.4, 1), rgb(150, 110, 70), M.Wood)
	for _, sx in { -1, 1 } do
		Kit.beam(f, (base * CFrame.new(sx * 1.6, 1.6, 0.6)).Position, (base * CFrame.new(sx * 4.2, 0, -0.6)).Position, 0.25, rgb(150, 110, 70), M.Wood)
	end
end

local function picnic(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	local colors = { rgb(200, 40, 40), rgb(40, 110, 200), rgb(60, 150, 90) }
	local c = colors[rng:NextInteger(1, #colors)]
	for i = 0, 3 do
		for j = 0, 3 do
			part(f, V(1.5, 0.1, 1.5), cf * CFrame.new(-2.25 + i * 1.5, 0.15, -2.25 + j * 1.5), if (i + j) % 2 == 0 then c else rgb(250, 250, 245), M.Fabric).CastShadow = false
		end
	end
	part(f, V(1.8, 1, 1.2), cf * CFrame.new(1.4, 0.7, 1.2), rgb(170, 120, 70), M.Wood)
	Kit.beam(f, (cf * CFrame.new(0.7, 1.2, 1.2)).Position, (cf * CFrame.new(2.1, 1.2, 1.2)).Position, 0.15, rgb(140, 100, 60), M.Wood)
	Kit.disc(f, 1.2, 0.1, (cf * CFrame.new(-1, 0.3, -0.8)).Position, rgb(250, 250, 250), M.SmoothPlastic)
	Kit.ball(f, 0.7, (cf * CFrame.new(-1, 0.6, -0.8)).Position, rgb(220, 50, 50), M.SmoothPlastic)
end

local function beachUmbrella(f: Instance, cf: CFrame, _lc: Color3, rng: Random)
	local colors = { rgb(240, 80, 80), rgb(40, 150, 220), rgb(250, 200, 40), rgb(60, 170, 120) }
	local c = colors[rng:NextInteger(1, #colors)]
	upright(f, 7, 0.3, cf, rgb(240, 240, 240), M.Metal)
	upright(f, 0.5, 7, cf * CFrame.new(0, 6.4, 0), c, M.Fabric)
	upright(f, 0.6, 4.4, cf * CFrame.new(0, 6.9, 0), rgb(250, 250, 245), M.Fabric)
	upright(f, 0.5, 1.6, cf * CFrame.new(0, 7.4, 0), c, M.Fabric)
	for _, sx in { -1, 1 } do
		local lounger = cf * CFrame.new(sx * 2.6, 0, 1.4)
		part(f, V(1.8, 0.4, 4.4), lounger * CFrame.new(0, 0.9, 0.4), rgb(250, 250, 245), M.Fabric)
		part(f, V(1.8, 0.4, 2), lounger * CFrame.new(0, 1.5, -2.2) * CFrame.Angles(math.rad(50), 0, 0), rgb(250, 250, 245), M.Fabric)
		part(f, V(1.6, 0.6, 3.6), lounger * CFrame.new(0, 0.4, 0.4), rgb(200, 200, 205), M.Metal)
	end
end

local function duckStatue(f: Instance, cf: CFrame)
	local yellow = rgb(250, 210, 40)
	Kit.ellipsoid(f, V(3, 2.6, 4.2), cf * CFrame.new(0, 1.5, 0), yellow, M.SmoothPlastic)
	Kit.ball(f, 2.2, (cf * CFrame.new(0, 3.4, -1.3)).Position, yellow, M.SmoothPlastic)
	Kit.wedge(f, V(1.2, 0.5, 1), cf * CFrame.new(0, 3.2, -2.7) * CFrame.Angles(0, math.pi, 0), rgb(255, 140, 30), M.SmoothPlastic)
	for _, sx in { -0.6, 0.6 } do
		Kit.ball(f, 0.35, (cf * CFrame.new(sx, 3.8, -2.3)).Position, rgb(20, 20, 20), M.SmoothPlastic)
	end
	Kit.wedge(f, V(1.6, 1, 1.4), cf * CFrame.new(0, 2.6, 2.2), yellow, M.SmoothPlastic)
end

---------------------------------------------------------------------------
-- Overhead string lights and the studio walk of fame
---------------------------------------------------------------------------
local BULBS = { rgb(255, 236, 190), rgb(255, 120, 100), rgb(120, 200, 255), rgb(140, 240, 140), rgb(255, 220, 90) }

local function stringLights(f: Instance, a: Vector3, b: Vector3, sag: number, spacing: number)
	local len = (b - a).Magnitude
	local n = math.max(2, math.floor(len / spacing))
	local prev = a
	for k = 1, n do
		local t = k / n
		local p = a:Lerp(b, t) - Vector3.new(0, sag * 4 * t * (1 - t), 0)
		Kit.beam(f, prev, p, 0.08, rgb(40, 40, 44), M.SmoothPlastic).CastShadow = false
		if k < n then
			local bulb = Kit.ball(f, 0.6, p - Vector3.new(0, 0.35, 0), BULBS[(k - 1) % #BULBS + 1], M.Neon)
			bulb.CastShadow = false
			bulb.CanCollide = false
		end
		prev = p
	end
end

local function mainStreetLights(f: Instance)
	-- zig-zag between the banner poles on both sides of Main Street
	for z = 10, 208, 22 do
		local west = Vector3.new(-23, 16.2, z)
		local east = Vector3.new(23, 16.2, z + 11)
		local nextWest = Vector3.new(-23, 16.2, z + 22)
		if not (z + 11 > 118 and z < 146) then
			stringLights(f, west, east, 2.4, 2.6)
		end
		if z + 22 <= 208 and not (z + 22 > 118 and z + 11 < 146) then
			stringLights(f, east, nextWest, 2.4, 2.6)
		end
	end
end

local function backwoodsLights(f: Instance)
	local corners = { V(-244, 11.2, -160), V(-152, 11.2, -160), V(-152, 11.2, -220), V(-244, 11.2, -220) }
	for i = 1, 4 do
		stringLights(f, corners[i], corners[i % 4 + 1], 1.6, 3)
	end
	stringLights(f, corners[1], corners[3], 3, 3.2)
	stringLights(f, corners[2], corners[4], 3, 3.2)
end

local function walkOfFame(f: Instance)
	-- gold stars along both backlot sidewalks
	for _, x in { -26, 26 } do
		for z = -150, -290, -14 do
			local cf = CFrame.new(x, 0.47, z)
			Kit.disc(f, 2.2, 0.06, cf.Position + Vector3.new(0, 0.03, 0), rgb(200, 60, 80), M.SmoothPlastic).CastShadow = false
			for k = 0, 4 do
				local ray = part(f, V(0.7, 0.06, 1.6), cf * CFrame.Angles(0, k * math.pi * 2 / 5, 0) * CFrame.new(0, 0.06, -0.8), C.Gold, M.Metal)
				ray.CastShadow = false
				ray.CanCollide = false
			end
		end
	end
end

local function redCarpet(f: Instance)
	local carpet = Kit.block(f, V(8, 0.1, 30), CFrame.new(0, 0.5, -160), rgb(170, 30, 40), M.Fabric)
	carpet.CastShadow = false
	for _, sx in { -5, 5 } do
		local prev: Vector3? = nil
		for z = -146, -174, -4 do
			local base = Vector3.new(sx, 0.45, z)
			Kit.post(f, 0.3, 1.2, base, C.Gold, M.Metal)
			Kit.post(f, 3, 0.3, base, C.Gold, M.Metal)
			local top = base + Vector3.new(0, 2.8, 0)
			Kit.ball(f, 0.5, top + Vector3.new(0, 0.3, 0), C.Gold, M.Metal)
			if prev then
				local mid = (prev + top) / 2 - Vector3.new(0, 0.5, 0)
				Kit.beam(f, prev, mid, 0.25, rgb(150, 20, 40), M.Fabric, true).CanCollide = false
				Kit.beam(f, mid, top, 0.25, rgb(150, 20, 40), M.Fabric, true).CanCollide = false
			end
			prev = top
		end
	end
end

---------------------------------------------------------------------------
-- Builders and placements
---------------------------------------------------------------------------
local BUILDERS: { [string]: Builder } = {
	trash_can = trashCan,
	planter = planter,
	flower_bed = flowerBed :: any,
	popcorn_cart = popcornCart :: any,
	balloon_cart = balloonCart,
	gas_pump = gasPump :: any,
	clock_post = clockPost :: any,
	crane = crane :: any,
	container = container,
	pipe_run = pipeRun :: any,
	forklift = forklift :: any,
	gear_sculpture = gearSculpture :: any,
	steam_vent = steamVent :: any,
	oil_drums = oilDrums,
	hazard_barrier = hazardBarrier :: any,
	tire_stack = tireStack,
	digger = digger :: any,
	toy_blocks = toyBlocks,
	mini_truck = miniTruck,
	cone_cluster = coneCluster,
	road_sign = roadSign :: any,
	windmill = windmill :: any,
	campfire = campfire :: any,
	log_pile = logPile :: any,
	rock_pile = rockPile,
	wagon_wheel = wagonWheel :: any,
	barrels = barrels,
	signpost = signpost :: any,
	lantern_post = lanternPost :: any,
	spot_truss = spotTruss :: any,
	clapper = clapper :: any,
	searchlight = searchlight :: any,
	film_reel = filmReel :: any,
	movie_camera = movieCamera :: any,
	director_chairs = directorChairs :: any,
	race_car = raceCar,
	billboard = billboard :: any,
	podium = podium :: any,
	tire_barrier = tireBarrier :: any,
	chevron_sign = chevronSign :: any,
	checker_flag = checkerFlag :: any,
	neon_post = neonPost :: any,
	lighthouse = lighthouse :: any,
	gazebo = gazebo :: any,
	rowboat = rowboat,
	picnic = picnic,
	beach_umbrella = beachUmbrella,
	duck_statue = duckStatue :: any,
}

-- Footprint radius of each prop (studs), used to keep trees away.
Theming.RADIUS = {
	trash_can = 1, planter = 2, flower_bed = 4, popcorn_cart = 3, balloon_cart = 3, gas_pump = 1.5, clock_post = 1.5,
	crane = 7, container = 6, pipe_run = 6, forklift = 4, gear_sculpture = 4, steam_vent = 2, oil_drums = 3,
	hazard_barrier = 3, tire_stack = 2, digger = 5, toy_blocks = 4, mini_truck = 4, cone_cluster = 3, road_sign = 1.5,
	windmill = 6, campfire = 4, log_pile = 4, rock_pile = 4, wagon_wheel = 2, barrels = 2, signpost = 1.5,
	lantern_post = 1, spot_truss = 4, clapper = 4, searchlight = 3, film_reel = 3, movie_camera = 3,
	director_chairs = 3, race_car = 6, billboard = 6, podium = 5, tire_barrier = 5, chevron_sign = 2,
	checker_flag = 1, neon_post = 1, lighthouse = 5, gazebo = 7, rowboat = 3, picnic = 4, beach_umbrella = 3,
	duck_statue = 2,
} :: { [string]: number }

-- {land, kind, x, z, yaw}
Theming.PROPS = {
	-- Plaza
	{ "Plaza", "popcorn_cart", -67.5, -37.5, -90 },
	{ "Plaza", "popcorn_cart", 69.5, -76.5, 180 },
	{ "Plaza", "popcorn_cart", 38.5, -124.5, 180 },
	{ "Plaza", "balloon_cart", -65.5, -92.5, -90 },
	{ "Plaza", "balloon_cart", -64.5, -75.5, -90 },
	{ "Plaza", "balloon_cart", 38.5, 11.5, 90 },
	{ "Plaza", "gas_pump", -45.5, 213.5, 180 },
	{ "Plaza", "gas_pump", 65.5, -5.5, 90 },
	{ "Plaza", "clock_post", -66.5, 261.5, -90 },
	{ "Plaza", "clock_post", -56.5, 218.5, 180 },
	{ "Plaza", "planter", -30.5, -124.5, 180 },
	{ "Plaza", "planter", -69.5, -57.5, -90 },
	{ "Plaza", "planter", 44.5, 216.5, 180 },
	{ "Plaza", "planter", 51.5, 79.5, 0 },
	{ "Plaza", "planter", -35.5, 133.5, -90 },
	{ "Plaza", "planter", 38.5, 42.5, 90 },
	{ "Plaza", "planter", 66.5, 270.5, 90 },
	{ "Plaza", "planter", 68.5, -87.5, 90 },
	{ "Plaza", "trash_can", 53.5, 213.5, 180 },
	{ "Plaza", "trash_can", -68.5, -17.5, -90 },
	{ "Plaza", "trash_can", -38.5, 207.5, -90 },
	{ "Plaza", "trash_can", 67.5, -18.5, 90 },
	{ "Plaza", "trash_can", 35.5, 144.5, 90 },
	{ "Plaza", "trash_can", 55.5, 7.5, 0 },
	{ "Plaza", "trash_can", -36.5, 37.5, -90 },
	{ "Plaza", "trash_can", -38.5, 106.5, -90 },
	-- Diesel
	{ "Diesel", "crane", -208.5, -45.5, 165 },
	{ "Diesel", "container", -318.5, -47.5, 0 },
	{ "Diesel", "container", -106.5, -116.5, -30 },
	{ "Diesel", "container", -233.5, 23.5, -90 },
	{ "Diesel", "container", -177.5, 111.5, 90 },
	{ "Diesel", "container", -193.5, -75.5, -180 },
	{ "Diesel", "pipe_run", -143.5, -132.5, 120 },
	{ "Diesel", "pipe_run", -76.5, -106.5, -30 },
	{ "Diesel", "pipe_run", -157.5, -44.5, 30 },
	{ "Diesel", "forklift", -292.5, -72.5, 30 },
	{ "Diesel", "forklift", -323.5, 56.5, -60 },
	{ "Diesel", "gear_sculpture", -121.5, -2.5, 180 },
	{ "Diesel", "gear_sculpture", -79.5, 34.5, 0 },
	{ "Diesel", "steam_vent", -185.5, -38.5, 105 },
	{ "Diesel", "steam_vent", -233.5, 117.5, -75 },
	{ "Diesel", "steam_vent", -73.5, -45.5, -90 },
	{ "Diesel", "steam_vent", -136.5, 110.5, 90 },
	{ "Diesel", "steam_vent", -102.5, -5.5, 180 },
	{ "Diesel", "oil_drums", -319.5, 3.5, -90 },
	{ "Diesel", "oil_drums", -148.5, 1.5, 180 },
	{ "Diesel", "oil_drums", -305.5, -84.5, -90 },
	{ "Diesel", "oil_drums", -154.5, -30.5, 165 },
	{ "Diesel", "oil_drums", -195.5, 57.5, 0 },
	{ "Diesel", "oil_drums", -241.5, 50.5, 90 },
	{ "Diesel", "oil_drums", -141.5, 117.5, 90 },
	{ "Diesel", "oil_drums", -194.5, -61.5, -135 },
	{ "Diesel", "hazard_barrier", -288.5, -83.5, 90 },
	{ "Diesel", "hazard_barrier", -75.5, -1.5, 180 },
	{ "Diesel", "hazard_barrier", -176.5, -54.5, 30 },
	{ "Diesel", "hazard_barrier", -193.5, -42.5, 165 },
	{ "Diesel", "hazard_barrier", -241.5, -5.5, 90 },
	{ "Diesel", "tire_stack", -222.5, -59.5, 90 },
	{ "Diesel", "tire_stack", -230.5, -10.5, -90 },
	{ "Diesel", "tire_stack", -186.5, 104.5, 90 },
	{ "Diesel", "tire_stack", -306.5, -126.5, 180 },
	{ "Diesel", "tire_stack", -224.5, -47.5, 180 },
	{ "Diesel", "tire_stack", -188.5, 121.5, 15 },
	{ "Diesel", "trash_can", -316.5, 44.5, -90 },
	{ "Diesel", "trash_can", -121.5, -135.5, -30 },
	{ "Diesel", "trash_can", -223.5, 112.5, -90 },
	{ "Diesel", "trash_can", -187.5, 56.5, -90 },
	{ "Diesel", "trash_can", -166.5, -138.5, 165 },
	{ "Diesel", "trash_can", -89.5, -118.5, -30 },
	{ "Diesel", "trash_can", -233.5, 43.5, -90 },
	{ "Diesel", "trash_can", -341.5, -99.5, 45 },
	-- Haulers
	{ "Haulers", "digger", -235.5, 215.5, -105 },
	{ "Haulers", "digger", -290.5, 183.5, 0 },
	{ "Haulers", "toy_blocks", -225.5, 262.5, 0 },
	{ "Haulers", "toy_blocks", -319.5, 203.5, 90 },
	{ "Haulers", "toy_blocks", -213.5, 173.5, 120 },
	{ "Haulers", "toy_blocks", -317.5, 191.5, 60 },
	{ "Haulers", "mini_truck", -258.5, 234.5, 180 },
	{ "Haulers", "mini_truck", -145.5, 251.5, 0 },
	{ "Haulers", "mini_truck", -89.5, 205.5, 90 },
	{ "Haulers", "cone_cluster", -231.5, 200.5, -75 },
	{ "Haulers", "cone_cluster", -141.5, 176.5, 90 },
	{ "Haulers", "cone_cluster", -334.5, 172.5, -120 },
	{ "Haulers", "cone_cluster", -251.5, 177.5, 0 },
	{ "Haulers", "cone_cluster", -135.5, 249.5, 0 },
	{ "Haulers", "cone_cluster", -99.5, 170.5, 180 },
	{ "Haulers", "road_sign", -315.5, 223.5, 135 },
	{ "Haulers", "road_sign", -303.5, 175.5, -30 },
	{ "Haulers", "road_sign", -337.5, 230.5, -75 },
	{ "Haulers", "road_sign", -223.5, 163.5, 135 },
	{ "Haulers", "road_sign", -314.5, 253.5, -30 },
	{ "Haulers", "road_sign", -338.5, 181.5, -120 },
	{ "Haulers", "trash_can", -209.5, 180.5, -135 },
	{ "Haulers", "trash_can", -74.5, 159.5, -90 },
	{ "Haulers", "trash_can", -344.5, 201.5, -120 },
	{ "Haulers", "trash_can", -92.5, 181.5, 90 },
	{ "Haulers", "trash_can", -282.5, 234.5, 180 },
	{ "Haulers", "trash_can", -234.5, 157.5, 165 },
	-- Backwoods
	{ "Backwoods", "windmill", -297.5, -145.5, 0 },
	{ "Backwoods", "campfire", -141.5, -216.5, 180 },
	{ "Backwoods", "campfire", -144.5, -150.5, -45 },
	{ "Backwoods", "log_pile", -164.5, -163.5, -45 },
	{ "Backwoods", "log_pile", -311.5, -162.5, -90 },
	{ "Backwoods", "log_pile", -309.5, -201.5, -120 },
	{ "Backwoods", "log_pile", -173.5, -195.5, -120 },
	{ "Backwoods", "log_pile", -119.5, -219.5, 0 },
	{ "Backwoods", "log_pile", -118.5, -253.5, 180 },
	{ "Backwoods", "rock_pile", -230.5, -387.5, 75 },
	{ "Backwoods", "rock_pile", -130.5, -372.5, -90 },
	{ "Backwoods", "rock_pile", -177.5, -230.5, -90 },
	{ "Backwoods", "rock_pile", -321.5, -196.5, -90 },
	{ "Backwoods", "rock_pile", -285.5, -152.5, 0 },
	{ "Backwoods", "rock_pile", -315.5, -179.5, -90 },
	{ "Backwoods", "wagon_wheel", -309.5, -171.5, -90 },
	{ "Backwoods", "wagon_wheel", -121.5, -379.5, -90 },
	{ "Backwoods", "wagon_wheel", -129.5, -141.5, -45 },
	{ "Backwoods", "wagon_wheel", -132.5, -215.5, 180 },
	{ "Backwoods", "barrels", -305.5, -223.5, -90 },
	{ "Backwoods", "barrels", -156.5, -157.5, -30 },
	{ "Backwoods", "barrels", -111.5, -214.5, 150 },
	{ "Backwoods", "barrels", -310.5, -188.5, -90 },
	{ "Backwoods", "barrels", -134.5, -146.5, -45 },
	{ "Backwoods", "barrels", -145.5, -228.5, 0 },
	{ "Backwoods", "signpost", -126.5, -250.5, 180 },
	{ "Backwoods", "signpost", -184.5, -140.5, 180 },
	{ "Backwoods", "signpost", -124.5, -363.5, -90 },
	{ "Backwoods", "signpost", -110.5, -167.5, 165 },
	{ "Backwoods", "lantern_post", -110.5, -315.5, -30 },
	{ "Backwoods", "lantern_post", -172.5, -170.5, -45 },
	{ "Backwoods", "lantern_post", -110.5, -199.5, 90 },
	{ "Backwoods", "lantern_post", -110.5, -189.5, 90 },
	{ "Backwoods", "lantern_post", -148.5, -204.5, -90 },
	{ "Backwoods", "lantern_post", -126.5, -214.5, 180 },
	{ "Backwoods", "lantern_post", -304.5, -217.5, -90 },
	{ "Backwoods", "lantern_post", -303.5, -211.5, -90 },
	{ "Backwoods", "lantern_post", -299.5, -155.5, 0 },
	{ "Backwoods", "lantern_post", -127.5, -220.5, -15 },
	{ "Backwoods", "trash_can", -283.5, -205.5, 90 },
	{ "Backwoods", "trash_can", -110.5, -221.5, 0 },
	{ "Backwoods", "trash_can", -162.5, -201.5, 165 },
	{ "Backwoods", "trash_can", -304.5, -154.5, -15 },
	{ "Backwoods", "trash_can", -110.5, -252.5, 180 },
	{ "Backwoods", "trash_can", -110.5, -205.5, 90 },
	-- Studios
	{ "Studios", "spot_truss", 93.5, -154.5, -165 },
	{ "Studios", "spot_truss", -90.5, -172.5, -90 },
	{ "Studios", "spot_truss", 105.5, -307.5, 30 },
	{ "Studios", "clapper", -42.5, -130.5, 180 },
	{ "Studios", "clapper", 36.5, -152.5, 90 },
	{ "Studios", "searchlight", -101.5, -162.5, 120 },
	{ "Studios", "searchlight", -85.5, -254.5, -90 },
	{ "Studios", "searchlight", 108.5, -160.5, -165 },
	{ "Studios", "searchlight", 112.5, -174.5, -90 },
	{ "Studios", "searchlight", 34.5, -177.5, 90 },
	{ "Studios", "searchlight", -83.5, -153.5, 150 },
	{ "Studios", "film_reel", -68.5, -160.5, 0 },
	{ "Studios", "film_reel", -54.5, -160.5, 0 },
	{ "Studios", "film_reel", -35.5, -271.5, -90 },
	{ "Studios", "film_reel", -54.5, -130.5, 120 },
	{ "Studios", "movie_camera", -85.5, -230.5, -90 },
	{ "Studios", "movie_camera", -54.5, -215.5, 0 },
	{ "Studios", "movie_camera", -66.5, -268.5, 180 },
	{ "Studios", "director_chairs", 47.5, -126.5, 180 },
	{ "Studios", "director_chairs", -106.5, -179.5, 90 },
	{ "Studios", "director_chairs", -32.5, -303.5, -165 },
	{ "Studios", "director_chairs", -84.5, -193.5, -90 },
	{ "Studios", "trash_can", 33.5, -129.5, 180 },
	{ "Studios", "trash_can", 83.5, -306.5, 0 },
	{ "Studios", "trash_can", -101.5, -220.5, 0 },
	{ "Studios", "trash_can", -104.5, -311.5, -15 },
	{ "Studios", "trash_can", -80.5, -263.5, -120 },
	{ "Studios", "trash_can", -82.5, -239.5, -90 },
	-- Velocity
	{ "Velocity", "race_car", 179.5, -370.5, 45 },
	{ "Velocity", "race_car", 165.5, -358.5, -30 },
	{ "Velocity", "race_car", 324.5, -30.5, 0 },
	{ "Velocity", "billboard", 309.5, -162.5, 60 },
	{ "Velocity", "billboard", 232.5, -296.5, 165 },
	{ "Velocity", "billboard", 279.5, -303.5, 180 },
	{ "Velocity", "podium", 100.5, -117.5, 45 },
	{ "Velocity", "tire_barrier", 113.5, -60.5, 30 },
	{ "Velocity", "tire_barrier", 215.5, -212.5, 180 },
	{ "Velocity", "tire_barrier", 255.5, -31.5, 0 },
	{ "Velocity", "tire_barrier", 295.5, -184.5, -90 },
	{ "Velocity", "tire_barrier", 308.5, -9.5, 180 },
	{ "Velocity", "tire_barrier", 341.5, -342.5, 165 },
	{ "Velocity", "chevron_sign", 344.5, -181.5, 90 },
	{ "Velocity", "chevron_sign", 201.5, -220.5, 60 },
	{ "Velocity", "chevron_sign", 330.5, -182.5, -90 },
	{ "Velocity", "chevron_sign", 214.5, -31.5, 60 },
	{ "Velocity", "checker_flag", 196.5, 16.5, -30 },
	{ "Velocity", "checker_flag", 235.5, -198.5, 90 },
	{ "Velocity", "checker_flag", 177.5, -381.5, 150 },
	{ "Velocity", "checker_flag", 316.5, -333.5, -90 },
	{ "Velocity", "checker_flag", 116.5, -206.5, -90 },
	{ "Velocity", "checker_flag", 115.5, -104.5, -90 },
	{ "Velocity", "checker_flag", 232.5, -31.5, 0 },
	{ "Velocity", "checker_flag", 286.5, -165.5, -150 },
	{ "Velocity", "neon_post", 168.5, -300.5, -75 },
	{ "Velocity", "neon_post", 366.5, -15.5, 90 },
	{ "Velocity", "neon_post", 249.5, -342.5, -150 },
	{ "Velocity", "neon_post", 182.5, -78.5, 180 },
	{ "Velocity", "neon_post", 282.5, -67.5, 15 },
	{ "Velocity", "neon_post", 288.5, -152.5, -15 },
	{ "Velocity", "neon_post", 305.5, -32.5, 0 },
	{ "Velocity", "neon_post", 225.5, -249.5, 180 },
	{ "Velocity", "neon_post", 328.5, -334.5, 90 },
	{ "Velocity", "neon_post", 292.5, -293.5, 165 },
	{ "Velocity", "trash_can", 284.5, -155.5, -75 },
	{ "Velocity", "trash_can", 336.5, -176.5, -45 },
	{ "Velocity", "trash_can", 179.5, -252.5, 90 },
	{ "Velocity", "trash_can", 341.5, -194.5, 150 },
	{ "Velocity", "trash_can", 330.5, -192.5, -105 },
	{ "Velocity", "trash_can", 208.5, -316.5, 15 },
	{ "Velocity", "trash_can", 282.5, -5.5, 180 },
	{ "Velocity", "trash_can", 233.5, 21.5, 30 },
	-- Family
	{ "Family", "lighthouse", 192.5, 84.5, 0 },
	{ "Family", "gazebo", 283.5, -28.5, 0 },
	{ "Family", "rowboat", 240.5, 103.5, 0 },
	{ "Family", "rowboat", 217.5, 110.5, 0 },
	{ "Family", "rowboat", 214.5, 122.5, 0 },
	{ "Family", "rowboat", 215.5, 135.5, 0 },
	{ "Family", "rowboat", 249.5, 131.5, -105 },
	{ "Family", "picnic", 72.5, -49.5, 15 },
	{ "Family", "picnic", 72.5, 192.5, 60 },
	{ "Family", "picnic", 310.5, 196.5, 90 },
	{ "Family", "picnic", 136.5, 71.5, 0 },
	{ "Family", "picnic", 286.5, 71.5, 0 },
	{ "Family", "beach_umbrella", 287.5, 101.5, -90 },
	{ "Family", "beach_umbrella", 198.5, 70.5, 0 },
	{ "Family", "beach_umbrella", 145.5, 33.5, 180 },
	{ "Family", "beach_umbrella", 287.5, 202.5, -90 },
	{ "Family", "balloon_cart", 335.5, 175.5, -90 },
	{ "Family", "balloon_cart", 286.5, 164.5, -90 },
	{ "Family", "duck_statue", 260.5, -5.5, 180 },
	{ "Family", "duck_statue", 191.5, -52.5, 0 },
	{ "Family", "duck_statue", 90.5, 140.5, -90 },
	{ "Family", "duck_statue", 333.5, -8.5, -150 },
	{ "Family", "flower_bed", 329.5, 93.5, 180 },
	{ "Family", "flower_bed", 182.5, 71.5, 0 },
	{ "Family", "flower_bed", 130.5, 85.5, 90 },
	{ "Family", "flower_bed", 270.5, 70.5, 0 },
	{ "Family", "trash_can", 71.5, 222.5, 90 },
	{ "Family", "trash_can", 334.5, 136.5, 0 },
	{ "Family", "trash_can", 348.5, 20.5, 30 },
	{ "Family", "trash_can", 205.5, 34.5, 180 },
	{ "Family", "trash_can", 212.5, -11.5, 105 },
	{ "Family", "trash_can", 165.5, 70.5, 0 },
	{ "Family", "trash_can", 359.5, 87.5, 90 },
	{ "Family", "trash_can", 266.5, 193.5, 180 },
} :: { { any } }

-- Builds everything; returns the props' footprints {x, z, radius}.
function Theming.build(parent: Instance): { { number } }
	local f = Kit.folder("Theming", parent)
	local rng = Random.new(2026)
	local footprints = {}
	for _, p in Theming.PROPS do
		local land = Config.landById(p[1] :: string)
		local builder = BUILDERS[p[2] :: string]
		if land and builder then
			local y = if p[2] == "rowboat" then 0 else 0.25
			local cf = CFrame.new(p[3] :: number, y, p[4] :: number) * CFrame.Angles(0, math.rad(p[5] :: number), 0)
			local holder = Kit.folder(p[2] :: string, f)
			builder(holder, cf, land.color, rng)
			table.insert(footprints, { p[3] :: number, p[4] :: number, (Theming.RADIUS[p[2] :: string] or 2) + 1 })
		end
	end
	mainStreetLights(Kit.folder("MainStreetLights", f))
	backwoodsLights(Kit.folder("BackwoodsLights", f))
	walkOfFame(Kit.folder("WalkOfFame", f))
	redCarpet(Kit.folder("RedCarpet", f))
	return footprints
end

return Theming
