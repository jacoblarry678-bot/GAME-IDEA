-- Plays the park's sounds on each client: land music that crossfades as you
-- walk, show music at the venues, ride loops on the lead vehicles, screams
-- on big drops, the log flume splash and short UI cues. Which sounds play
-- is set in ReplicatedStorage.BentonShared.Sounds.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)
local Sounds = require(Shared.Sounds)

local SoundPlayer = {}

local localPlayer = Players.LocalPlayer
local music: { [string]: Sound } = {}
local currentLand = ""
local holder: Folder? = nil

local function newSound(id: string, parent: Instance, volume: number, looped: boolean): Sound
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = volume
	s.Looped = looped
	s.RollOffMaxDistance = 260
	s.RollOffMinDistance = 12
	s.Parent = parent
	return s
end

-- A short sound everyone nearby hears from a point in the world.
function SoundPlayer.at(position: Vector3, cue: string, volume: number?)
	local id = Sounds.Cues[cue]
	if not id or id == "" or not holder then
		return
	end
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.Transparency = 1
	p.Size = Vector3.new(1, 1, 1)
	p.Position = position
	p.Parent = holder
	local s = newSound(id, p, volume or 0.8, false)
	s:Play()
	task.delay(4, function()
		p:Destroy()
	end)
end

-- A UI cue (not positional).
function SoundPlayer.cue(cue: string, volume: number?)
	local id = Sounds.Cues[cue]
	if not id or id == "" then
		return
	end
	local s = newSound(id, SoundService, volume or 0.5, false)
	s:Play()
	task.delay(3, function()
		s:Destroy()
	end)
end

local function setLand(id: string)
	if id == currentLand then
		return
	end
	currentLand = id
	for land, s in music do
		local target = if land == id then Sounds.MusicVolume else 0
		TweenService:Create(s, TweenInfo.new(2.5), { Volume = target }):Play()
	end
end

type RideSound = { ride: Config.Ride, folder: Instance, loop: Sound?, lastY: number?, cool: number }

function SoundPlayer.start(root: Instance)
	local h = Instance.new("Folder")
	h.Name = "BentonSounds"
	h.Parent = workspace
	holder = h
	-- land music
	for land, id in Sounds.Music do
		if id ~= "" then
			local s = newSound(id, SoundService, 0, true)
			s:Play()
			music[land] = s
		end
	end
	-- show music at each venue
	local shows = Net.state():WaitForChild("Shows")
	for _, show in Config.Shows do
		local id = Sounds.Shows[show.id]
		local folder = shows:FindFirstChild(show.id)
		if id and id ~= "" and folder then
			local p = Instance.new("Part")
			p.Anchored = true
			p.CanCollide = false
			p.Transparency = 1
			p.Position = show.center + Vector3.new(0, 8, 0)
			p.Parent = h
			local s = newSound(id, p, 0.8, true)
			s.RollOffMaxDistance = 400
			local function sync()
				if folder:GetAttribute("Running") then
					s:Play()
				else
					s:Stop()
				end
			end
			folder:GetAttributeChangedSignal("Running"):Connect(sync)
			sync()
		end
	end
	-- rides
	local rideState = Net.state():WaitForChild("Rides")
	local rides: { RideSound } = {}
	for _, ride in Config.Rides do
		local folder = rideState:FindFirstChild(ride.id)
		if folder then
			table.insert(rides, { ride = ride, folder = folder, loop = nil, lastY = nil, cool = 0 })
		end
	end
	local function leadPart(ride: Config.Ride): BasePart?
		local ridesFolder = root:FindFirstChild("Rides")
		local model = if ridesFolder then ridesFolder:FindFirstChild(ride.id) else nil
		local cars = if model then model:FindFirstChild("Cars") else nil
		local car = if cars then cars:FindFirstChild("Car1") :: Model? else nil
		return if car then car.PrimaryPart else nil
	end
	localPlayer:GetAttributeChangedSignal("Riding"):Connect(function()
		local riding = localPlayer:GetAttribute("Riding")
		if type(riding) == "string" and riding ~= "" then
			SoundPlayer.cue("Info", 0.6)
		end
	end)
	local timer = 0
	RunService.RenderStepped:Connect(function(dt)
		timer += dt
		local character = localPlayer.Character
		local hrp = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if timer > 0.5 then
			timer = 0
			if hrp then
				local land = Config.landAt(hrp.Position)
				if land then
					setLand(land.id)
				end
			end
		end
		for _, rs in rides do
			local part = leadPart(rs.ride)
			if not part then
				continue
			end
			local running = rs.folder:GetAttribute("Status") == "Running"
			local id = Sounds.Rides[rs.ride.kind]
			if id and id ~= "" then
				if not rs.loop then
					rs.loop = newSound(id, part, 0.7, true)
				end
				local loop = rs.loop :: Sound
				if running and not loop.IsPlaying then
					loop:Play()
				elseif not running and loop.IsPlaying then
					loop:Stop()
				end
			end
			-- screams on big drops, and the flume splash at the bottom
			local y = part.Position.Y
			local last = rs.lastY
			rs.lastY = y
			rs.cool -= dt
			if last and dt > 0 and running then
				local vy = (y - last) / dt
				local drop = rs.ride.kind == "coaster" or rs.ride.kind == "droptower" or rs.ride.kind == "pendulum"
				if drop and vy < -40 and rs.cool <= 0 and Sounds.Screams ~= "" then
					rs.cool = 6
					local s = newSound(Sounds.Screams, part, 0.8, false)
					s:Play()
					task.delay(5, function()
						s:Destroy()
					end)
				elseif rs.ride.kind == "flume" and vy < -25 and rs.cool <= 0 then
					rs.cool = 6
					task.delay(1, function()
						SoundPlayer.at(part.Position, "Splash", 1)
					end)
				end
			end
		end
	end)
end

return SoundPlayer
