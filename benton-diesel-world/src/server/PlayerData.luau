-- Player profiles: Benton Bucks, souvenirs, Express Passes, passport
-- stamps and stats. Saved with DataStoreService when it is available
-- (in Studio, turn on "Enable Studio Access to API Services" to test saving).

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)

local PlayerData = {}

export type Profile = {
	Bucks: number,
	Passes: number,
	Owned: { string },
	Equipped: { [string]: string },
	Stamps: { string },
	Stats: { [string]: number },
	LastDaily: number,
	Version: number,
}

local STORE_NAME = "BentonDieselWorld_v1"
local store: DataStore? = nil
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(STORE_NAME)
	end)
	if ok then
		store = result
	else
		warn("[BentonDieselWorld] DataStore unavailable, progress will not be saved:", result)
	end
end

local profiles: { [Player]: Profile } = {}
local canSave: { [Player]: boolean } = {}

local function defaultProfile(): Profile
	return {
		Bucks = Config.Economy.StartingBucks,
		Passes = Config.Economy.StartingPasses,
		Owned = {},
		Equipped = { hat = "", face = "", balloon = "" },
		Stamps = {},
		Stats = { Rides = 0, Shows = 0, Meals = 0, Playtime = 0 },
		LastDaily = 0,
		Version = 1,
	}
end

-- Fill in any fields missing from older saves.
local function reconcile(data: any): Profile
	local p = defaultProfile()
	if type(data) ~= "table" then
		return p
	end
	if type(data.Bucks) == "number" then
		p.Bucks = math.max(0, math.floor(data.Bucks))
	end
	if type(data.Passes) == "number" then
		p.Passes = math.max(0, math.floor(data.Passes))
	end
	if type(data.Owned) == "table" then
		for _, id in data.Owned do
			if type(id) == "string" then
				table.insert(p.Owned, id)
			end
		end
	end
	if type(data.Equipped) == "table" then
		for slot, id in data.Equipped do
			if type(slot) == "string" and type(id) == "string" then
				p.Equipped[slot] = id
			end
		end
	end
	if type(data.Stamps) == "table" then
		for _, id in data.Stamps do
			if type(id) == "string" then
				table.insert(p.Stamps, id)
			end
		end
	end
	if type(data.Stats) == "table" then
		for k, v in data.Stats do
			if type(k) == "string" and type(v) == "number" then
				p.Stats[k] = v
			end
		end
	end
	if type(data.LastDaily) == "number" then
		p.LastDaily = data.LastDaily
	end
	return p
end

local function key(player: Player): string
	return "player_" .. player.UserId
end

function PlayerData.get(player: Player): Profile?
	return profiles[player]
end

local function snapshot(p: Profile)
	return {
		Bucks = p.Bucks,
		Passes = p.Passes,
		Owned = table.clone(p.Owned),
		Equipped = table.clone(p.Equipped),
		Stamps = table.clone(p.Stamps),
		Stats = table.clone(p.Stats),
	}
end

