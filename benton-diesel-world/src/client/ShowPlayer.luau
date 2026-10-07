-- Plays the park's shows locally, in sync with the start time the server
-- publishes. Each show is a function of time t, so guests who arrive late
-- see the show from the right moment.

local RunService = game:GetService("RunService")
local CollectionService = game:GetService("CollectionService")
local Debris = game:GetService("Debris")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Clock = require(Shared.Clock)
local Net = require(Shared.Net)
local Props = require(Shared.Props)

local ShowPlayer = {}

type Instance_ = {
	folder: Folder,
	stage: Model,
	update: Updater,
	cleanup: Cleanup,
}

type Updater = (t: number) -> ()
type Cleanup = () -> ()
type ShowImpl = (stage: Model) -> (Updater, Cleanup)

local TAU = math.pi * 2
local M = Enum.Material

local function part(parent: Instance, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material?, shape: Enum.PartType?): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or M.SmoothPlastic
	if shape then
		p.Shape = shape
	end
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

local function smooth(x: number): number
	x = math.clamp(x, 0, 1)
	return x * x * (3 - 2 * x)
end

-- Caption board floating over a show.
local function captions(parent: Instance, at: Vector3, lines: { { any } }): (t: number) -> ()
	local anchor = part(parent, Vector3.new(1, 1, 1), CFrame.new(at), Color3.new(1, 1, 1))
	anchor.Transparency = 1
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(520, 70)
	gui.AlwaysOnTop = false
	gui.MaxDistance = 260
	gui.LightInfluence = 0
	gui.Parent = anchor
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextScaled = true
	label.TextColor3 = Color3.fromRGB(255, 240, 200)
	label.FontFace = Font.fromEnum(Enum.Font.GothamBlack)
	label.Text = ""
	label.Parent = gui
	local stroke = Instance.new("UIStroke")
	stroke.Thickness = 3
	stroke.Color = Color3.fromRGB(20, 20, 30)
	stroke.Parent = label
	return function(t: number)
		local text = ""
		for _, line in lines do
			if t >= (line[1] :: number) then
				text = line[2] :: string
			end
		end
		label.Text = text
	end
end

local function confetti(parent: Instance, at: Vector3, area: Vector3): ParticleEmitter
	local p = part(parent, area, CFrame.new(at), Color3.new(1, 1, 1))
	p.Transparency = 1
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	e.Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 80, 80)),
		ColorSequenceKeypoint.new(0.33, Color3.fromRGB(255, 220, 60)),
		ColorSequenceKeypoint.new(0.66, Color3.fromRGB(80, 160, 255)),
		ColorSequenceKeypoint.new(1, Color3.fromRGB(120, 230, 120)),
	})
	e.Size = NumberSequence.new(0.5, 0.3)
	e.Speed = NumberRange.new(4, 10)
	e.SpreadAngle = Vector2.new(70, 70)
	e.Lifetime = NumberRange.new(3, 5)
	e.Acceleration = Vector3.new(0, -8, 0)
	e.RotSpeed = NumberRange.new(-200, 200)
	e.Rate = 0
	e.LightEmission = 0.3
	e.Parent = p
	return e
end

