-- Day/night from the park clock, lamps at dusk, the spinning Benton Globe,
-- and a crowd of guests strolling the walkways (busier at peak hours).

local Lighting = game:GetService("Lighting")
local RunService = game:GetService("RunService")
local CollectionService = game:GetService("CollectionService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Clock = require(Shared.Clock)
local Props = require(Shared.Props)

local Ambience = {}

local V = Vector3.new

-- Walkway lines guests stroll back and forth on.
local LINES: { { Vector3 } } = {
	{ V(-14, 0, 222), V(-14, 0, 6) },
	{ V(14, 0, 6), V(14, 0, 222) },
	{ V(-6, 0, 210), V(-6, 0, 20) },
	{ V(-45, 0, 252), V(45, 0, 252) },
	{ V(-30, 0, 15), V(-158, 0, 15) },
	{ V(-62, 0, 240), V(-150, 0, 232) },
	{ V(-38, 0, -100), V(-160, 0, -184) },
	{ V(0, 0, -118), V(0, 0, -290) },
	{ V(38, 0, -100), V(126, 0, -150) },
	{ V(130, 0, -120), V(215, 0, -180) },
	{ V(26, 0, 60), V(112, 0, 60) },
	{ V(112, 0, 60), V(112, 0, 246) },
	{ V(112, 0, 246), V(300, 0, 246) },
	{ V(300, 0, 60), V(300, 0, 246) },
	{ V(112, 0, 60), V(300, 0, 60) },
	{ V(-152, 0, 50), V(-152, 0, 190) },
	{ V(-200, 0, -20), V(-180, 0, 40) },
	{ V(-240, 0, -200), V(-160, 0, -175) },
}

type Walker = {
	model: Model,
	line: { Vector3 },
	s: number,
	speed: number,
	dir: number,
	offset: number,
	phase: number,
	index: number,
	hub: boolean,
}

local walkers: { Walker } = {}
local folder: Folder

local function makeWalkers(count: number)
	local rng = Random.new(77)
	for i = 1, count do
		local hub = i % 6 == 0
		local line = LINES[(i - 1) % #LINES + 1]
		local m = Props.guest(500 + i * 13, "stand")
		m.Name = "Guest"
		m.Parent = folder
		table.insert(walkers, {
			model = m,
			line = line,
			s = rng:NextNumber(0, 1),
			speed = rng:NextNumber(4.5, 6.5),
			dir = if rng:NextNumber() < 0.5 then 1 else -1,
			offset = rng:NextNumber(-4, 4),
			phase = rng:NextNumber(0, 6),
			index = i,
			hub = hub,
		})
	end
end

local HIDDEN = CFrame.new(0, -500, 0)

local function updateWalkers(dt: number, crowd: number)
	local now = os.clock()
	local visible = math.floor(#walkers * math.clamp(crowd, 0.1, 1))
	for i, w in walkers do
		if i > visible then
			w.model:PivotTo(HIDDEN)
			continue
		end
		local pos: Vector3
		local facing: Vector3
		if w.hub then
			w.s = (w.s + dt * w.speed / (2 * math.pi * 50) * w.dir) % 1
			local a = w.s * math.pi * 2
			local r = 46 + w.offset
			pos = V(math.cos(a) * r, 0, -60 + math.sin(a) * r)
			facing = V(-math.sin(a), 0, math.cos(a)) * w.dir
		else
			local a, b = w.line[1], w.line[2]
			local len = (b - a).Magnitude
			w.s += dt * w.speed / len * w.dir
			if w.s > 1 then
				w.s = 1
				w.dir = -1
			elseif w.s < 0 then
				w.s = 0
				w.dir = 1
			end
			local along = (b - a).Unit
			local side = along:Cross(Vector3.yAxis)
			pos = a:Lerp(b, w.s) + side * w.offset
			facing = along * w.dir
		end
		local bob = math.abs(math.sin(now * 7 + w.phase)) * 0.35
		w.model:PivotTo(CFrame.lookAt(pos + V(0, 3.3 + bob, 0), pos + V(0, 3.3 + bob, 0) + facing))
	end
end

function Ambience.start(root: Instance)
	folder = Instance.new("Folder")
	folder.Name = "BentonCrowd"
	folder.Parent = workspace
	makeWalkers(54)
	local globe = root:FindFirstChild("BentonGlobe", true) :: Model?
	local globeBase = if globe then globe:GetPivot() else nil
	local angle = 0
	local lampTimer = 0
	local lampsOn: boolean? = nil
	RunService.RenderStepped:Connect(function(dt)
		local minute = Clock.minutes()
		Lighting.ClockTime = Clock.clockTime(minute)
		if globe and globeBase then
			angle += dt * 0.15
			globe:PivotTo(globeBase * CFrame.Angles(0, angle, 0))
		end
		updateWalkers(dt, Clock.crowd(minute))
		lampTimer += dt
		if lampTimer > 2 then
			lampTimer = 0
			local hour = minute / 60
			local night = hour < 6.8 or hour >= 18.6
			if night ~= lampsOn then
				lampsOn = night
				for _, bulb in CollectionService:GetTagged("ParkLamp") do
					local light = bulb:FindFirstChildOfClass("PointLight")
					if light then
						light.Enabled = night
					end
				end
			end
		end
	end)
end

return Ambience
