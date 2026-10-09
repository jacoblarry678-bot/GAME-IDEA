-- Builds every ride: track or structure, vehicles, station, and the queue
-- entrance with its live wait-time sign and prompts.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local RideMotion = require(Shared.RideMotion)
local Track = require(Shared.Track)
local Staff = require(Shared.Staff)
local QueueLine = require(Shared.QueueLine)
local Kit = require(script.Parent.Kit)
local Vehicles = require(script.Parent.Vehicles)

local M = Enum.Material
local C = Config.Colors
local HALF_PI = math.pi / 2

local RideBuilder = {}

type Ride = Config.Ride

export type RideInfo = {
	ride: Ride,
	model: Model,
	motion: RideMotion.Motion,
	nameLabel: TextLabel,
	waitLabel: TextLabel,
	statusLabel: TextLabel,
	joinPrompt: ProximityPrompt,
	expressPrompt: ProximityPrompt,
}

local function flat(v: Vector3): Vector3
	local f = Vector3.new(v.X, 0, v.Z)
	if f.Magnitude < 1e-3 then
		return Vector3.new(0, 0, 1)
	end
	return f.Unit
end

-- Oriented block spanning a -> b using the track frame `frame` for roll.
local function strip(parent: Instance, a: Vector3, b: Vector3, frame: CFrame, width: number, height: number, color: Color3, material: Enum.Material): Part
	local len = (b - a).Magnitude
	local mid = (a + b) / 2
	local fwd = (b - a).Unit
	local up = frame.UpVector
	local right = fwd:Cross(up)
	if right.Magnitude < 1e-3 then
		right = frame.RightVector
	end
	right = right.Unit
	up = right:Cross(fwd).Unit
	local part = Kit.block(parent, Vector3.new(width, height, len + 0.15), CFrame.fromMatrix(mid, right, up), color, material)
	return part
end

---------------------------------------------------------------------------
-- Tracks
---------------------------------------------------------------------------
local function steelTrack(parent: Instance, ride: Ride, sampler: Track.Sampler, wooden: boolean)
	local railColor = ride.colors[1]
	local supportColor = if wooden then Color3.fromRGB(120, 84, 52) else Color3.fromRGB(200, 204, 210)
	local L = sampler.length
	local step = 3
	local n = math.ceil(L / step)
	local f = Kit.folder("Track", parent)
	f:SetAttribute("Style", if wooden then "wood" else "steel")
	f:SetAttribute("Color", railColor)
	local supports = Kit.folder("Supports", parent)
	for i = 0, n - 1 do
		local s0 = i * step
		local s1 = math.min((i + 1) * step, L)
		local cf0 = sampler:cframeAt(s0)
		local cf1 = sampler:cframeAt(s1)
		local cfm = sampler:cframeAt((s0 + s1) / 2)
		for _, sx in { -1.6, 1.6 } do
			local a = (cf0 * CFrame.new(sx, -0.25, 0)).Position
			local b = (cf1 * CFrame.new(sx, -0.25, 0)).Position
			if wooden then
				strip(f, a, b, cfm, 0.5, 0.35, Color3.fromRGB(90, 90, 96), M.Metal)
			else
				local rail = Kit.beam(f, a, b, 0.7, railColor, M.Metal, true)
				rail.Size += Vector3.new(0.3, 0, 0)
			end
		end
		if wooden then
			Kit.block(f, Vector3.new(4.4, 0.45, 1.1), cf0 * CFrame.new(0, -0.7, 0), Color3.fromRGB(120, 84, 52), M.Wood)
		else
			local a = (cf0 * CFrame.new(0, -1.35, 0)).Position
			local b = (cf1 * CFrame.new(0, -1.35, 0)).Position
			strip(f, a, b, cfm, 1.1, 1.1, railColor, M.Metal)
			if i % 2 == 0 then
				Kit.block(f, Vector3.new(3.8, 0.35, 0.5), cf0 * CFrame.new(0, -0.75, 0), railColor, M.Metal)
			end
		end
		-- supports where the track is upright and off the ground
		local every = if wooden then 4 else 5
		if i % every == 0 and cf0.UpVector.Y > 0.7 then
			local top = (cf0 * CFrame.new(0, -1.9, 0)).Position
			if top.Y > 3 then
				if wooden then
					for _, sx in { -2.2, 2.2 } do
						local p = (cf0 * CFrame.new(sx, -1.0, 0)).Position
						Kit.box(supports, Vector3.new(0.9, p.Y, 0.9), Vector3.new(p.X, 0, p.Z), supportColor, M.Wood)
					end
					if top.Y > 8 then
						local l = (cf0 * CFrame.new(-2.2, -1.0, 0)).Position
						local r = (cf0 * CFrame.new(2.2, -1.0, 0)).Position
						Kit.beam(supports, Vector3.new(l.X, 1, l.Z), Vector3.new(r.X, r.Y - 1, r.Z), 0.5, supportColor, M.Wood)
						Kit.beam(supports, Vector3.new(r.X, 1, r.Z), Vector3.new(l.X, l.Y - 1, l.Z), 0.5, supportColor, M.Wood)
					end
				else
					Kit.post(supports, top.Y, 1.4, Vector3.new(top.X, 0, top.Z), supportColor, M.Metal)
					Kit.box(supports, Vector3.new(3, 1, 3), Vector3.new(top.X, 0, top.Z), C.Concrete, M.Concrete)
				end
			end
		end
	end