---------------------------------------------------------------------------
-- Big Dreams Live! (Lakeside Stage)
---------------------------------------------------------------------------
local function bigDreams(stage: Model): (Updater, Cleanup)
	local center = Vector3.new(225, 4.4, 186)
	local dancers = {}
	for i = 1, 7 do
		local g = Props.guest(9000 + i * 17, if i == 4 then "cheer" else "stand")
		g.Parent = stage
		table.insert(dancers, g)
	end
	-- lead singer's microphone stand
	part(stage, Vector3.new(0.3, 5, 0.3), CFrame.new(center + Vector3.new(0, 2.5, 4)), Color3.fromRGB(40, 40, 44), M.Metal)
	local lights = CollectionService:GetTagged("StageLight")
	local fountains = CollectionService:GetTagged("LakeFountain")
	local burst = confetti(stage, center + Vector3.new(0, 22, 4), Vector3.new(44, 1, 14))
	local caption = captions(stage, center + Vector3.new(0, 26, 8), {
		{ 0, "BIG DREAMS LIVE!" },
		{ 4, "♪ Wheels keep turning, engines hum... ♪" },
		{ 14, "♪ Every dreamer, here we come! ♪" },
		{ 24, "♪ Big dreams, big rigs, brighter days ♪" },
		{ 34, "♪ Benton lights the lakeside haze ♪" },
		{ 44, "♪ Hand in hand and gear to gear... ♪" },
		{ 54, "♪ BIG DREAMS START RIGHT HERE! ♪" },
		{ 64, "Thank you, Benton Diesel World!" },
	})
	local confettiFired = false
	local function update(t: number)
		caption(t)
		-- formations: line -> V -> circle -> line
		local phase = math.floor(t / 15) % 4
		local blend = smooth((t % 15) / 2)
		for i, g in dancers do
			local k = i - 4
			local line = Vector3.new(k * 5, 0, 2)
			local vee = Vector3.new(k * 4.5, 0, 6 - math.abs(k) * 2.4)
			local a = TAU * i / #dancers + t * 0.8
			local circle = Vector3.new(math.cos(a) * 11, 0, 4 + math.sin(a) * 5)
			local shapes = { line, vee, circle, line }
			local from = shapes[(phase + 3) % 4 + 1]
			local to = shapes[phase + 1]
			local p = from:Lerp(to, blend)
			if i == 4 then
				p = Vector3.new(0, 0, 4.2)
			end
			local bounce = math.abs(math.sin(t * 4 + i)) * 1.4
			local yaw = math.sin(t * 2 + i) * 0.5
			g:PivotTo(CFrame.new(center + p + Vector3.new(0, 2.9 + bounce, 0)) * CFrame.Angles(0, math.pi + yaw, 0))
		end
		for i, l in lights do
			local spot = l:FindFirstChildOfClass("SpotLight")
			if spot then
				spot.Brightness = 3 + math.sin(t * 3 + i) * 2
				spot.Color = Color3.fromHSV((t * 0.08 + i * 0.13) % 1, 0.7, 1)
			end
		end
		local fountainsOn = t > 8 and t < 66
		for i, f in fountains do
			local spray = f:FindFirstChildOfClass("ParticleEmitter")
			if spray then
				spray.Enabled = fountainsOn and ((math.floor(t / 2) + i) % 3 ~= 0 or t > 54)
				spray.Color = ColorSequence.new(Color3.fromHSV((t * 0.05 + i * 0.1) % 1, 0.35, 1))
			end
		end
		if t > 56 and not confettiFired then
			confettiFired = true
			burst:Emit(400)
		end
	end
	local function cleanup()
		for _, l in lights do
			local spot = l:FindFirstChildOfClass("SpotLight")
			if spot then
				spot.Brightness = 0
			end
		end
		for _, f in fountains do
			local spray = f:FindFirstChildOfClass("ParticleEmitter")
			if spray then
				spray.Enabled = false
			end
		end
	end
	return update, cleanup
end

---------------------------------------------------------------------------
-- Diesel Stunt Spectacular (Backlot Stunt Arena)
---------------------------------------------------------------------------
local function stuntTruck(parent: Instance, color: Color3): Model
	local m = Instance.new("Model")
	m.Name = "StuntTruck"
	local base = part(m, Vector3.new(0.5, 0.5, 0.5), CFrame.new(), Color3.new(1, 1, 1))
	base.Transparency = 1
	m.PrimaryPart = base
	part(m, Vector3.new(6, 2.4, 9), CFrame.new(0, 4.2, 0), color, M.SmoothPlastic)
	part(m, Vector3.new(5.4, 2.4, 4), CFrame.new(0, 6.6, 0.8), color, M.SmoothPlastic)
	part(m, Vector3.new(5, 1.6, 0.2), CFrame.new(0, 6.8, -1.25), Color3.fromRGB(150, 200, 230), M.Glass)
	for _, sx in { -1, 1 } do
		for _, sz in { -3.2, 3.2 } do
			part(m, Vector3.new(2.2, 4.4, 4.4), CFrame.new(sx * 3.6, 2.2, sz), Color3.fromRGB(25, 25, 25), M.Rubber, Enum.PartType.Cylinder)
		end
	end
	part(m, Vector3.new(6.2, 0.6, 1), CFrame.new(0, 3.4, -4.6), Color3.fromRGB(200, 200, 205), M.Metal)
	m.Parent = parent
	return m
