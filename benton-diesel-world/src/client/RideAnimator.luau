-- Animates every ride locally, in sync with server time, and keeps riders
-- (players and simulated guests) in their seats. Also plays the special
-- effects on the Studio Backlot Tram Tour.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local Debris = game:GetService("Debris")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Clock = require(Shared.Clock)
local Net = require(Shared.Net)
local Props = require(Shared.Props)
local RideMotion = require(Shared.RideMotion)

local RideAnimator = {}

type RiderData = { c: number, s: number, u: number, n: number }

type Animated = {
	ride: Config.Ride,
	motion: RideMotion.Motion,
	folder: Instance,
	cars: { Model },
	extras: { [string]: Model },
	riders: { RiderData },
	guests: { Model },
	cycleId: number,
	atRest: boolean,
	firedCues: { [number]: boolean },
	frame: number,
}

local animated: { Animated } = {}
local localPlayer = Players.LocalPlayer

local function decodeRiders(s: any): { RiderData }
	if type(s) ~= "string" or s == "" then
		return {}
	end
	local ok, data = pcall(function()
		return HttpService:JSONDecode(s)
	end)
	if ok and type(data) == "table" then
		return data :: any
	end
	return {}
end

local function clearGuests(a: Animated)
	for _, g in a.guests do
		g:Destroy()
	end
	a.guests = {}
end

-- Build guest figures for simulated riders, attached to their cars.
local function refreshRiders(a: Animated)
	clearGuests(a)
	a.riders = decodeRiders(a.folder:GetAttribute("Riders"))
	local cycle = a.folder:GetAttribute("CycleId")
	a.cycleId = if type(cycle) == "number" then cycle else 0
	a.firedCues = {}
	local thrill = a.ride.thrill >= 4
	for _, r in a.riders do
		if r.u == 0 and r.c > 0 then
			local car = a.cars[r.c]
			local seat = a.motion.seats[r.c] and a.motion.seats[r.c][r.s]
			if car and seat then
				local pose = if thrill and r.n % 2 == 0 then "cheer" else "sit"
				local g = Props.guest(r.n, pose)
				g:PivotTo(car:GetPivot() * seat)
				g.Parent = car
				table.insert(a.guests, g)
			end
		end
	end
end

---------------------------------------------------------------------------
-- Tram tour special effects
---------------------------------------------------------------------------
local function effect(kind: string, at: Vector3)
	local holder = Instance.new("Part")
	holder.Anchored = true
	holder.CanCollide = false
	holder.CanQuery = false
	holder.Transparency = 1
	holder.Size = Vector3.new(4, 1, 4)
	holder.CFrame = CFrame.new(at)
	holder.Parent = workspace
	if kind == "fire" then
		for i = -1, 1 do
			local p = holder:Clone() :: Part
			p.CFrame = CFrame.new(at + Vector3.new(0, 0, i * 6))
			p.Parent = holder
			local fire = Instance.new("Fire")
			fire.Size = 12
			fire.Heat = 20
			fire.Parent = p
		end
		local light = Instance.new("PointLight")
		light.Color = Color3.fromRGB(255, 140, 40)
		light.Range = 30
		light.Brightness = 3
		light.Parent = holder
	elseif kind == "flood" then
		local water = Instance.new("Part")
		water.Anchored = true
		water.CanCollide = false
		water.Material = Enum.Material.Glass
		water.Color = Color3.fromRGB(80, 150, 220)
		water.Transparency = 0.3
		water.Size = Vector3.new(4, 1, 30)
		water.CFrame = CFrame.new(at + Vector3.new(0, 16, 0))
		water.Parent = holder
		local mist = Instance.new("ParticleEmitter")
		mist.Texture = "rbxasset://textures/particles/smoke_main.dds"
		mist.Color = ColorSequence.new(Color3.fromRGB(220, 240, 255))
		mist.Size = NumberSequence.new(4, 10)
		mist.Transparency = NumberSequence.new(0.4, 1)
		mist.Rate = 40
		mist.Speed = NumberRange.new(6, 12)
		mist.Lifetime = NumberRange.new(1, 2)
		mist.Parent = water
		task.spawn(function()
			for i = 1, 30 do
				water.Size = Vector3.new(4 + i * 0.5, 1 + i, 30)
				water.CFrame = CFrame.new(at + Vector3.new(0, 16 - i * 0.5, 0))
				task.wait(0.05)
			end
		end)
	elseif kind == "explosion" then
		local boom = Instance.new("Explosion")
		boom.Position = at + Vector3.new(0, 6, 0)
		boom.BlastPressure = 0
		boom.BlastRadius = 0
		boom.DestroyJointRadiusPercent = 0
		boom.ExplosionType = Enum.ExplosionType.NoCraters
		boom.Parent = workspace
		local light = Instance.new("PointLight")
		light.Color = Color3.fromRGB(255, 180, 80)
		light.Range = 40
		light.Brightness = 5
		light.Parent = holder
	else
		local sparks = Instance.new("ParticleEmitter")
		sparks.Texture = "rbxasset://textures/particles/sparkles_main.dds"
		sparks.Color = ColorSequence.new(Color3.fromRGB(255, 220, 120))
		sparks.LightEmission = 1
		sparks.Size = NumberSequence.new(0.6, 0)
		sparks.Speed = NumberRange.new(20, 30)
		sparks.SpreadAngle = Vector2.new(60, 60)
		sparks.Lifetime = NumberRange.new(0.6, 1)
		sparks.Acceleration = Vector3.new(0, -60, 0)
		sparks.Rate = 200
		sparks.Parent = holder
	end
	Debris:AddItem(holder, 4)