end

local function flumeTrack(parent: Instance, ride: Ride, sampler: Track.Sampler)
	local wood = Color3.fromRGB(120, 84, 52)
	local water = Color3.fromRGB(60, 140, 200)
	local L = sampler.length
	local step = 3
	local n = math.ceil(L / step)
	local f = Kit.folder("Channel", parent)
	f:SetAttribute("Style", "flume")
	local supports = Kit.folder("Supports", parent)
	local highest, highestS = -math.huge, 0
	for i = 0, n - 1 do
		local s0 = i * step
		local s1 = math.min((i + 1) * step, L)
		local cf0 = sampler:cframeAt(s0)
		local cf1 = sampler:cframeAt(s1)
		local cfm = sampler:cframeAt((s0 + s1) / 2)
		if cf0.Y > highest then
			highest, highestS = cf0.Y, s0
		end
		strip(f, (cf0 * CFrame.new(0, -1.3, 0)).Position, (cf1 * CFrame.new(0, -1.3, 0)).Position, cfm, 6.6, 0.6, wood, M.WoodPlanks)
		for _, sx in { -3.3, 3.3 } do
			strip(f, (cf0 * CFrame.new(sx, 0.2, 0)).Position, (cf1 * CFrame.new(sx, 0.2, 0)).Position, cfm, 0.6, 3.2, wood, M.WoodPlanks)
		end
		local w = strip(f, (cf0 * CFrame.new(0, 0.3, 0)).Position, (cf1 * CFrame.new(0, 0.3, 0)).Position, cfm, 6, 0.4, water, M.Glass)
		w.Transparency = 0.35
		w.CanCollide = false
		if i % 4 == 0 and cf0.Y > 5 then
			for _, sx in { -3.6, 3.6 } do
				local p = (cf0 * CFrame.new(sx, -1.6, 0)).Position
				Kit.box(supports, Vector3.new(1, p.Y, 1), Vector3.new(p.X, 0, p.Z), wood, M.Wood)
			end
		end
	end
	-- splashdown: first low point after the summit
	local s = highestS
	while s < L do
		local cf = sampler:cframeAt(s)
		if cf.Y < 4 then
			break
		end
		s += 1
	end
	local splashAt = sampler:cframeAt(s + 2).Position
	local splash = Kit.block(f, Vector3.new(4, 1, 4), CFrame.new(splashAt + Vector3.new(0, 1, 0)), water, M.Glass)
	splash.Name = "Splash"
	splash.Transparency = 1
	splash.CanCollide = false
	local mist = Instance.new("ParticleEmitter")
	mist.Texture = "rbxasset://textures/particles/smoke_main.dds"
	mist.Color = ColorSequence.new(Color3.fromRGB(230, 245, 255))
	mist.Transparency = NumberSequence.new(0.6, 1)
	mist.Size = NumberSequence.new(3, 8)
	mist.Lifetime = NumberRange.new(1.5, 2.5)
	mist.Speed = NumberRange.new(2, 5)
	mist.Rate = 6
	mist.Parent = splash
	splash:SetAttribute("Effect", "Splash")
end

local function groundStrip(parent: Instance, sampler: Track.Sampler, width: number, color: Color3, material: Enum.Material, drop: number, dash: Color3?, curbs: boolean?)
	local L = sampler.length
	local step = 4
	local n = math.ceil(L / step)
	local f = Kit.folder("Road", parent)
	f:SetAttribute("Style", "road")
	f:SetAttribute("Width", width)
	f:SetAttribute("Drop", drop)
	f:SetAttribute("Color", color)
	if dash then
		f:SetAttribute("Dash", dash)
	end
	f:SetAttribute("Curbs", curbs == true)
	for i = 0, n - 1 do
		local s0 = i * step
		local s1 = math.min((i + 1) * step, L)
		local cf0 = sampler:cframeAt(s0)
		local cf1 = sampler:cframeAt(s1)
		local a = cf0.Position - Vector3.new(0, drop, 0)
		local b = cf1.Position - Vector3.new(0, drop, 0)
		local flatFrame = CFrame.new(cf0.Position)
		local road = strip(f, a, b, flatFrame, width, 1, color, material)
		road.CastShadow = false
		if dash and i % 2 == 0 then
			local d = strip(f, a + Vector3.new(0, 0.52, 0), b + Vector3.new(0, 0.52, 0), flatFrame, 0.4, 0.05, dash, M.SmoothPlastic)
			d.Size = Vector3.new(d.Size.X, d.Size.Y, d.Size.Z * 0.5)
			d.CastShadow = false
		end
		if curbs then
			local right = (b - a).Unit:Cross(Vector3.yAxis).Unit
			for _, sx in { -1, 1 } do
				local off = right * (sx * (width / 2 + 0.6))
				local c = strip(f, a + off + Vector3.new(0, 0.25, 0), b + off + Vector3.new(0, 0.25, 0), flatFrame, 1.2, 1, if i % 2 == 0 then C.Red else Color3.new(1, 1, 1), M.SmoothPlastic)
				c.CastShadow = false
			end
		end
	end