-- Push the profile to the client (attributes for quick reads + a full
-- snapshot for the app) and refresh leaderstats.
function PlayerData.sync(player: Player)
	local p = profiles[player]
	if not p then
		return
	end
	player:SetAttribute("Bucks", p.Bucks)
	player:SetAttribute("Passes", p.Passes)
	player:SetAttribute("Stamps", #p.Stamps)
	local stats = player:FindFirstChild("leaderstats")
	if stats then
		local bucks = stats:FindFirstChild(Config.CurrencyShort) :: IntValue?
		if bucks then
			bucks.Value = p.Bucks
		end
		local rides = stats:FindFirstChild("Rides") :: IntValue?
		if rides then
			rides.Value = p.Stats.Rides or 0
		end
	end
	Net.remote("Profile"):FireClient(player, snapshot(p))
end

function PlayerData.notify(player: Player, text: string, kind: string?, amount: number?)
	Net.remote("Notify"):FireClient(player, { text = text, kind = kind or "info", amount = amount })
end

function PlayerData.addBucks(player: Player, amount: number, reason: string?)
	local p = profiles[player]
	if not p then
		return
	end
	p.Bucks += amount
	PlayerData.sync(player)
	if reason then
		PlayerData.notify(player, reason, "reward", amount)
	end
end

function PlayerData.spend(player: Player, amount: number): boolean
	local p = profiles[player]
	if not p or p.Bucks < amount then
		return false
	end
	p.Bucks -= amount
	PlayerData.sync(player)
	return true
end

function PlayerData.owns(player: Player, itemId: string): boolean
	local p = profiles[player]
	return p ~= nil and table.find(p.Owned, itemId) ~= nil
end

function PlayerData.give(player: Player, itemId: string)
	local p = profiles[player]
	if p and not table.find(p.Owned, itemId) then
		table.insert(p.Owned, itemId)
		PlayerData.sync(player)
	end
end

function PlayerData.bumpStat(player: Player, stat: string, by: number?)
	local p = profiles[player]
	if p then
		p.Stats[stat] = (p.Stats[stat] or 0) + (by or 1)
	end
end

-- Returns true if this is a new stamp.
function PlayerData.stamp(player: Player, rideId: string): boolean
	local p = profiles[player]
	if not p or table.find(p.Stamps, rideId) then
		return false
	end
	table.insert(p.Stamps, rideId)
	return true
end

local function save(player: Player)
	local p = profiles[player]
	if not p or not store or not canSave[player] then
		return
	end
	local data = snapshot(p) :: any
	data.LastDaily = p.LastDaily
	data.Version = p.Version
	for attempt = 1, 3 do
		local ok, err = pcall(function()
			(store :: DataStore):SetAsync(key(player), data)
		end)
		if ok then
			return
		end
		warn("[BentonDieselWorld] save failed (attempt " .. attempt .. "):", err)
		task.wait(1 + attempt)
	end
end
PlayerData.save = save

local function load(player: Player)
	local data = nil
	local loaded = false
	if store then
		for attempt = 1, 3 do
			local ok, result = pcall(function()
				return (store :: DataStore):GetAsync(key(player))
			end)
			if ok then
				data = result
				loaded = true
				break
			end
			warn("[BentonDieselWorld] load failed (attempt " .. attempt .. "):", result)
			task.wait(1)
		end
	end
	if not player.Parent then
		return
	end
	-- only save if we successfully read (never overwrite a save we could not load)
	canSave[player] = loaded
	local profile = reconcile(data)
	profiles[player] = profile

	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local bucks = Instance.new("IntValue")
	bucks.Name = Config.CurrencyShort
	bucks.Parent = stats
	local rides = Instance.new("IntValue")
	rides.Name = "Rides"
	rides.Parent = stats
	stats.Parent = player

	player:SetAttribute("Hunger", Config.Hunger.Max)
	player:SetAttribute("DataReady", true)
	PlayerData.sync(player)

	-- daily visit bonus
	local today = math.floor(os.time() / 86400)
	if profile.LastDaily ~= today then
		profile.LastDaily = today
		task.delay(4, function()
			if player.Parent then
				PlayerData.addBucks(player, Config.Economy.DailyBonus, "Welcome to Benton Diesel World! Daily visit bonus")
			end
		end)
	end
	if not loaded and RunService:IsStudio() then
		task.delay(6, function()
			if player.Parent then
				PlayerData.notify(player, "Saving is off in Studio. Enable Studio Access to API Services to test saves.", "warn")
			end
		end)
	end
end

local readyCallbacks: { (Player) -> () } = {}
function PlayerData.onReady(fn: (Player) -> ())
	table.insert(readyCallbacks, fn)
end

function PlayerData.start()
	local function added(player: Player)
		load(player)
		if profiles[player] then
			for _, fn in readyCallbacks do
				task.spawn(fn, player)
			end
		end
	end
	Players.PlayerAdded:Connect(added)
	for _, player in Players:GetPlayers() do
		task.spawn(added, player)
	end
	Players.PlayerRemoving:Connect(function(player)
		save(player)
		profiles[player] = nil
		canSave[player] = nil
	end)
	game:BindToClose(function()
		for _, player in Players:GetPlayers() do
			task.spawn(save, player)
		end
		task.wait(2)
	end)
	-- autosave + playtime rewards
	task.spawn(function()
		local elapsed = 0
		while true do
			task.wait(Config.Economy.PlaytimeInterval)
			elapsed += Config.Economy.PlaytimeInterval
			for _, player in Players:GetPlayers() do
				if profiles[player] then
					PlayerData.bumpStat(player, "Playtime", Config.Economy.PlaytimeInterval)
					PlayerData.addBucks(player, Config.Economy.PlaytimeReward, "Thanks for spending time at the park!")
					if elapsed % 240 == 0 then
						task.spawn(save, player)
					end
				end
			end
		end
	end)
end

return PlayerData
