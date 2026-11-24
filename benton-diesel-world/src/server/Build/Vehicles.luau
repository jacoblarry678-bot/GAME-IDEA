-- Ride vehicles. Each car is a Model whose PrimaryPart ("Base") sits
-- exactly at the car's motion CFrame, so clients can animate it with
-- Model:PivotTo(pose). Vehicle parts never collide with players.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local RideMotion = require(Shared.RideMotion)
local Kit = require(script.Parent.Kit)

local M = Enum.Material
local HALF_PI = math.pi / 2

local Vehicles = {}

type Ride = Config.Ride

local DARK = Color3.fromRGB(30, 30, 34)
local SEAT_BLACK = Color3.fromRGB(36, 36, 40)

-- Part helpers in car space (cf = car origin).
local function blk(model: Model, cf: CFrame, size: Vector3, offset: CFrame, color: Color3, material: Enum.Material?): Part
	return Kit.block(model, size, cf * offset, color, material)
end

local function wheel(model: Model, cf: CFrame, offset: Vector3, diameter: number, width: number, color: Color3?): Part
	return Kit.cyl(model, width, diameter, cf * CFrame.new(offset), color or DARK, M.SmoothPlastic)
end

-- Lap bars and harnesses are named so the clients can raise and lower them
-- (they are built closed, over the rider).
local function restraint(p: Part): Part
	p.Name = "Restraint"
	return p
end

local function seatPieces(model: Model, cf: CFrame, seat: CFrame, cushion: Color3, bar: Color3?)
	-- seat CFrame is the rider's root; cushion sits under it
	blk(model, cf, Vector3.new(1.9, 0.5, 1.7), seat * CFrame.new(0, -1.55, 0.1), cushion, M.Fabric)
	blk(model, cf, Vector3.new(1.9, 2.1, 0.45), seat * CFrame.new(0, -0.55, 1.0), cushion, M.Fabric)
	if bar then
		restraint(blk(model, cf, Vector3.new(1.7, 0.3, 0.3), seat * CFrame.new(0, -0.6, -0.85), bar, M.Metal))
	end
end

local function coasterCar(model: Model, ride: Ride, cf: CFrame, index: number, seats: { CFrame })
	local body, seatColor, accent = ride.colors[1], ride.colors[2] or SEAT_BLACK, ride.colors[3] or Color3.new(1, 1, 1)
	local mine = ride.carStyle == "mine"
	blk(model, cf, Vector3.new(4.9, 0.6, 6.6), CFrame.new(0, 0.85, 0), DARK, M.Metal)
	for _, sx in { -1, 1 } do
		blk(model, cf, Vector3.new(0.4, 1.7, 6.6), CFrame.new(sx * 2.55, 1.85, 0), body, if mine then M.WoodPlanks else M.SmoothPlastic)
		blk(model, cf, Vector3.new(0.45, 0.3, 6.62), CFrame.new(sx * 2.55, 2.75, 0), accent, M.Metal)
		for _, sz in { -2.3, 2.3 } do
			wheel(model, cf, Vector3.new(sx * 1.6, 0.25, sz), 0.9, 0.5)
		end
	end
	blk(model, cf, Vector3.new(5.5, 1.7, 0.4), CFrame.new(0, 1.85, -3.2), body, if mine then M.WoodPlanks else M.SmoothPlastic)
	if index == 1 then
		local nose = Kit.wedge(model, Vector3.new(5.4, 1.8, 2.6), cf * CFrame.new(0, 1.8, -4.6), body, M.SmoothPlastic)
		nose.Name = "Nose"
		local lamp = blk(model, cf, Vector3.new(3, 0.5, 0.2), CFrame.new(0, 1.4, -5.95), Color3.fromRGB(255, 240, 200), M.Neon)
		lamp.Name = "Headlamp"
		if mine then
			-- Old Rusty's tow hook and beacon
			blk(model, cf, Vector3.new(0.4, 3, 0.4), CFrame.new(0, 3.4, -4.6) * CFrame.Angles(math.rad(-30), 0, 0), Color3.fromRGB(90, 70, 50), M.Metal)
			Kit.ball(model, 0.9, (cf * CFrame.new(0, 3.2, -2.8)).Position, Color3.fromRGB(255, 160, 30), M.Neon)
		end
	end
	for _, seat in seats do
		seatPieces(model, cf, seat, seatColor, accent)
	end