end

-- Ramp jump from west (x=36) to east (x=104) along z, starting at time t0.
local function jumpPose(t: number, t0: number, z: number, roll: boolean): CFrame?
	local d = t - t0
	if d < 0 or d > 4 then
		return nil
	end
	local x = 30 + d * 20
	local y = 0
	if x >= 47 and x < 60 then
		y = (x - 47) / 13 * 6.4
	elseif x >= 60 and x < 80 then
		local u = (x - 60) / 20
		y = 6.4 + u * (-0.6) + 30 * u * (1 - u)
	elseif x >= 80 and x < 93 then
		y = 5.8 * (1 - (x - 80) / 13)
	end
	local pitch = 0
	if x >= 47 and x < 60 then
		pitch = 0.45
	elseif x >= 60 and x < 80 then
		pitch = 0.45 - (x - 60) / 20 * 0.9
	elseif x >= 80 and x < 93 then
		pitch = -0.4
	end
	local spin = if roll and x >= 60 and x < 80 then (x - 60) / 20 * TAU else 0
	return CFrame.new(x, 0.5 + y, z) * CFrame.Angles(0, -math.pi / 2, 0) * CFrame.Angles(pitch, 0, 0) * CFrame.Angles(0, 0, spin)
end

local function stunts(stage: Model): (Updater, Cleanup)
	local trucks = {
		stuntTruck(stage, Color3.fromRGB(196, 40, 40)),
		stuntTruck(stage, Color3.fromRGB(30, 110, 230)),
		stuntTruck(stage, Color3.fromRGB(255, 140, 26)),
	}
	local center = Vector3.new(70, 0.5, -246)
	local pots = CollectionService:GetTagged("StuntFirePot")
	local fires: { Fire } = {}
	local booms: { [string]: boolean } = {}
	local caption = captions(stage, Vector3.new(70, 30, -250), {
		{ 0, "LADIES AND GENTLEMEN... START YOUR ENGINES!" },
		{ 12, "The Benton Stunt Team!" },
		{ 16, "First up: the RED RIG ramp jump!" },
		{ 28, "Double trouble - BLUE and ORANGE!" },
		{ 40, "Through the WALL OF FIRE!" },
		{ 54, "And now... the BARREL ROLL!" },
		{ 66, "Give it up for the Benton Stunt Team!" },
	})
	local function boom(key: string, at: Vector3)
		if booms[key] then
			return
		end
		booms[key] = true
		local e = Instance.new("Explosion")
		e.Position = at
		e.BlastPressure = 0
		e.BlastRadius = 0
		e.DestroyJointRadiusPercent = 0
		e.ExplosionType = Enum.ExplosionType.NoCraters
		e.Parent = workspace
	end
	local function circle(t: number, i: number, radius: number): CFrame
		local a = t * 0.9 + i * TAU / 3
		local p = center + Vector3.new(math.cos(a) * radius, 0, math.sin(a) * radius * 0.8)
		local tangent = Vector3.new(-math.sin(a), 0, math.cos(a) * 0.8)
		return CFrame.lookAt(p, p + tangent)
	end
	local parked = {
		CFrame.new(44, 0.5, -270) * CFrame.Angles(0, math.rad(30), 0),
		CFrame.new(96, 0.5, -270) * CFrame.Angles(0, math.rad(-30), 0),
		CFrame.new(70, 0.5, -275),
	}
	local function update(t: number)
		caption(t)
		for i, truck in trucks do
			local cf: CFrame
			if t < 14 then
				cf = circle(t, i, 22)
			elseif i == 1 and t >= 16 and t < 20 then
				cf = jumpPose(t, 16, -250, false) :: CFrame
			elseif i == 2 and t >= 28 and t < 32 then
				cf = jumpPose(t, 28, -252, false) :: CFrame
			elseif i == 3 and t >= 30 and t < 34 then
				cf = jumpPose(t, 30, -248, false) :: CFrame
			elseif i == 1 and t >= 42 and t < 50 then
				local u = (t - 42) / 8
				local x = 36 + u * 68
				cf = CFrame.new(x, 0.5, -256) * CFrame.Angles(0, -math.pi / 2, 0)
			elseif i == 3 and t >= 56 and t < 60 then
				cf = jumpPose(t, 56, -250, true) :: CFrame
			elseif t >= 64 then
				cf = CFrame.new(54 + i * 8, 0.5, -232) * CFrame.Angles(0, math.pi + math.sin(t * 6 + i) * 0.1, 0)
			else
				cf = parked[i]
			end
			truck:PivotTo(cf)
		end
		if t > 19 then
			boom("a", Vector3.new(96, 4, -250))
		end
		if t > 33 then
			boom("b", Vector3.new(96, 4, -252))
			boom("c", Vector3.new(60, 6, -276))
		end
		if t > 59.5 then
			boom("d", Vector3.new(100, 4, -250))
			boom("e", Vector3.new(40, 6, -276))
		end
		-- wall of fire
		local fireOn = t > 38 and t < 52
		if fireOn and #fires == 0 then
			for _, pot in pots do
				local f = Instance.new("Fire")
				f.Size = 14
				f.Heat = 25
				f.Parent = pot
				table.insert(fires, f)
			end
			for z = -276, -236, 8 do
				local holder = part(stage, Vector3.new(2, 1, 2), CFrame.new(70, 1, z), Color3.new(0, 0, 0))
				holder.Transparency = 1
				local f = Instance.new("Fire")
				f.Size = 10
				f.Heat = 18
				f.Parent = holder
				table.insert(fires, f)
			end
		elseif not fireOn and #fires > 0 then
			for _, f in fires do
				f:Destroy()
			end
			fires = {}
		end
	end
	local function cleanup()
		for _, f in fires do
			f:Destroy()
		end
	end
	return update, cleanup