end

local function railTrack(parent: Instance, sampler: Track.Sampler)
	local L = sampler.length
	local step = 3
	local n = math.ceil(L / step)
	local f = Kit.folder("Rails", parent)
	f:SetAttribute("Style", "rails")
	for i = 0, n - 1 do
		local s0 = i * step
		local s1 = math.min((i + 1) * step, L)
		local cf0 = sampler:cframeAt(s0)
		local cf1 = sampler:cframeAt(s1)
		local flatFrame = CFrame.new(cf0.Position)
		local a = cf0.Position
		local b = cf1.Position
		local bed = strip(f, Vector3.new(a.X, -0.1, a.Z), Vector3.new(b.X, -0.1, b.Z), flatFrame, 7, 1, Color3.fromRGB(120, 116, 110), M.Slate)
		bed.CastShadow = false
		Kit.block(f, Vector3.new(6.2, 0.35, 1), cf0 * CFrame.new(0, -1.75, 0), Color3.fromRGB(100, 70, 46), M.Wood)
		for _, sx in { -2, 2 } do
			strip(f, (cf0 * CFrame.new(sx, -1.45, 0)).Position, (cf1 * CFrame.new(sx, -1.45, 0)).Position, cf0, 0.4, 0.45, Color3.fromRGB(110, 110, 116), M.Metal)
		end
	end
end

---------------------------------------------------------------------------
-- Stations and queues
---------------------------------------------------------------------------
local function station(parent: Instance, ride: Ride, motion: RideMotion.Motion, rest: { CFrame })
	local f = Kit.folder("Station", parent)
	local landColor = (Config.landById(ride.land) :: Config.Land).color
	local sf = Staff.stationFrame(ride, rest)
	local frame, length, platformTop, halfGap = sf.frame, sf.length, sf.platformTop, sf.halfGap
	for _, sx in { -1, 1 } do
		Kit.block(f, Vector3.new(4, platformTop, length), frame * CFrame.new(sx * (halfGap + 2), platformTop / 2, 0), C.Concrete, M.Concrete)
		Kit.block(f, Vector3.new(0.5, 0.1, length), frame * CFrame.new(sx * (halfGap + 0.3), platformTop + 0.05, 0), Color3.fromRGB(250, 210, 40), M.SmoothPlastic)
	end
	local roofY = platformTop + 13
	for _, sx in { -1, 1 } do
		for _, sz in { -1, 1 } do
			Kit.block(f, Vector3.new(0.8, roofY - platformTop, 0.8), frame * CFrame.new(sx * (halfGap + 3.2), (roofY + platformTop) / 2, sz * (length / 2 - 1)), C.Navy, M.Metal)
		end
	end
	Kit.block(f, Vector3.new(halfGap * 2 + 10, 1, length + 2), frame * CFrame.new(0, roofY, 0), landColor, M.Metal)
	Kit.block(f, Vector3.new(halfGap * 2 + 10.4, 0.4, length + 2.4), frame * CFrame.new(0, roofY + 0.7, 0), C.Cream, M.SmoothPlastic)
	-- name boards on both long sides of the canopy
	for _, sx in { -1, 1 } do
		local cf = frame * CFrame.new(sx * (halfGap + 5.2), roofY - 1.6, 0) * CFrame.Angles(0, sx * HALF_PI, 0) * CFrame.Angles(0, math.pi, 0)
		Kit.sign(f, ride.name, Vector3.new(math.min(length, 40), 2.6, 0.3), cf, { bg = C.Navy, fg = C.Cream, font = Enum.Font.GothamBlack, glow = true })
	end
	local lamp = Kit.block(f, Vector3.new(2, 0.3, length - 2), frame * CFrame.new(0, roofY - 0.65, 0), Color3.fromRGB(255, 240, 210), M.Neon)
	Kit.light(lamp, Color3.fromRGB(255, 236, 200), 18, 0.8)
	local _ = motion
end

local function stars(n: number): string
	return string.rep("*", n) .. string.rep("-", 5 - n)
end

---------------------------------------------------------------------------
-- Queue line: a railed switchback maze with room for well over an hour of
-- guests, a railed walkway to the entrance sign and a boarding gate
---------------------------------------------------------------------------
local QUEUE_FLOOR = Color3.fromRGB(196, 186, 170)
local QUEUE_TOP = 0.55