end

local function logBoat(model: Model, ride: Ride, cf: CFrame, seats: { CFrame })
	local bark, inner = ride.colors[1], ride.colors[2] or Color3.fromRGB(90, 62, 40)
	Kit.cyl(model, 10, 3.6, cf * CFrame.new(0, 0.9, 0) * CFrame.Angles(0, HALF_PI, 0), bark, M.Wood)
	blk(model, cf, Vector3.new(2.4, 0.4, 9.2), CFrame.new(0, 2.4, 0), inner, M.WoodPlanks)
	for _, sx in { -1, 1 } do
		blk(model, cf, Vector3.new(0.5, 1.2, 10), CFrame.new(sx * 1.5, 2.6, 0), bark, M.Wood)
	end
	Kit.wedge(model, Vector3.new(3, 1.2, 2), cf * CFrame.new(0, 2.6, -5.4), bark, M.Wood)
	for _, seat in seats do
		blk(model, cf, Vector3.new(2.2, 0.4, 0.4), seat * CFrame.new(0, -1.2, 0.9), inner, M.Wood)
	end
end

local function locomotive(model: Model, ride: Ride, cf: CFrame)
	local green, red, gold = ride.colors[1], ride.colors[2] or Color3.fromRGB(200, 40, 40), ride.colors[3] or Color3.fromRGB(240, 196, 64)
	blk(model, cf, Vector3.new(4.6, 0.8, 11), CFrame.new(0, 0.8, 0), DARK, M.Metal)
	Kit.cyl(model, 7.5, 3.8, cf * CFrame.new(0, 3.3, -1.2) * CFrame.Angles(0, HALF_PI, 0), green, M.Metal)
	Kit.cyl(model, 0.4, 4.0, cf * CFrame.new(0, 3.3, -3) * CFrame.Angles(0, HALF_PI, 0), gold, M.Metal)
	Kit.cyl(model, 0.4, 4.0, cf * CFrame.new(0, 3.3, 0.6) * CFrame.Angles(0, HALF_PI, 0), gold, M.Metal)
	blk(model, cf, Vector3.new(4.8, 5.2, 3.6), CFrame.new(0, 3.9, 3.6), red, M.SmoothPlastic)
	blk(model, cf, Vector3.new(5.4, 0.5, 4.4), CFrame.new(0, 6.7, 3.6), DARK, M.Metal)
	for _, sx in { -1, 1 } do
		local w = blk(model, cf, Vector3.new(0.2, 1.6, 2.2), CFrame.new(sx * 2.45, 4.8, 3.6), Color3.fromRGB(150, 200, 230), M.Glass)
		w.Transparency = 0.3
	end
	-- smokestack with a smoke emitter
	local stack = Kit.cyl(model, 2.6, 1.3, cf * CFrame.new(0, 6.2, -3.6) * CFrame.Angles(0, 0, HALF_PI), DARK, M.Metal)
	Kit.cyl(model, 0.6, 2.0, cf * CFrame.new(0, 7.6, -3.6) * CFrame.Angles(0, 0, HALF_PI), DARK, M.Metal)
	local smoke = Instance.new("Smoke")
	smoke.Color = Color3.fromRGB(220, 220, 220)
	smoke.Opacity = 0.15
	smoke.RiseVelocity = 6
	smoke.Size = 1.5
	smoke.Parent = stack
	Kit.ball(model, 1.6, (cf * CFrame.new(0, 5.4, -0.6)).Position, gold, M.Metal)
	local lamp = blk(model, cf, Vector3.new(1.2, 1.2, 0.4), CFrame.new(0, 4.4, -5.1), Color3.fromRGB(255, 240, 200), M.Neon)
	Kit.light(lamp, Color3.fromRGB(255, 230, 180), 18, 1)
	Kit.wedge(model, Vector3.new(4.4, 1.6, 2), cf * CFrame.new(0, 1.2, -6.2), red, M.Metal)
	for _, sx in { -1, 1 } do
		for _, sz in { -3.4, -0.6, 2.6 } do
			local d = if sz > 0 then 2.6 else 2.0
			wheel(model, cf, Vector3.new(sx * 2.1, d / 2 - 0.4, sz), d, 0.5, red)
		end
	end
	Kit.sign(model, "BENTON", Vector3.new(0.2, 1.2, 3.4), cf * CFrame.new(-2.5, 4.8, 3.6) * CFrame.Angles(0, HALF_PI, 0), { transparentBg = true, fg = gold, font = Enum.Font.GothamBlack })
