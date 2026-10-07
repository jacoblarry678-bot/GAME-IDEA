-- Ride operations: virtual queues shared by real players and simulated
-- guests, posted wait times, dispatch cycles, seating riders, rewards, and
-- the occasional "temporarily closed" breakdown.
--
-- Vehicles are animated on each client from the dispatch time published in
-- ReplicatedStorage.BentonState.Rides.<RideId> (see RideAnimator). The
-- server only anchors riders in place and moves them on/off the ride.

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Clock = require(Shared.Clock)
local Net = require(Shared.Net)
local RideMotion = require(Shared.RideMotion)

local PlayerData = require(script.Parent.PlayerData)
local Wearables = require(script.Parent.Wearables)

type RideInfo = {
	ride: Config.Ride,
	model: Model,
	motion: RideMotion.Motion,
	nameLabel: TextLabel,
	waitLabel: TextLabel,
	statusLabel: TextLabel,
	joinPrompt: ProximityPrompt,
	expressPrompt: ProximityPrompt,
}

type Entry = {
	player: Player?,
	express: boolean,
	seed: number,
}

type Rider = {
	player: Player?,
	character: Model?,
	car: number,
	seat: number,
	seed: number,
}

type RideState = {
	info: RideInfo,
	ride: Config.Ride,
	motion: RideMotion.Motion,
	folder: Folder,
	queue: { Entry },
	status: string, -- Open | Boarding | Running | Closed
	cycleId: number,
	cycleEnds: number,
	downUntil: number,
	riders: { Rider },
	rng: Random,
}

local RideService = {}

local states: { [string]: RideState } = {}
local order: { RideState } = {}
local boardRows: { { [string]: TextLabel } } = {}
local riding: { [Player]: string } = {}

local function cycleTotal(s: RideState): number
	return Config.BoardingTime + s.motion.duration + Config.UnloadTime
end

local function roundUp5(minutes: number): number
	return math.max(5, math.ceil(minutes / 5) * 5)
end

-- Seconds until a guest at queue position `pos` (1-based) boards.
local function etaFor(s: RideState, pos: number): number
	local cap = math.max(1, s.motion.capacity)
	local cyclesAhead = math.floor((pos - 1) / cap)
	local now = Clock.now()
	local current = 0
	if s.status == "Boarding" or s.status == "Running" then
		current = math.max(0, s.cycleEnds - now)
	end
	return current + cyclesAhead * cycleTotal(s)
end