end

---------------------------------------------------------------------------
-- Per-frame update
---------------------------------------------------------------------------
local function placeRiders(a: Animated, cars: { CFrame })
	for _, r in a.riders do
		if r.u ~= 0 and r.c > 0 then
			local player = Players:GetPlayerByUserId(r.u)
			local character = player and player.Character
			local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
			local seat = a.motion.seats[r.c] and a.motion.seats[r.c][r.s]
			if root and root.Anchored and seat and cars[r.c] then
				root.CFrame = cars[r.c] * seat
			end
		end
	end
end

local function update()
	local now = Clock.now()
	local camera = workspace.CurrentCamera
	local camPos = if camera then camera.CFrame.Position else Vector3.zero
	for _, a in animated do
		a.frame += 1
		local start = a.folder:GetAttribute("CycleStart")
		local t = 0
		if type(start) == "number" and start > 0 and now >= start and now <= start + a.motion.duration then
			t = now - start
		end
		local hasRiders = #a.riders > 0
		if t == 0 and a.atRest and not hasRiders then
			continue
		end
		-- far-away rides update at a lower rate (but never ones you ride)
		local far = (a.ride.origin - camPos).Magnitude > 500
		local mine = localPlayer:GetAttribute("Riding") == a.ride.id
		if far and not mine and a.frame % 3 ~= 0 then
			continue
		end
		local cars, extras = a.motion.pose(t)
		for i, cf in cars do
			local car = a.cars[i]
			if car then
				car:PivotTo(cf)
			end
		end
		for name, cf in extras do
			local m = a.extras[name]
			if m then
				m:PivotTo(cf)
			end
		end
		placeRiders(a, cars)
		a.atRest = t == 0
		-- tram tour effects
		local cues = a.ride.cues
		if cues and t > 0 then
			for i, cue in cues do
				local at = (cue[1] :: number) * a.motion.duration
				if t >= at and t < at + 1 and not a.firedCues[i] then
					a.firedCues[i] = true
					local side = cue[3] :: Vector3
					effect(cue[2] :: string, (cars[1] * CFrame.new(side)).Position)
				end
			end
		end
	end
end

-- Keep the local player from jumping out of a moving ride.
local function watchRiding()
	local function apply()
		local character = localPlayer.Character
		local hum = character and character:FindFirstChildOfClass("Humanoid")
		if not hum then
			return
		end
		local riding = localPlayer:GetAttribute("Riding")
		local onRide = type(riding) == "string" and riding ~= ""
		hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, not onRide)
		if onRide then
			hum.Sit = true
		end
	end
	localPlayer:GetAttributeChangedSignal("Riding"):Connect(apply)
	localPlayer.CharacterAdded:Connect(function()
		task.wait(0.5)
		apply()
	end)
end

-- Only show the Express Pass prompt to guests who have passes.
local function watchPasses()
	local function apply()
		local passes = localPlayer:GetAttribute("Passes")
		local has = type(passes) == "number" and passes > 0
		for _, a in animated do
			local carsFolder = a.cars[1] and a.cars[1].Parent
			local model = carsFolder and carsFolder.Parent
			local queue = model and model:FindFirstChild("Queue")
			local point = queue and queue:FindFirstChild("QueuePoint")
			local prompt = point and point:FindFirstChild("ExpressPrompt") :: ProximityPrompt?
			if prompt then
				prompt.Enabled = has
				prompt.ActionText = string.format("Use Express Pass (%d left)", if type(passes) == "number" then passes else 0)
			end
		end
	end
	localPlayer:GetAttributeChangedSignal("Passes"):Connect(apply)
	apply()
end

function RideAnimator.start(root: Instance)
	local rides = root:WaitForChild("Rides")
	local stateRides = Net.state():WaitForChild("Rides")
	for _, ride in Config.Rides do
		local model = rides:WaitForChild(ride.id, 30)
		local folder = stateRides:WaitForChild(ride.id, 30)
		if model and folder then
			local motion = RideMotion.get(ride.id)
			local carsFolder = model:WaitForChild("Cars")
			local cars = {}
			for i = 1, motion.carCount do
				cars[i] = carsFolder:WaitForChild("Car" .. i) :: Model
			end
			local extras = {}
			local moving = model:WaitForChild("Moving")
			for _, name in motion.extras do
				extras[name] = moving:WaitForChild(name) :: Model
			end
			local a: Animated = {
				ride = ride,
				motion = motion,
				folder = folder,
				cars = cars,
				extras = extras,
				riders = {},
				guests = {},
				cycleId = 0,
				atRest = false,
				firedCues = {},
				frame = 0,
			}
			table.insert(animated, a)
			refreshRiders(a)
			folder:GetAttributeChangedSignal("Riders"):Connect(function()
				refreshRiders(a)
			end)
		end
	end
	watchRiding()
	watchPasses()
	RunService:BindToRenderStep("BentonRides", Enum.RenderPriority.Camera.Value - 1, update)
end

return RideAnimator