end

local function coach(model: Model, ride: Ride, cf: CFrame, seats: { CFrame })
	local green, red, gold = ride.colors[1], ride.colors[2] or Color3.fromRGB(200, 40, 40), ride.colors[3] or Color3.fromRGB(240, 196, 64)
	blk(model, cf, Vector3.new(5, 0.6, 10.5), CFrame.new(0, 1.8, 0), green, M.WoodPlanks)
	blk(model, cf, Vector3.new(4.4, 0.6, 10), CFrame.new(0, 1.2, 0), DARK, M.Metal)
	for _, sx in { -1, 1 } do
		blk(model, cf, Vector3.new(0.3, 1.4, 10.5), CFrame.new(sx * 2.5, 2.8, 0), red, M.Wood)
		for _, sz in { -4.9, 4.9 } do
			blk(model, cf, Vector3.new(0.3, 5, 0.3), CFrame.new(sx * 2.4, 4.6, sz), gold, M.Metal)
			wheel(model, cf, Vector3.new(sx * 2.0, 0.6, sz * 0.75), 1.6, 0.4)
		end
	end
	blk(model, cf, Vector3.new(5.6, 0.4, 11.2), CFrame.new(0, 7.2, 0), red, M.SmoothPlastic)
	blk(model, cf, Vector3.new(5.0, 0.3, 10.6), CFrame.new(0, 7.5, 0), Color3.fromRGB(250, 243, 224), M.SmoothPlastic)
	for _, seat in seats do
		seatPieces(model, cf, seat, Color3.fromRGB(150, 100, 60), nil)
	end
end

local function tramCar(model: Model, ride: Ride, cf: CFrame, index: number, seats: { CFrame })
	local cream, purple, gold = ride.colors[1], ride.colors[2] or Color3.fromRGB(150, 110, 200), ride.colors[3] or Color3.fromRGB(240, 196, 64)
	blk(model, cf, Vector3.new(5.4, 0.8, 11.6), CFrame.new(0, 1.6, 0), purple, M.SmoothPlastic)
	for _, sx in { -1, 1 } do
		blk(model, cf, Vector3.new(0.3, 1.2, 11.6), CFrame.new(sx * 2.7, 2.6, 0), cream, M.SmoothPlastic)
		for _, sz in { -5.4, 5.4 } do
			blk(model, cf, Vector3.new(0.3, 4.6, 0.3), CFrame.new(sx * 2.6, 4.3, sz), gold, M.Metal)
		end
		for _, sz in { -3.8, 3.8 } do
			wheel(model, cf, Vector3.new(sx * 2.4, 0.9, sz), 1.8, 0.7)
		end
	end
	blk(model, cf, Vector3.new(6, 0.4, 12.2), CFrame.new(0, 6.6, 0), purple, M.SmoothPlastic)
	for i = -5, 5, 2 do
		blk(model, cf, Vector3.new(6.02, 0.42, 1), CFrame.new(0, 6.6, i), cream, M.SmoothPlastic)
	end
	if index == 1 then
		blk(model, cf, Vector3.new(5.4, 3.4, 2.6), CFrame.new(0, 3.6, -7.2), cream, M.SmoothPlastic)
		local glass = blk(model, cf, Vector3.new(4.6, 1.6, 0.2), CFrame.new(0, 4.6, -8.5), Color3.fromRGB(150, 200, 230), M.Glass)
		glass.Transparency = 0.3
		Kit.sign(model, "STUDIO TOURS", Vector3.new(5, 0.9, 0.2), cf * CFrame.new(0, 6.0, -8.55), { bg = purple, fg = gold, font = Enum.Font.GothamBlack })
	end
	for _, seat in seats do
		seatPieces(model, cf, seat, purple, nil)
	end