local function postedWait(s: RideState): number
	return roundUp5(etaFor(s, #s.queue + 1) / 60 * 60) -- seconds == park minutes
end

local function queuePosition(s: RideState, player: Player): number?
	for i, e in s.queue do
		if e.player == player then
			return i
		end
	end
	return nil
end

local function refreshQueueAttributes(s: RideState)
	for i, e in s.queue do
		local p = e.player
		if p then
			p:SetAttribute("QueueRide", s.ride.id)
			p:SetAttribute("QueuePos", i)
			p:SetAttribute("QueueEta", math.ceil(etaFor(s, i)))
		end
	end
end

local function findQueue(player: Player): (RideState?, number?)
	for _, s in order do
		local pos = queuePosition(s, player)
		if pos then
			return s, pos
		end
	end
	return nil, nil
end

function RideService.leave(player: Player, quiet: boolean?)
	local s, pos = findQueue(player)
	if s and pos then
		table.remove(s.queue, pos)
		refreshQueueAttributes(s)
		if not quiet then
			PlayerData.notify(player, "You left the line for " .. s.ride.name .. ".", "info")
		end
	end
	player:SetAttribute("QueueRide", "")
	player:SetAttribute("QueuePos", 0)
	player:SetAttribute("QueueEta", 0)
end

function RideService.join(player: Player, rideId: string, express: boolean)
	local s = states[rideId]
	if not s then
		return
	end
	if riding[player] then
		PlayerData.notify(player, "Finish your current ride first!", "warn")
		return
	end
	local current = findQueue(player)
	if current == s and not express then
		PlayerData.notify(player, "You're already in line for " .. s.ride.name .. ".", "info")
		return
	end
	if current then
		RideService.leave(player, true)
	end
	local entry: Entry = { player = player, express = express, seed = player.UserId % 100000 }
	if express then
		local profile = PlayerData.get(player)
		if not profile or profile.Passes <= 0 then
			PlayerData.notify(player, "You don't have any Express Passes. Buy them at the shops!", "warn")
			return
		end
		profile.Passes -= 1
		PlayerData.sync(player)
		-- behind other express guests, ahead of everyone else
		local at = 1
		for i, e in s.queue do
			if e.express then
				at = i + 1
			end
		end
		table.insert(s.queue, at, entry)
		PlayerData.notify(player, "Express Pass used! You're near the front for " .. s.ride.name .. ".", "reward")
	else
		table.insert(s.queue, entry)
		local wait = math.ceil(etaFor(s, #s.queue))
		PlayerData.notify(player, string.format("You joined the line for %s. Estimated wait: %d min.", s.ride.name, math.max(1, wait)), "info")
	end
	if s.status == "Closed" then
		PlayerData.notify(player, s.ride.name .. " is temporarily closed. Hang tight - you'll keep your place!", "warn")
	end
	refreshQueueAttributes(s)
end

---------------------------------------------------------------------------
-- Seating and unloading
---------------------------------------------------------------------------
local function rootOf(character: Model?): BasePart?
	if not character then
		return nil
	end
	return character:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function humanoidOf(character: Model?): Humanoid?
	if not character then
		return nil
	end
	return character:FindFirstChildOfClass("Humanoid")
end

local function seatPlayer(s: RideState, rider: Rider, rest: { CFrame })
	local character = rider.character
	local root = rootOf(character)
	local hum = humanoidOf(character)
	if not character or not root or not hum then
		return
	end
	Wearables.hideBalloon(character)
	local seatCF = rest[rider.car] * s.motion.seats[rider.car][rider.seat]
	hum.Sit = true
	root.Anchored = true
	character:PivotTo(seatCF)
end

local function releasePlayer(s: RideState, rider: Rider, index: number)
	local player = rider.player
	local character = rider.character
	if not player then
		return
	end
	riding[player] = nil
	player:SetAttribute("Riding", "")
	if not player.Parent or player.Character ~= character then
		return
	end
	local root = rootOf(character)
	local hum = humanoidOf(character)
	local exit = s.ride.exit
	local away = Vector3.new(exit.X - s.ride.origin.X, 0, exit.Z - s.ride.origin.Z)
	away = if away.Magnitude > 0.1 then away.Unit else Vector3.new(0, 0, 1)
	local side = away:Cross(Vector3.yAxis)
	local offset = side * (((index - 1) % 5) - 2) * 2.5 + away * (math.floor((index - 1) / 5) * 2.5 + 2)
	local target = Vector3.new(exit.X, 3.5, exit.Z) + offset
	if root then
		root.Anchored = false
	end
	if hum then
		hum.Sit = false
	end
	if character then
		character:PivotTo(CFrame.lookAt(target, target + away))
		Wearables.showBalloon(player)
	end
end

local function reward(s: RideState, player: Player)
	PlayerData.bumpStat(player, "Rides")
	local first = PlayerData.stamp(player, s.ride.id)
	local amount = Config.Economy.RideReward + (if first then Config.Economy.FirstRideBonus else 0)
	if first then
		PlayerData.addBucks(player, amount, "New passport stamp: " .. s.ride.name .. "!")
		-- land complete bonus
		local profile = PlayerData.get(player)
		if profile then
			local all = true
			for _, ride in Config.Rides do
				if ride.land == s.ride.land and not table.find(profile.Stamps, ride.id) then
					all = false
				end
			end
			if all then
				local land = Config.landById(s.ride.land)
				PlayerData.addBucks(player, Config.Economy.LandCompleteBonus, "You rode everything in " .. (if land then land.name else "this land") .. "!")
			end
		end
	else
		PlayerData.addBucks(player, amount, "Thanks for riding " .. s.ride.name .. "!")
	end
end

---------------------------------------------------------------------------
-- Ride cycle
---------------------------------------------------------------------------
local function publish(s: RideState)
	local f = s.folder
	f:SetAttribute("Status", s.status)
	f:SetAttribute("Queue", #s.queue)
	f:SetAttribute("Wait", if s.status == "Closed" then -1 else postedWait(s))
end

local function encodeRiders(riders: { Rider }): string
	local list = {}
	for _, r in riders do
		local p = r.player
		table.insert(list, { c = r.car, s = r.seat, u = if p then p.UserId else 0, n = r.seed })
	end
	return HttpService:JSONEncode(list)
end

local function runCycle(s: RideState)
	local seats = RideMotion.seatList(s.motion)
	-- shuffle seats so guests are spread through the train
	local shuffled = table.clone(seats)
	s.rng:Shuffle(shuffled)
	-- players prefer the front of the train
	table.sort(shuffled, function(a, b)
		if a[1] ~= b[1] then
			return a[1] < b[1]
		end
		return a[2] < b[2]
	end)
	local riders: { Rider } = {}
	local taken = 0
	local playerSeats = {}
	local npcSeats = {}
	for i, seat in shuffled do
		if i % 2 == 1 then
			table.insert(playerSeats, seat)
		else
			table.insert(npcSeats, seat)
		end
	end
	for _, seat in npcSeats do
		table.insert(playerSeats, seat)
	end
	while taken < #playerSeats and #s.queue > 0 do
		local entry = table.remove(s.queue, 1) :: Entry
		local player = entry.player
		if player then
			if player.Parent and rootOf(player.Character) and not riding[player] then
				taken += 1
				local seat = playerSeats[taken]
				table.insert(riders, { player = player, character = player.Character, car = seat[1], seat = seat[2], seed = entry.seed })
				player:SetAttribute("QueueRide", "")
				player:SetAttribute("QueuePos", 0)
				player:SetAttribute("QueueEta", 0)
			end
		else
			taken += 1
			-- simulated guests sit in the remaining seats, back to front
			local seat = playerSeats[#playerSeats - (taken - 1) + #riders - (taken - 1)] or playerSeats[taken]
			local _ = seat
			table.insert(riders, { player = nil, character = nil, car = 0, seat = 0, seed = entry.seed })
		end
	end
	-- give simulated guests the seats players did not take
	local used = {}
	for _, r in riders do
		if r.player then
			used[r.car .. ":" .. r.seat] = true
		end
	end
	local free = {}
	for _, seat in shuffled do
		if not used[seat[1] .. ":" .. seat[2]] then
			table.insert(free, seat)
		end
	end
	s.rng:Shuffle(free)
	local fi = 1
	for _, r in riders do
		if not r.player then
			local seat = free[fi]
			fi += 1
			if seat then
				r.car, r.seat = seat[1], seat[2]
			end
		end
	end
	refreshQueueAttributes(s)
	if #riders == 0 then
		return
	end

	local now = Clock.now()
	s.cycleId += 1
	s.riders = riders
	s.status = "Boarding"
	s.cycleEnds = now + cycleTotal(s)
	local start = now + Config.BoardingTime
	s.folder:SetAttribute("CycleId", s.cycleId)
	s.folder:SetAttribute("CycleStart", start)
	s.folder:SetAttribute("Riders", encodeRiders(riders))
	publish(s)

	local rest = s.motion.pose(0)
	for _, r in riders do
		local p = r.player
		if p then
			riding[p] = s.ride.id
			p:SetAttribute("Riding", s.ride.id)
			seatPlayer(s, r, rest)
			PlayerData.notify(p, "Now boarding " .. s.ride.name .. "! Keep your arms and legs inside the vehicle.", "info")
		end
	end
	task.wait(Config.BoardingTime)
	s.status = "Running"
	publish(s)
	task.wait(s.motion.duration)
	s.status = "Open"
	for i, r in riders do
		local p = r.player
		if p then
			releasePlayer(s, r, i)
			if p.Parent then
				reward(s, p)
			end
		end
	end
	s.riders = {}
	s.folder:SetAttribute("Riders", "[]")
	publish(s)
	task.wait(Config.UnloadTime)
end

local function rideLoop(s: RideState)
	while true do
		local now = Clock.now()
		if s.status == "Closed" then
			if now >= s.downUntil then
				s.status = "Open"
				publish(s)
				for _, e in s.queue do
					local p = e.player
					if p then
						PlayerData.notify(p, s.ride.name .. " has reopened!", "info")
					end
				end
			else
				task.wait(1)
				continue
			end
		end
		if #s.queue > 0 then
			local ok, err = pcall(runCycle, s)
			if not ok then
				warn("[BentonDieselWorld] ride cycle error on " .. s.ride.id .. ": " .. tostring(err))
				-- release anybody left on board
				for i, r in s.riders do
					pcall(releasePlayer, s, r, i)
				end
				s.riders = {}
				s.status = "Open"
				s.folder:SetAttribute("Riders", "[]")
				task.wait(2)
			end
		else
			task.wait(0.5)
		end
	end
end

---------------------------------------------------------------------------
-- Simulated crowd
---------------------------------------------------------------------------
local function simulateCrowd()
	local minute = Clock.minutes()
	local crowd = Clock.crowd(minute)
	local t = Clock.now()
	for i, s in order do
		local wobble = 0.8 + 0.4 * (math.noise(i * 7.31, t / 90) + 0.5)
		local target = s.ride.baseWait * crowd * wobble
		local desired = math.floor(target / cycleTotal(s) * s.motion.capacity)
		local npcs = 0
		for _, e in s.queue do
			if not e.player then
				npcs += 1
			end
		end
		if npcs < desired then
			local add = math.min(desired - npcs, math.max(1, math.ceil(s.motion.capacity / 4)))
			for _ = 1, add do
				table.insert(s.queue, { player = nil, express = false, seed = s.rng:NextInteger(1, 1000000) })
			end
		elseif npcs > desired + s.motion.capacity then
			-- a few guests give up and leave from the back of the line
			for k = #s.queue, 1, -1 do
				if not s.queue[k].player then
					table.remove(s.queue, k)
					break
				end
			end
		end
		-- rare breakdowns (only between cycles)
		if s.status == "Open" and s.rng:NextNumber() < 0.004 then
			s.status = "Closed"
			s.downUntil = t + s.rng:NextNumber(40, 80)
			for _, e in s.queue do
				local p = e.player
				if p then
					PlayerData.notify(p, s.ride.name .. " is temporarily closed. Our mechanics are on it!", "warn")
				end
			end
		end
	end
end

---------------------------------------------------------------------------
-- Signs and boards
---------------------------------------------------------------------------
local function setupBoard(board: Part)
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 24
	gui.LightInfluence = 0
	gui.Brightness = 1.3
	gui.MaxDistance = 300
	gui.Parent = board
	local list = Instance.new("UIListLayout")
	list.Padding = UDim.new(0, 2)
	list.SortOrder = Enum.SortOrder.LayoutOrder
	list.Parent = gui
	local pad = Instance.new("UIPadding")
	pad.PaddingTop = UDim.new(0, 8)
	pad.PaddingLeft = UDim.new(0, 12)
	pad.PaddingRight = UDim.new(0, 12)
	pad.Parent = gui
	local rows: { [string]: TextLabel } = {}
	for i, ride in Config.Rides do
		local land = Config.landById(ride.land) :: Config.Land
		local row = Instance.new("Frame")
		row.Name = ride.id
		row.LayoutOrder = i
		row.Size = UDim2.new(1, 0, 1 / (#Config.Rides + 0.6), -2)
		row.BackgroundColor3 = if i % 2 == 0 then Color3.fromRGB(26, 34, 52) else Color3.fromRGB(20, 26, 42)
		row.BorderSizePixel = 0
		row.Parent = gui
		local dot = Instance.new("Frame")
		dot.Size = UDim2.new(0, 10, 0.6, 0)
		dot.Position = UDim2.new(0, 4, 0.2, 0)
		dot.BackgroundColor3 = land.color
		dot.BorderSizePixel = 0
		dot.Parent = row
		local name = Instance.new("TextLabel")
		name.BackgroundTransparency = 1
		name.Position = UDim2.new(0, 20, 0, 0)
		name.Size = UDim2.new(0.72, -20, 1, 0)
		name.TextXAlignment = Enum.TextXAlignment.Left
		name.Text = ride.name
		name.TextScaled = true
		name.TextColor3 = Config.Colors.Cream
		name.FontFace = Font.fromEnum(Enum.Font.GothamBold)
		name.Parent = row
		local wait = Instance.new("TextLabel")
		wait.Name = "Wait"
		wait.BackgroundTransparency = 1
		wait.Position = UDim2.new(0.72, 0, 0, 0)
		wait.Size = UDim2.new(0.28, 0, 1, 0)
		wait.TextXAlignment = Enum.TextXAlignment.Right
		wait.Text = "--"
		wait.TextScaled = true
		wait.TextColor3 = Config.Colors.Orange
		wait.FontFace = Font.fromEnum(Enum.Font.GothamBlack)
		wait.Parent = row
		rows[ride.id] = wait
	end
	table.insert(boardRows, rows)
end

local GREEN = Color3.fromRGB(90, 220, 110)
local YELLOW = Color3.fromRGB(250, 210, 60)
local ORANGE = Color3.fromRGB(255, 140, 26)
local RED = Color3.fromRGB(240, 70, 60)

local function waitColor(minutes: number): Color3
	if minutes <= 15 then
		return GREEN
	elseif minutes <= 30 then
		return YELLOW
	elseif minutes <= 45 then
		return ORANGE
	end
	return RED
end

local function updateSigns()
	for _, s in order do
		publish(s)
		local info = s.info
		local closed = s.status == "Closed"
		local wait = postedWait(s)
		local text = if closed then "CLOSED" else (wait .. " MIN")
		local color = if closed then RED else waitColor(wait)
		info.waitLabel.Text = text
		info.waitLabel.TextColor3 = color
		if closed then
			info.statusLabel.Text = "TEMPORARILY CLOSED"
			info.statusLabel.TextColor3 = RED
		elseif s.status == "Running" then
			info.statusLabel.Text = "RIDE IN PROGRESS"
			info.statusLabel.TextColor3 = YELLOW
		else
			info.statusLabel.Text = "NOW BOARDING"
			info.statusLabel.TextColor3 = GREEN
		end
		info.joinPrompt.ActionText = if closed then "Join Line (closed)" else string.format("Join Line (%d min)", wait)
		for _, rows in boardRows do
			local label = rows[s.ride.id]
			if label then
				label.Text = text
				label.TextColor3 = color
			end
		end
		refreshQueueAttributes(s)
	end
end

---------------------------------------------------------------------------
-- Start
---------------------------------------------------------------------------
function RideService.isRiding(player: Player): boolean
	return riding[player] ~= nil
end

function RideService.start(infos: { [string]: RideInfo }, boards: { Part })
	local stateFolder = Net.state():WaitForChild("Rides")
	for _, ride in Config.Rides do
		local info = infos[ride.id]
		local folder = stateFolder:FindFirstChild(ride.id) :: Folder?
		if not folder then
			local f = Instance.new("Folder")
			f.Name = ride.id
			f.Parent = stateFolder
			folder = f
		end
		local s: RideState = {
			info = info,
			ride = ride,
			motion = info.motion,
			folder = folder :: Folder,
			queue = {},
			status = "Open",
			cycleId = 0,
			cycleEnds = 0,
			downUntil = 0,
			riders = {},
			rng = Random.new(#ride.id * 977 + math.floor(os.clock() * 1000) % 1000),
		}
		s.folder:SetAttribute("Duration", info.motion.duration)
		s.folder:SetAttribute("Capacity", info.motion.capacity)
		s.folder:SetAttribute("CycleId", 0)
		s.folder:SetAttribute("CycleStart", 0)
		s.folder:SetAttribute("Riders", "[]")
		states[ride.id] = s
		table.insert(order, s)
		info.joinPrompt.Triggered:Connect(function(player)
			RideService.join(player, ride.id, false)
		end)
		info.expressPrompt.Triggered:Connect(function(player)
			RideService.join(player, ride.id, true)
		end)
	end
	for _, board in boards do
		setupBoard(board)
	end
	-- warm up the queues so waits look realistic from the first second
	for _ = 1, 6 do
		simulateCrowd()
	end
	for _, s in order do
		task.spawn(rideLoop, s)
	end
	task.spawn(function()
		while true do
			simulateCrowd()
			task.wait(2)
		end
	end)
	task.spawn(function()
		while true do
			updateSigns()
			task.wait(1)
		end
	end)
	Players.PlayerRemoving:Connect(function(player)
		RideService.leave(player, true)
		riding[player] = nil
	end)
end

return RideService