end

---------------------------------------------------------------------------
-- Big Rig Parade (Hub and Main Street)
---------------------------------------------------------------------------
local ROUTE = {
	Vector3.new(-120, 0.5, -60),
	Vector3.new(-62, 0.5, -60),
	Vector3.new(-50, 0.5, -28),
	Vector3.new(-30, 0.5, -10),
	Vector3.new(0, 0.5, 0),
	Vector3.new(0, 0.5, 120),
	Vector3.new(0, 0.5, 225),
	Vector3.new(-30, 0.5, 248),
	Vector3.new(-90, 0.5, 240),
	Vector3.new(-150, 0.5, 232),
}

local routeLen = 0
local routeCum = { 0 }
for i = 2, #ROUTE do
	routeLen += (ROUTE[i] - ROUTE[i - 1]).Magnitude
	routeCum[i] = routeLen
end

local function routeAt(s: number): CFrame
	s = math.clamp(s, 0, routeLen - 0.01)
	for i = 2, #ROUTE do
		if s <= routeCum[i] then
			local a, b = ROUTE[i - 1], ROUTE[i]
			local u = (s - routeCum[i - 1]) / (routeCum[i] - routeCum[i - 1])
			return CFrame.lookAt(a:Lerp(b, u), b)
		end
	end
	return CFrame.new(ROUTE[#ROUTE])
end

local function float(parent: Instance, theme: number): (Model, { Model })
	local m = Instance.new("Model")
	m.Name = "Float" .. theme
	local base = part(m, Vector3.new(0.5, 0.5, 0.5), CFrame.new(), Color3.new(1, 1, 1))
	base.Transparency = 1
	m.PrimaryPart = base
	local colors = { Color3.fromRGB(196, 40, 40), Color3.fromRGB(30, 110, 230), Color3.fromRGB(120, 84, 52), Color3.fromRGB(70, 170, 120) }
	local c = colors[theme]
	-- cab
	part(m, Vector3.new(8, 7, 7), CFrame.new(0, 4.5, -10), c, M.SmoothPlastic)
	part(m, Vector3.new(7, 2.4, 0.3), CFrame.new(0, 6.5, -13.6), Color3.fromRGB(150, 200, 230), M.Glass)
	part(m, Vector3.new(7.6, 3, 4), CFrame.new(0, 3, -15), c, M.SmoothPlastic)
	-- flatbed
	part(m, Vector3.new(9, 1.4, 20), CFrame.new(0, 2.6, 4), Color3.fromRGB(240, 240, 236), M.SmoothPlastic)
	part(m, Vector3.new(9.4, 1, 20.4), CFrame.new(0, 1.8, 4), Color3.fromRGB(240, 196, 64), M.SmoothPlastic)
	for _, sx in { -1, 1 } do
		for _, sz in { -11, 0, 10 } do
			part(m, Vector3.new(1.4, 3, 3), CFrame.new(sx * 4.2, 1.5, sz), Color3.fromRGB(25, 25, 25), M.Rubber, Enum.PartType.Cylinder)
		end
	end
	if theme == 1 then
		part(m, Vector3.new(10, 10, 10), CFrame.new(0, 9, 5), Color3.fromRGB(40, 110, 210), M.SmoothPlastic, Enum.PartType.Ball)
		for k = 0, 11 do
			local a = k * TAU / 12
			part(m, Vector3.new(2.2, 1.2, 1.2), CFrame.new(0, 9, 5) * CFrame.Angles(0, 0, a) * CFrame.new(0, 7, 0), Color3.fromRGB(240, 196, 64), M.Metal)
		end
	elseif theme == 2 then
		part(m, Vector3.new(5, 1.6, 11), CFrame.new(0, 4.2, 4), Color3.fromRGB(30, 110, 230), M.SmoothPlastic)
		part(m, Vector3.new(2.4, 1.4, 3), CFrame.new(0, 5.4, 4.5), Color3.fromRGB(20, 20, 26), M.Glass)
		part(m, Vector3.new(0.3, 8, 6), CFrame.new(0, 8, 12), Color3.new(1, 1, 1), M.Fabric)
	elseif theme == 3 then
		for k = 0, 2 do
			part(m, Vector3.new(4 - k, 3, 4 - k), CFrame.new(-2.5, 5 + k * 2.4, 9), Color3.fromRGB(40, 100, 56), M.Grass, Enum.PartType.Cylinder)
			part(m, Vector3.new(4 - k, 3, 4 - k), CFrame.new(2.5, 5 + k * 2.4, 0), Color3.fromRGB(40, 100, 56), M.Grass, Enum.PartType.Cylinder)
		end
		part(m, Vector3.new(4, 3, 6), CFrame.new(0, 4.8, 4), Color3.fromRGB(200, 120, 40), M.CorrodedMetal)
	else
		for k = 0, 2 do
			part(m, Vector3.new(1, 9 - k * 2.6, 9 - k * 2.6), CFrame.new(0, 4 + k * 1.2, 4) * CFrame.Angles(0, 0, math.pi / 2), if k % 2 == 0 then Color3.fromRGB(196, 40, 40) else Color3.fromRGB(250, 243, 224), M.Fabric, Enum.PartType.Cylinder)
		end
		part(m, Vector3.new(0.6, 9, 0.6), CFrame.new(0, 8, 4), Color3.fromRGB(240, 196, 64), M.Metal)
	end
	local riders = {}
	for k = 1, 3 do
		local g = Props.guest(7000 + theme * 10 + k, "cheer")
		g.Parent = m
		table.insert(riders, g)
	end
	m.Parent = parent
	return m, riders
end

local function parade(stage: Model): (Updater, Cleanup)
	local floats = {}
	for theme = 1, 4 do
		local m, riders = float(stage, theme)
		table.insert(floats, { model = m, riders = riders })
	end
	local walkers = {}
	for k = 1, 8 do
		local g = Props.guest(8100 + k * 3, if k % 2 == 0 then "cheer" else "stand")
		g.Parent = stage
		table.insert(walkers, g)
	end
	local speed = 5
	local gap = 34
	local caption = captions(stage, Vector3.new(0, 30, 120), {
		{ 0, "The BIG RIG PARADE is rolling down Main Street!" },
		{ 25, "Wave to the Benton Globe float!" },
		{ 50, "Here comes Velocity City and Old Rusty!" },
		{ 80, "And the Big Dreams carousel float!" },
	})
	local function update(t: number)
		caption(t)
		for i, f in floats do
			local s = t * speed - (i - 1) * gap
			local visible = s > 0 and s < routeLen - 1
			local cf = if visible then routeAt(s) else CFrame.new(0, -200, 0)
			f.model:PivotTo(cf)
			for k, g in f.riders do
				local bounce = math.abs(math.sin(t * 3 + k + i)) * 0.8
				g:PivotTo(cf * CFrame.new((k - 2) * 2.8, 6.2 + bounce, 6 + k) * CFrame.Angles(0, math.sin(t + k) * 0.6, 0))
			end
		end
		for k, g in walkers do
			local s = t * speed - (k - 1) * 9 + 12
			local visible = s > 0 and s < routeLen - 1
			local cf = if visible then routeAt(s) else CFrame.new(0, -200, 0)
			local side = if k % 2 == 0 then 7 else -7
			local bounce = math.abs(math.sin(t * 5 + k)) * 0.9
			g:PivotTo(cf * CFrame.new(side, 3.4 + bounce, 0) * CFrame.Angles(0, math.sin(t * 2 + k) * 0.8, 0))
		end
	end
	return update, function() end
end

---------------------------------------------------------------------------
-- Benton Nights fireworks
---------------------------------------------------------------------------
local function fireworks(stage: Model): (Updater, Cleanup)
	local rng = Random.new(2024)
	local sites = { Vector3.new(-60, 2, -230), Vector3.new(0, 2, -250), Vector3.new(60, 2, -230), Vector3.new(-30, 2, -300), Vector3.new(30, 2, -300) }
	type Firework = { at: number, from: Vector3, to: Vector3, color: Color3, size: number, fired: boolean, burst: boolean, rocket: Part? }
	local schedule: { Firework } = {}
	local t = 2
	while t < 92 do
		local finale = t > 76
		local site = sites[rng:NextInteger(1, #sites)]
		table.insert(schedule, {
			at = t,
			from = site,
			to = site + Vector3.new(rng:NextNumber(-40, 40), rng:NextNumber(130, 220), rng:NextNumber(-30, 60)),
			color = Color3.fromHSV(rng:NextNumber(), rng:NextNumber(0.5, 0.9), 1),
			size = rng:NextNumber(0.8, 1.4),
			fired = false,
			burst = false,
			rocket = nil,
		})
		t += if finale then rng:NextNumber(0.12, 0.3) else rng:NextNumber(0.5, 1.4)
	end
	local caption = captions(stage, Vector3.new(0, 40, -40), {
		{ 0, "BENTON NIGHTS" },
		{ 10, "" },
		{ 76, "GOODNIGHT FROM BENTON DIESEL WORLD!" },
	})
	local function burst(item: Firework)
		local holder = part(stage, Vector3.new(1, 1, 1), CFrame.new(item.to), item.color, M.Neon, Enum.PartType.Ball)
		holder.Transparency = 1
		local e = Instance.new("ParticleEmitter")
		e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		e.Color = ColorSequence.new(item.color, Color3.new(1, 1, 1))
		e.LightEmission = 1
		e.LightInfluence = 0
		e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 2.4 * item.size), NumberSequenceKeypoint.new(1, 0) })
		e.Speed = NumberRange.new(40 * item.size, 55 * item.size)
		e.SpreadAngle = Vector2.new(180, 180)
		e.Lifetime = NumberRange.new(1.4, 2.2)
		e.Acceleration = Vector3.new(0, -14, 0)
		e.Drag = 1.5
		e.Rate = 0
		e.Parent = holder
		e:Emit(140)
		local light = Instance.new("PointLight")
		light.Color = item.color
		light.Range = 60
		light.Brightness = 6
		light.Shadows = false
		light.Parent = holder
		task.delay(0.4, function()
			light.Brightness = 2
		end)
		Debris:AddItem(holder, 3)
	end
	local function update(time_: number)
		caption(time_)
		for _, item in schedule do
			if not item.fired and time_ >= item.at then
				item.fired = true
				local rocket = part(stage, Vector3.new(0.8, 0.8, 0.8), CFrame.new(item.from), Color3.fromRGB(255, 220, 160), M.Neon, Enum.PartType.Ball)
				local a0 = Instance.new("Attachment")
				a0.Position = Vector3.new(0, 0.3, 0)
				a0.Parent = rocket
				local a1 = Instance.new("Attachment")
				a1.Position = Vector3.new(0, -0.3, 0)
				a1.Parent = rocket
				local trail = Instance.new("Trail")
				trail.Attachment0 = a0
				trail.Attachment1 = a1
				trail.Lifetime = 0.5
				trail.Color = ColorSequence.new(Color3.fromRGB(255, 200, 120))
				trail.LightEmission = 1
				trail.Parent = rocket
				item.rocket = rocket
			end
			local rocket = item.rocket
			if rocket and not item.burst then
				local u = (time_ - item.at) / 1.1
				if u >= 1 then
					item.burst = true
					rocket:Destroy()
					item.rocket = nil
					burst(item)
				else
					rocket.CFrame = CFrame.new(item.from:Lerp(item.to, 1 - (1 - u) ^ 2))
				end
			end
		end
	end
	return update, function() end
end

local IMPLS: { [string]: ShowImpl } = {
	BigDreams = bigDreams,
	StuntSpectacular = stunts,
	BigRigParade = parade,
	BentonNights = fireworks,
}

---------------------------------------------------------------------------
-- Driver
---------------------------------------------------------------------------
local running: { [string]: Instance_ } = {}

function ShowPlayer.start()
	local folders = Net.state():WaitForChild("Shows")
	local container = Instance.new("Folder")
	container.Name = "BentonShowProps"
	container.Parent = workspace
	RunService.RenderStepped:Connect(function()
		local now = Clock.now()
		for _, show in Config.Shows do
			local folder = folders:FindFirstChild(show.id) :: Folder?
			if folder then
				local start = folder:GetAttribute("Start")
				local isRunning = folder:GetAttribute("Running") == true
				local t = if type(start) == "number" then now - start else -1
				local active = running[show.id]
				if isRunning and t >= 0 and t <= show.duration then
					if not active then
						local stage = Instance.new("Model")
						stage.Name = show.id
						stage.Parent = container
						local ok, update, cleanup = pcall(IMPLS[show.id], stage)
						if ok then
							active = { folder = folder, stage = stage, update = update, cleanup = cleanup }
							running[show.id] = active
						else
							warn("[BentonDieselWorld] show failed to start:", update)
							stage:Destroy()
						end
					end
					if active then
						local ok, err = pcall(active.update, t)
						if not ok then
							warn("[BentonDieselWorld] show error:", err)
						end
					end
				elseif active then
					pcall(active.cleanup)
					active.stage:Destroy()
					running[show.id] = nil
				end
			end
		end
	end)
end

return ShowPlayer