end

local function bigRig(model: Model, ride: Ride, cf: CFrame, index: number, seats: { CFrame })
	local palette = ride.colors
	local color = palette[(index - 1) % #palette + 1]
	-- open-top cab so riders are visible
	blk(model, cf, Vector3.new(3.8, 0.6, 8.8), CFrame.new(0, 0.9, 0.6), DARK, M.Metal)
	blk(model, cf, Vector3.new(3.8, 1.6, 2.2), CFrame.new(0, 1.8, -3.4), color, M.SmoothPlastic)
	local grille = blk(model, cf, Vector3.new(2.6, 1.0, 0.2), CFrame.new(0, 1.9, -4.55), Color3.fromRGB(200, 200, 205), M.Metal)
	grille.Name = "Grille"
	for _, sx in { -1, 1 } do
		blk(model, cf, Vector3.new(0.3, 1.8, 3.2), CFrame.new(sx * 1.75, 2.1, -1.4), color, M.SmoothPlastic)
		Kit.ball(model, 0.5, (cf * CFrame.new(sx * 1.2, 2.1, -4.6)).Position, Color3.fromRGB(255, 240, 200), M.Neon)
		local stack = Kit.cyl(model, 3.4, 0.4, cf * CFrame.new(sx * 1.95, 3.4, 0.2) * CFrame.Angles(0, 0, HALF_PI), Color3.fromRGB(200, 200, 205), M.Metal)
		stack.Name = "Stack"
		for _, sz in { -3.2, 1.2, 3.8 } do
			wheel(model, cf, Vector3.new(sx * 1.7, 0.7, sz), 1.5, 0.6)
		end
	end
	blk(model, cf, Vector3.new(3.8, 1.4, 0.3), CFrame.new(0, 2.0, 0.3), color, M.SmoothPlastic)
	-- little trailer
	blk(model, cf, Vector3.new(3.6, 2.2, 4.4), CFrame.new(0, 2.3, 3.2), Color3.fromRGB(240, 240, 236), M.SmoothPlastic)
	Kit.sign(model, "LITTLE HAULERS", Vector3.new(0.2, 1.2, 4.2), cf * CFrame.new(-1.82, 2.4, 3.2) * CFrame.Angles(0, HALF_PI, 0), { transparentBg = true, fg = color, font = Enum.Font.GothamBlack })
	for _, seat in seats do
		seatPieces(model, cf, seat, SEAT_BLACK, nil)
	end
end

local function kart(model: Model, ride: Ride, cf: CFrame, index: number, seats: { CFrame })
	local color = ride.colors[(index - 1) % #ride.colors + 1]
	blk(model, cf, Vector3.new(3.4, 0.5, 5.4), CFrame.new(0, 0.7, 0), color, M.SmoothPlastic)
	Kit.wedge(model, Vector3.new(3.0, 0.8, 1.6), cf * CFrame.new(0, 1.2, -2.4), color, M.SmoothPlastic)
	blk(model, cf, Vector3.new(4.4, 0.4, 0.6), CFrame.new(0, 0.9, -2.9), DARK, M.Rubber)
	blk(model, cf, Vector3.new(4.4, 0.6, 0.5), CFrame.new(0, 1.1, 2.7), DARK, M.Rubber)
	for _, sx in { -1, 1 } do
		for _, sz in { -1.8, 1.8 } do
			wheel(model, cf, Vector3.new(sx * 1.85, 0.6, sz), 1.2, 0.7)
		end
	end
	Kit.cyl(model, 0.2, 1.1, cf * CFrame.new(0, 1.8, -0.9) * CFrame.Angles(math.rad(60), 0, 0) * CFrame.Angles(0, 0, HALF_PI), DARK, M.SmoothPlastic)
	Kit.sign(model, tostring(index), Vector3.new(1.2, 1.0, 0.2), cf * CFrame.new(0, 1.3, -3.2), { bg = Color3.new(1, 1, 1), fg = DARK, font = Enum.Font.GothamBlack })
	for _, seat in seats do
		seatPieces(model, cf, seat, SEAT_BLACK, nil)
	end
end

local function dropRing(model: Model, ride: Ride, cf: CFrame, seats: { CFrame })
	local blue, dark, orange = ride.colors[1], ride.colors[2] or DARK, ride.colors[3] or Color3.fromRGB(255, 140, 26)
	-- ring frame around the tower
	for k = 0, 11 do
		local a = k * math.pi / 6
		local seg = cf * CFrame.Angles(0, a, 0) * CFrame.new(0, 0.6, -6.2)
		Kit.block(model, Vector3.new(3.4, 1.2, 1.4), seg, dark, M.Metal)
		Kit.block(model, Vector3.new(3.4, 0.4, 1.5), seg * CFrame.new(0, 0.8, 0), orange, M.Neon)
	end
	for _, seat in seats do
		blk(model, cf, Vector3.new(1.9, 0.5, 1.7), seat * CFrame.new(0, -1.55, 0.1), blue, M.SmoothPlastic)
		blk(model, cf, Vector3.new(1.9, 3.2, 0.5), seat * CFrame.new(0, -0.1, 1.0), blue, M.SmoothPlastic)
		restraint(blk(model, cf, Vector3.new(1.6, 1.6, 0.4), seat * CFrame.new(0, 0.2, -0.6), Color3.fromRGB(220, 220, 225), M.Metal))
	end
end

local function horse(model: Model, ride: Ride, cf: CFrame, index: number, seats: { CFrame })
	local coats = { Color3.fromRGB(250, 248, 240), Color3.fromRGB(140, 90, 50), Color3.fromRGB(60, 40, 30), Color3.fromRGB(220, 180, 120) }
	local coat = coats[(index - 1) % #coats + 1]
	local saddle = ride.colors[(index - 1) % #ride.colors + 1]
	Kit.ellipsoid(model, Vector3.new(1.8, 1.9, 4.2), cf * CFrame.new(0, 0, 0), coat, M.SmoothPlastic)
	Kit.block(model, Vector3.new(1.2, 2.4, 1.2), cf * CFrame.new(0, 1.4, -1.9) * CFrame.Angles(math.rad(25), 0, 0), coat, M.SmoothPlastic)
	Kit.block(model, Vector3.new(1.0, 1.0, 2.0), cf * CFrame.new(0, 2.5, -2.7), coat, M.SmoothPlastic)
	Kit.block(model, Vector3.new(0.4, 1.4, 1.6), cf * CFrame.new(0, 2.6, -1.8), Color3.fromRGB(240, 196, 64), M.SmoothPlastic)
	for _, sx in { -0.55, 0.55 } do
		for _, sz in { -1.4, 1.4 } do
			Kit.block(model, Vector3.new(0.5, 2.4, 0.5), cf * CFrame.new(sx, -1.6, sz) * CFrame.Angles(math.rad(if sz < 0 then -25 else 25), 0, 0), coat, M.SmoothPlastic)
		end
	end
	Kit.block(model, Vector3.new(1.9, 0.5, 1.6), cf * CFrame.new(0, 0.95, 0.3), saddle, M.Fabric)
	Kit.cyl(model, 0.8, 0.5, cf * CFrame.new(0, 0, 2.2) * CFrame.Angles(0, HALF_PI, 0) * CFrame.Angles(0, 0, 0), Color3.fromRGB(240, 196, 64), M.Metal)
	local _ = seats
end

local function pistonCup(model: Model, ride: Ride, cf: CFrame, index: number, seats: { CFrame })
	local color = ride.colors[(index - 1) % #ride.colors + 1]
	Kit.cyl(model, 3.2, 7.2, cf * CFrame.new(0, 1.6, 0) * CFrame.Angles(0, 0, HALF_PI), color, M.SmoothPlastic)
	Kit.cyl(model, 0.5, 7.6, cf * CFrame.new(0, 3.3, 0) * CFrame.Angles(0, 0, HALF_PI), Color3.fromRGB(220, 220, 225), M.Metal)
	Kit.cyl(model, 1.8, 1.6, cf * CFrame.new(0, 3.6, 0) * CFrame.Angles(0, 0, HALF_PI), Color3.fromRGB(200, 200, 205), M.Metal)
	Kit.cyl(model, 0.5, 2.6, cf * CFrame.new(0, 4.6, 0) * CFrame.Angles(0, 0, HALF_PI), DARK, M.Metal)
	for _, seat in seats do
		blk(model, cf, Vector3.new(1.8, 1.8, 0.4), seat * CFrame.new(0, -0.7, 0.9), Color3.fromRGB(250, 243, 224), M.Fabric)
		restraint(blk(model, cf, Vector3.new(1.7, 0.3, 0.3), seat * CFrame.new(0, -0.6, -0.85), Color3.fromRGB(220, 220, 225), M.Metal))
	end
end

local function gondola(model: Model, ride: Ride, cf: CFrame, seats: { CFrame })
	local orange, dark, gold = ride.colors[1], ride.colors[2] or DARK, ride.colors[3] or Color3.fromRGB(240, 196, 64)
	Kit.cyl(model, 1.2, 12, cf * CFrame.new(0, -0.2, 0) * CFrame.Angles(0, 0, HALF_PI), dark, M.Metal)
	Kit.cyl(model, 0.4, 12.4, cf * CFrame.new(0, 0.5, 0) * CFrame.Angles(0, 0, HALF_PI), gold, M.Neon)
	Kit.cyl(model, 3.0, 4, cf * CFrame.new(0, 1.6, 0) * CFrame.Angles(0, 0, HALF_PI), orange, M.Metal)
	for _, seat in seats do
		blk(model, cf, Vector3.new(1.9, 0.5, 1.7), seat * CFrame.new(0, -1.55, 0.1), orange, M.SmoothPlastic)
		blk(model, cf, Vector3.new(1.9, 3.0, 0.5), seat * CFrame.new(0, -0.2, 1.0), orange, M.SmoothPlastic)
		restraint(blk(model, cf, Vector3.new(1.6, 1.4, 0.4), seat * CFrame.new(0, 0.2, -0.6), Color3.fromRGB(220, 220, 225), M.Metal))
	end
end

-- Build car `index` of a ride at pose `cf`.
function Vehicles.build(ride: Ride, motion: RideMotion.Motion, index: number, cf: CFrame, parent: Instance): Model
	local model = Instance.new("Model")
	model.Name = "Car" .. index
	local base = Kit.block(model, Vector3.new(0.4, 0.4, 0.4), cf, Color3.new(1, 1, 1), M.SmoothPlastic)
	base.Name = "Base"
	base.Transparency = 1
	model.PrimaryPart = base
	-- seat CFrames in car space (the builders below apply `cf`)
	local seats = motion.seats[index]
	local style = ride.carStyle
	if ride.kind == "coaster" then
		coasterCar(model, ride, cf, index, seats)
	elseif ride.kind == "flume" then
		logBoat(model, ride, cf, seats)
	elseif ride.kind == "train" then
		if index == 1 and ride.firstCarSeats == 0 then
			locomotive(model, ride, cf)
		else
			coach(model, ride, cf, seats)
		end
	elseif ride.kind == "tram" then
		tramCar(model, ride, cf, index, seats)
	elseif ride.kind == "trucks" then
		bigRig(model, ride, cf, index, seats)
	elseif ride.kind == "karts" then
		kart(model, ride, cf, index, seats)
	elseif ride.kind == "droptower" then
		dropRing(model, ride, cf, seats)
	elseif ride.kind == "carousel" then
		horse(model, ride, cf, index, seats)
	elseif ride.kind == "spinner" then
		pistonCup(model, ride, cf, index, seats)
	elseif ride.kind == "pendulum" then
		gondola(model, ride, cf, seats)
	end
	local _ = style
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			local p = d :: BasePart
			p.CanCollide = false
			p.CanTouch = false
			p.Anchored = true
		end
	end
	model.Parent = parent
	return model
end

return Vehicles