-- Posts every few studs and two rails between them, from a to b.
local function railRun(parent: Instance, a: Vector3, b: Vector3, railColor: Color3)
	local len = (b - a).Magnitude
	if len < 0.5 then
		return
	end
	local posts = math.max(1, math.ceil(len / 5))
	local postColor = Color3.fromRGB(70, 74, 84)
	for i = 0, posts do
		local p = a:Lerp(b, i / posts)
		Kit.post(parent, 3.2, 0.4, Vector3.new(p.X, QUEUE_TOP, p.Z), postColor, M.Metal)
	end
	local lift = Vector3.new(0, QUEUE_TOP, 0)
	Kit.beam(parent, a + lift + Vector3.new(0, 3, 0), b + lift + Vector3.new(0, 3, 0), 0.3, railColor, M.Metal, true)
	Kit.beam(parent, a + lift + Vector3.new(0, 1.6, 0), b + lift + Vector3.new(0, 1.6, 0), 0.2, postColor, M.Metal, true)
end

-- Polyline offset sideways by `d` (positive = right of travel), mitred.
local function offsetLine(points: { Vector3 }, d: number): { Vector3 }
	local out = {}
	for i, p in points do
		local prev = points[math.max(1, i - 1)]
		local nxt = points[math.min(#points, i + 1)]
		local dirIn = flat(p - prev)
		local dirOut = flat(nxt - p)
		if i == 1 then
			dirIn = dirOut
		elseif i == #points then
			dirOut = dirIn
		end
		local nIn = Vector3.new(-dirIn.Z, 0, dirIn.X)
		local nOut = Vector3.new(-dirOut.Z, 0, dirOut.X)
		local n = nIn + nOut
		n = if n.Magnitude > 1e-3 then n.Unit else nIn
		local scale = 1 / math.max(0.35, n:Dot(nIn))
		table.insert(out, p + n * d * scale)
	end
	return out
end

local function queueLine(parent: Instance, ride: Ride, land: Config.Land)
	local line = QueueLine.get(ride.id)
	if not line then
		return
	end
	local f = Kit.folder("Line", parent)
	-- floor under the maze
	local floor = Kit.block(f, Vector3.new(line.mazeSize.X + 1.5, 1, line.mazeSize.Z + 1.5), line.mazeCFrame * CFrame.new(0, QUEUE_TOP - 0.5, 0), QUEUE_FLOOR, M.Concrete)
	floor.Name = "QueueFloor"
	floor.CastShadow = false
	-- walkway from the maze to the sign, and out the front of the sign
	local walk = line.walkway
	for i = 2, #walk do
		Kit.path(f, walk[i - 1], walk[i], QueueLine.LANE + 0.5, QUEUE_FLOOR, M.Concrete, QUEUE_TOP)
	end
	Kit.path(f, walk[#walk], line.entrance + line.outward * 3, QueueLine.LANE + 0.5, QUEUE_FLOOR, M.Concrete, QUEUE_TOP)
	-- rails
	for _, w in line.walls do
		railRun(f, w[1], w[2], land.color)
	end
	local half = QueueLine.LANE / 2
	for _, side in { -half, half } do
		local rail = offsetLine(walk, side)
		for i = 2, #rail do
			railRun(f, rail[i - 1], rail[i], land.color)
		end
	end
	-- boarding gate at the front of the line
	local g = line.gate
	local gcf = CFrame.lookAt(Vector3.new(g.X, QUEUE_TOP, g.Z), Vector3.new(g.X, QUEUE_TOP, g.Z) + line.gateDir)
	for _, sx in { -1, 1 } do
		Kit.block(f, Vector3.new(0.8, 8, 0.8), gcf * CFrame.new(sx * (half + 0.4), 4, 0), land.color, M.Metal)
	end
	Kit.block(f, Vector3.new(QueueLine.LANE + 2.4, 1, 1), gcf * CFrame.new(0, 8.4, 0), land.color, M.Metal)
	Kit.sign(f, "BOARDING", Vector3.new(QueueLine.LANE + 1.6, 1.4, 0.3), gcf * CFrame.new(0, 7, 0.1) * CFrame.Angles(0, math.pi, 0), { bg = C.Navy, fg = C.Cream, font = Enum.Font.GothamBlack, both = true })
	-- turnstile arm
	Kit.block(f, Vector3.new(QueueLine.LANE - 0.6, 0.25, 0.25), gcf * CFrame.new(0, 3, -0.6), Color3.fromRGB(220, 220, 225), M.Metal).CanCollide = false
end

local function queueEntrance(parent: Instance, ride: Ride): (TextLabel, TextLabel, TextLabel, ProximityPrompt, ProximityPrompt)
	local f = Kit.folder("Queue", parent)
	local land = Config.landById(ride.land) :: Config.Land
	local facing = flat(ride.entrance - ride.origin)
	local base = Vector3.new(ride.entrance.X, 0.4, ride.entrance.Z)
	local cf = CFrame.lookAt(base, base + facing)
	-- sign on two posts
	for _, sx in { -1, 1 } do
		Kit.block(f, Vector3.new(1, 19, 1), cf * CFrame.new(sx * 8, 9.5, 0), C.Navy, M.Metal)
	end
	local board = Kit.block(f, Vector3.new(16, 10, 0.8), cf * CFrame.new(0, 13, 0), Color3.fromRGB(16, 22, 36), M.SmoothPlastic)
	board.Name = "WaitSign"
	Kit.block(f, Vector3.new(17, 1.2, 1.2), cf * CFrame.new(0, 18.6, 0), land.color, M.SmoothPlastic)
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 30
	gui.LightInfluence = 0
	gui.Brightness = 1.3
	gui.MaxDistance = 400
	gui.Parent = board
	local function text(name: string, y: number, h: number, value: string, color: Color3, font: Enum.Font): TextLabel
		local l = Instance.new("TextLabel")
		l.Name = name
		l.BackgroundTransparency = 1
		l.Position = UDim2.fromScale(0.04, y)
		l.Size = UDim2.fromScale(0.92, h)
		l.Text = value
		l.TextScaled = true
		l.TextColor3 = color
		l.FontFace = Font.fromEnum(font)
		l.Parent = gui
		return l
	end
	local nameLabel = text("RideName", 0.04, 0.24, ride.name, C.Cream, Enum.Font.GothamBlack)
	text("Info", 0.29, 0.1, string.upper(ride.category) .. "  |  THRILL " .. stars(ride.thrill) .. "  |  " .. land.name, land.color, Enum.Font.GothamBold)
	text("WaitCaption", 0.42, 0.1, "CURRENT WAIT", Color3.fromRGB(180, 190, 210), Enum.Font.GothamBold)
	local waitLabel = text("Wait", 0.52, 0.3, "5 MIN", C.Orange, Enum.Font.GothamBlack)
	local statusLabel = text("Status", 0.84, 0.12, "NOW BOARDING", C.Green, Enum.Font.GothamBold)
	-- back of the sign
	Kit.label(board, Enum.NormalId.Back, ride.name, { fg = C.Cream, font = Enum.Font.GothamBlack, glow = true })
	-- the queue maze, walkway and boarding gate
	queueLine(f, ride, land)
	-- prompt anchor
	local point = Kit.block(f, Vector3.new(2, 2, 2), cf * CFrame.new(0, 3, -1), Color3.new(1, 1, 1), M.SmoothPlastic)
	point.Name = "QueuePoint"
	point.Transparency = 1
	point.CanCollide = false
	local join = Kit.prompt(point, "Join Line", ride.name, Enum.KeyCode.E, 14)
	join.Name = "JoinPrompt"
	local express = Kit.prompt(point, "Use Express Pass", ride.name, Enum.KeyCode.F, 14)
	express.Name = "ExpressPrompt"
	express.UIOffset = Vector2.new(0, 70)
	-- exit sign
	local exitBase = Vector3.new(ride.exit.X, 0.4, ride.exit.Z)
	Kit.postSign(f, "EXIT", exitBase, facing, 5, 2, { bg = C.Red, fg = C.Cream, font = Enum.Font.GothamBlack, both = true })
	return nameLabel, waitLabel, statusLabel, join, express
end

---------------------------------------------------------------------------
-- Flat ride structures
---------------------------------------------------------------------------
local function pivotPart(model: Model, cf: CFrame): Part
	local p = Kit.block(model, Vector3.new(1, 1, 1), cf, Color3.new(1, 1, 1), M.SmoothPlastic)
	p.Name = "Pivot"
	p.Transparency = 1
	p.CanCollide = false
	model.PrimaryPart = p
	return p
end

local function dropTower(parent: Instance, ride: Ride, motion: RideMotion.Motion)
	local o = motion.originCF
	local blue, dark, orange = ride.colors[1], ride.colors[2] or Color3.fromRGB(28, 32, 44), ride.colors[3] or C.Orange
	local f = Kit.folder("Tower", parent)
	local H = 172
	Kit.block(f, Vector3.new(7, H, 7), o * CFrame.new(0, H / 2, 0), dark, M.Metal)
	-- loading deck around the tower, where the crew checks the harnesses
	Kit.disc(f, 24, 2.4, (o * CFrame.new(0, Staff.FLAT.droptower.floor, 0)).Position, C.Concrete, M.Concrete)
	Kit.disc(f, 24.6, 0.2, (o * CFrame.new(0, Staff.FLAT.droptower.floor + 0.05, 0)).Position, Color3.fromRGB(250, 210, 40), M.SmoothPlastic).CastShadow = false
	for _, sx in { -1, 1 } do
		for _, sz in { -1, 1 } do
			local strip_ = Kit.block(f, Vector3.new(0.5, H - 6, 0.5), o * CFrame.new(sx * 3.6, H / 2, sz * 3.6), blue, M.Neon)
			strip_.CastShadow = false
		end
	end
	Kit.block(f, Vector3.new(13, 9, 13), o * CFrame.new(0, H + 4.5, 0), dark, M.Metal)
	Kit.block(f, Vector3.new(14, 1, 14), o * CFrame.new(0, H + 9.5, 0), blue, M.Neon)
	for k = 0, 3 do
		local cf = o * CFrame.new(0, H + 4.5, 0) * CFrame.Angles(0, k * HALF_PI, 0) * CFrame.new(0, 0, -6.6)
		Kit.sign(f, "BENTON", Vector3.new(12, 6, 0.3), cf, { bg = dark, fg = Color3.new(1, 1, 1), font = Enum.Font.GothamBlack, glow = true })
	end
	Kit.post(f, 14, 0.4, (o * CFrame.new(0, H + 10, 0)).Position, Color3.fromRGB(220, 220, 225), M.Metal)
	local flag = Kit.block(f, Vector3.new(0.2, 3, 5), o * CFrame.new(0, H + 22, 2.6), orange, M.Fabric)
	flag.CastShadow = false
	local beacon = Kit.ball(f, 1.6, (o * CFrame.new(0, H + 24.5, 0)).Position, Color3.fromRGB(255, 60, 60), M.Neon)
	Kit.light(beacon, Color3.fromRGB(255, 80, 80), 30, 2)
	-- base platform and fence
	Kit.disc(f, 30, 3, (o * CFrame.new(0, 3, 0)).Position, C.Concrete, M.Concrete)
	for k = 0, 15 do
		local a = k * math.pi / 8
		local p = (o * CFrame.Angles(0, a, 0) * CFrame.new(0, 0, -16)).Position
		Kit.post(f, 4, 0.4, Vector3.new(p.X, 0.4, p.Z), Color3.fromRGB(60, 60, 66), M.Metal)
	end
end

local function carouselStructure(parent: Instance, ride: Ride, motion: RideMotion.Motion)
	local o = motion.originCF
	local red, gold, cream = ride.colors[1], ride.colors[2] or C.Gold, ride.colors[3] or C.Cream
	local f = Kit.folder("Structure", parent)
	Kit.disc(f, 40, 1.6, (o * CFrame.new(0, 1.6, 0)).Position, Color3.fromRGB(150, 140, 130), M.Brick)
	local moving = parent:FindFirstChild("Moving") :: Folder
	local platform = Kit.model("Platform", moving)
	pivotPart(platform, o)
	Kit.disc(platform, 37, 0.6, (o * CFrame.new(0, 2.2, 0)).Position, Color3.fromRGB(150, 100, 60), M.WoodPlanks)
	Kit.cyl(platform, 16, 6, o * CFrame.new(0, 10, 0) * CFrame.Angles(0, 0, HALF_PI), cream, M.SmoothPlastic)
	for k = 0, 7 do
		local cf = o * CFrame.Angles(0, k * math.pi / 4, 0) * CFrame.new(0, 10, -3.05)
		Kit.block(platform, Vector3.new(1.8, 8, 0.2), cf, Color3.fromRGB(200, 220, 240), M.Glass)
	end
	-- poles for each horse
	for i = 1, motion.carCount do
		local phi = (i - 1) * 2 * math.pi / motion.carCount
		local r = if i % 2 == 0 then 10 else 14
		local p = o * CFrame.Angles(0, phi, 0) * CFrame.new(r, 9.2, 0)
		Kit.cyl(platform, 14, 0.45, p * CFrame.Angles(0, 0, HALF_PI), gold, M.Metal)
	end
	-- striped canopy
	local tiers = { { 40, 16.4 }, { 32, 17.6 }, { 22, 18.8 }, { 12, 20 } }
	for t, tier in tiers do
		Kit.disc(platform, tier[1], 1.4, (o * CFrame.new(0, tier[2], 0)).Position, if t % 2 == 1 then red else cream, M.Fabric)
	end
	for k = 0, 15 do
		local a = k * math.pi / 8
		local bulb = Kit.ball(platform, 0.8, (o * CFrame.Angles(0, a, 0) * CFrame.new(0, 15.4, -19.6)).Position, Color3.fromRGB(255, 230, 160), M.Neon)
		bulb.CastShadow = false
	end
	Kit.gear(platform, o * CFrame.new(0, 23, 0), 5, gold)
	local light = Kit.block(platform, Vector3.new(1, 1, 1), o * CFrame.new(0, 14, 0), Color3.new(1, 1, 1), M.SmoothPlastic)
	light.Transparency = 1
	Kit.light(light, Color3.fromRGB(255, 220, 160), 30, 1)
	for _, d in platform:GetDescendants() do
		if d:IsA("BasePart") then
			(d :: BasePart).CanCollide = false
		end
	end
end

local function spinnerStructure(parent: Instance, ride: Ride, motion: RideMotion.Motion)
	local o = motion.originCF
	local f = Kit.folder("Structure", parent)
	Kit.disc(f, 48, 1.2, (o * CFrame.new(0, 1.2, 0)).Position, Color3.fromRGB(150, 140, 130), M.Concrete)
	for k = 0, 19 do
		local a = k * math.pi / 10
		local p = (o * CFrame.Angles(0, a, 0) * CFrame.new(0, 0, -25)).Position
		Kit.post(f, 3.4, 0.4, Vector3.new(p.X, 0.4, p.Z), C.Gold, M.Metal)
	end
	local moving = parent:FindFirstChild("Moving") :: Folder
	local platform = Kit.model("Platform", moving)
	pivotPart(platform, o)
	Kit.disc(platform, 42, 0.8, (o * CFrame.new(0, 2, 0)).Position, Color3.fromRGB(60, 64, 76), M.DiamondPlate)
	for k = 0, 11 do
		local a = k * math.pi / 6
		Kit.block(platform, Vector3.new(3, 0.82, 4), o * CFrame.Angles(0, a, 0) * CFrame.new(0, 1.6, -20.5), C.Gold, M.Metal)
	end
	Kit.cyl(platform, 6, 5, o * CFrame.new(0, 5, 0) * CFrame.Angles(0, 0, HALF_PI), C.Gold, M.Metal)
	Kit.gear(platform, o * CFrame.new(0, 9, 0) * CFrame.Angles(HALF_PI, 0, 0), 7, C.Orange)
	for _, d in platform:GetDescendants() do
		if d:IsA("BasePart") then
			(d :: BasePart).CanCollide = false
		end
	end
	local _ = ride
end

local function pendulumStructure(parent: Instance, ride: Ride, motion: RideMotion.Motion)
	local o = motion.originCF
	local orange, dark, gold = ride.colors[1], ride.colors[2] or Color3.fromRGB(70, 70, 76), ride.colors[3] or C.Gold
	local f = Kit.folder("Structure", parent)
	local pivot = o * CFrame.new(0, 34, 0)
	for _, sz in { -1, 1 } do
		for _, sx in { -1, 1 } do
			local foot = (o * CFrame.new(sx * 15, 0, sz * 12)).Position
			local top = (pivot * CFrame.new(0, 0, sz * 9.5)).Position
			Kit.beam(f, foot, top, 2.2, dark, M.Metal, true)
			Kit.box(f, Vector3.new(4, 1.2, 4), foot, C.Concrete, M.Concrete)
		end
	end
	Kit.cyl(f, 20, 2.4, pivot * CFrame.Angles(0, HALF_PI, 0), gold, M.Metal)
	-- loading platform
	Kit.disc(f, 20, 4.6, (o * CFrame.new(0, 4.6, 0)).Position, C.Concrete, M.Concrete)
	local moving = parent:FindFirstChild("Moving") :: Folder
	local arm = Kit.model("Arm", moving)
	pivotPart(arm, pivot)
	Kit.cyl(arm, 6, 5, pivot * CFrame.Angles(0, HALF_PI, 0), orange, M.Metal)
	Kit.block(arm, Vector3.new(2.6, 27, 2.6), pivot * CFrame.new(0, -14.5, 0), orange, M.Metal)
	-- the "piston" counterweight
	Kit.cyl(arm, 9, 6, pivot * CFrame.new(0, 7, 0) * CFrame.Angles(0, 0, HALF_PI), Color3.fromRGB(200, 200, 205), M.Metal)
	Kit.cyl(arm, 1, 6.6, pivot * CFrame.new(0, 11.8, 0) * CFrame.Angles(0, 0, HALF_PI), dark, M.Metal)
	Kit.cyl(arm, 1, 6.6, pivot * CFrame.new(0, 2.6, 0) * CFrame.Angles(0, 0, HALF_PI), dark, M.Metal)
	local lights = Kit.block(arm, Vector3.new(0.6, 22, 0.6), pivot * CFrame.new(0, -14, -1.4), C.Gold, M.Neon)
	lights.CastShadow = false
	for _, d in arm:GetDescendants() do
		if d:IsA("BasePart") then
			(d :: BasePart).CanCollide = false
		end
	end
end

---------------------------------------------------------------------------
-- Ride crew: the control console and its operator (attendants are
-- animated by the clients)
---------------------------------------------------------------------------
local function crewPost(parent: Instance, ride: Ride)
	local crew = Staff.crew(ride.id)
	if not crew then
		return
	end
	local f = Kit.folder("Crew", parent)
	local cf = crew.console
	local cabinet = Color3.fromRGB(46, 52, 64)
	Kit.block(f, Vector3.new(2.8, 3.1, 1.3), cf * CFrame.new(0, 1.55, 0), cabinet, M.Metal)
	-- sloped control panel facing the operator, with its buttons
	local panel = cf * CFrame.new(0, 3.2, -0.1) * CFrame.Angles(math.rad(-22), 0, 0)
	Kit.block(f, Vector3.new(3.0, 0.3, 1.7), panel, Color3.fromRGB(30, 32, 38), M.Metal)
	local buttons = {
		{ -0.9, Color3.fromRGB(60, 220, 90) }, -- dispatch
		{ -0.3, Color3.fromRGB(250, 200, 40) },
		{ 0.3, Color3.fromRGB(60, 140, 240) },
		{ 0.95, Color3.fromRGB(230, 40, 40) }, -- emergency stop
	}
	for _, b in buttons do
		local p = (panel * CFrame.new(b[1] :: number, 0.2, 0.1)).Position
		Kit.disc(f, if b[1] == 0.95 then 0.55 else 0.38, 0.14, p + Vector3.new(0, 0.07, 0), b[2] :: Color3, M.Neon).CastShadow = false
	end
	local screen = Kit.block(f, Vector3.new(1.4, 0.8, 0.12), cf * CFrame.new(0, 4.0, 0.45) * CFrame.Angles(math.rad(-10), 0, 0), Color3.fromRGB(40, 120, 170), M.Neon)
	screen.CastShadow = false
	-- stack light: green / amber / red
	local pole = (cf * CFrame.new(1.25, 0, 0.45)).Position
	Kit.post(f, 5.6, 0.18, Vector3.new(pole.X, cf.Y + 3.1, pole.Z), cabinet, M.Metal)
	for i, c in { Color3.fromRGB(60, 220, 90), Color3.fromRGB(250, 190, 40), Color3.fromRGB(230, 50, 40) } do
		local lamp = Kit.block(f, Vector3.new(0.42, 0.36, 0.42), CFrame.new(pole + Vector3.new(0, cf.Y + 3.1 + 2.3 + i * 0.38, 0)), c, if i == 1 then M.Neon else M.SmoothPlastic)
		lamp.Name = "StackLight" .. i
		lamp.CastShadow = false
	end
	Staff.place(f, "operator", ride.land, #ride.id * 97 + 5, crew.operator, ride.id, "operate")
end

---------------------------------------------------------------------------
-- Entry point
---------------------------------------------------------------------------
function RideBuilder.build(root: Instance): { [string]: RideInfo }
	local ridesFolder = Kit.folder("Rides", root)
	local infos: { [string]: RideInfo } = {}
	for _, ride in Config.Rides do
		local motion = RideMotion.get(ride.id)
		local model = Kit.model(ride.id, ridesFolder)
		model:SetAttribute("RideId", ride.id)
		local carsFolder = Kit.folder("Cars", model)
		Kit.folder("Moving", model)
		local rest = motion.pose(0)
		local sampler = motion.sampler
		if sampler then
			if ride.kind == "coaster" then
				steelTrack(model, ride, sampler, ride.carStyle == "mine")
			elseif ride.kind == "flume" then
				flumeTrack(model, ride, sampler)
			elseif ride.kind == "train" then
				railTrack(model, sampler)
			elseif ride.kind == "tram" then
				groundStrip(model, sampler, 10, Color3.fromRGB(90, 90, 96), M.Asphalt, 1.0 + 0.55, Color3.fromRGB(250, 210, 40), false)
			elseif ride.kind == "trucks" then
				groundStrip(model, sampler, 8, Color3.fromRGB(80, 80, 86), M.Asphalt, 0.85 + 0.5, Color3.fromRGB(250, 210, 40), true)
			elseif ride.kind == "karts" then
				groundStrip(model, sampler, 15, Color3.fromRGB(60, 62, 68), M.Asphalt, 0.5, Color3.new(1, 1, 1), true)
			end
			if ride.kind ~= "karts" and ride.kind ~= "trucks" then
				station(model, ride, motion, rest)
			end
		elseif ride.kind == "droptower" then
			dropTower(model, ride, motion)
		elseif ride.kind == "carousel" then
			carouselStructure(model, ride, motion)
		elseif ride.kind == "spinner" then
			spinnerStructure(model, ride, motion)
		elseif ride.kind == "pendulum" then
			pendulumStructure(model, ride, motion)
		end
		for i = 1, motion.carCount do
			local car = Vehicles.build(ride, motion, i, rest[i], carsFolder)
			car.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
		end
		for _, m in (model:FindFirstChild("Moving") :: Folder):GetChildren() do
			(m :: Model).ModelStreamingMode = Enum.ModelStreamingMode.Persistent
		end
		crewPost(model, ride)
		local nameLabel, waitLabel, statusLabel, join, express = queueEntrance(model, ride)
		infos[ride.id] = {
			ride = ride,
			model = model,
			motion = motion,
			nameLabel = nameLabel,
			waitLabel = waitLabel,
			statusLabel = statusLabel,
			joinPrompt = join,
			expressPrompt = express,
		}
	end
	return infos
end

return RideBuilder
