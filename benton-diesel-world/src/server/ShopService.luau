-- Shops, restaurants, eating, hunger and food boosts.

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Clock = require(Shared.Clock)
local Config = require(Shared.Config)
local Items = require(Shared.Items)
local Net = require(Shared.Net)
local Props = require(Shared.Props)

local PlayerData = require(script.Parent.PlayerData)
local Wearables = require(script.Parent.Wearables)

local ShopService = {}

type VenueInfo = {
	venue: Config.Venue,
	model: Model,
	prompt: ProximityPrompt,
}

type Buff = { kind: string, amount: number, expires: number }

local buffs: { [Player]: { Buff } } = {}
local MAX_FOOD = 3
local SHOP_RANGE = 45

local function humanoid(player: Player): Humanoid?
	local c = player.Character
	return if c then c:FindFirstChildOfClass("Humanoid") else nil
end

-- Walk speed / jump from hunger and active food boosts.
local function refreshMovement(player: Player)
	local hum = humanoid(player)
	if not hum then
		return
	end
	local hunger = player:GetAttribute("Hunger") :: number? or Config.Hunger.Max
	local speed = if hunger <= 0 then Config.Hunger.HungrySpeed else Config.Hunger.NormalSpeed
	local jump = 7.2
	local now = Clock.now()
	local active = {}
	for _, b in buffs[player] or {} do
		if b.expires > now then
			table.insert(active, b)
			if b.kind == "speed" then
				speed += b.amount
			elseif b.kind == "jump" then
				jump += b.amount * 0.5
			end
		end
	end
	buffs[player] = active
	hum.WalkSpeed = speed
	hum.UseJumpPower = false
	hum.JumpHeight = jump
	local boost = ""
	for _, b in active do
		boost = b.kind
	end
	player:SetAttribute("Boost", boost)
end

local function foodCount(player: Player): number
	local n = 0
	for _, holder in { player:FindFirstChildOfClass("Backpack"), player.Character } do
		if holder then
			for _, t in holder:GetChildren() do
				local id = t:GetAttribute("ItemId")
				local item = if type(id) == "string" then Items.get(id) else nil
				if t:IsA("Tool") and item and item.kind == "food" then
					n += 1
				end
			end
		end
	end
	return n
end

local function giveFood(player: Player, item: Items.Item)
	local tool = Props.tool(item)
	tool.ToolTip = item.name .. " - click to take a bite"
	tool:SetAttribute("Bites", item.bites or 3)
	local busy = false
	tool.Activated:Connect(function()
		if busy then
			return
		end
		busy = true
		local owner = Players:GetPlayerFromCharacter(tool.Parent :: any)
		if owner then
			local bites = (tool:GetAttribute("Bites") :: number?) or 1
			local per = math.ceil((item.hunger or 20) / (item.bites or 3))
			local hunger = (owner:GetAttribute("Hunger") :: number?) or 0
			owner:SetAttribute("Hunger", math.min(Config.Hunger.Max, hunger + per))
			if item.buff and bites == (item.bites or 3) then
				local list = buffs[owner] or {}
				table.insert(list, { kind = item.buff.kind, amount = item.buff.amount, expires = Clock.now() + item.buff.duration })
				buffs[owner] = list
				PlayerData.notify(owner, string.format("%s boost for %d seconds!", if item.buff.kind == "speed" then "Speed" else "Jump", item.buff.duration), "reward")
			end
			bites -= 1
			if bites <= 0 then
				PlayerData.bumpStat(owner, "Meals")
				PlayerData.notify(owner, "Yum! You finished your " .. item.name .. ".", "info")
				tool:Destroy()
			else
				tool:SetAttribute("Bites", bites)
			end
			refreshMovement(owner)
		end
		task.wait(0.6)
		busy = false
	end)
	tool.Parent = player:FindFirstChildOfClass("Backpack")
end

local function nearVenue(player: Player, venue: Config.Venue): boolean
	local c = player.Character
	local root = c and c:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root then
		return false
	end
	local d = (root.Position - venue.position) * Vector3.new(1, 0, 1)
	return d.Magnitude <= SHOP_RANGE + math.max(venue.size.X, venue.size.Z) / 2
end

local function buy(player: Player, venueId: string, itemId: string)
	local venue = Config.VenueById[venueId]
	local item = Items.get(itemId)
	if not venue or not item or not table.find(venue.items, itemId) then
		return
	end
	if not nearVenue(player, venue) then
		PlayerData.notify(player, "Walk up to the counter at " .. venue.name .. " to buy that.", "warn")
		return
	end
	local slot = Items.slot(item)
	if (slot or item.kind == "held") and PlayerData.owns(player, item.id) then
		PlayerData.notify(player, "You already own the " .. item.name .. ". Equip it from your Bag!", "info")
		return
	end
	if item.kind == "food" and foodCount(player) >= MAX_FOOD then
		PlayerData.notify(player, "Your hands are full! Finish some food first.", "warn")
		return
	end
	if not PlayerData.spend(player, item.price) then
		PlayerData.notify(player, "Not enough " .. Config.Currency .. ". Ride rides and watch shows to earn more!", "warn")
		return
	end
	if item.kind == "pass" then
		local profile = PlayerData.get(player)
		if profile then
			profile.Passes += 1
			PlayerData.sync(player)
		end
		PlayerData.notify(player, "Express Pass added! Use it with [F] at any ride entrance.", "reward")
	elseif item.kind == "food" then
		giveFood(player, item)
		PlayerData.notify(player, "Order up! " .. item.name .. " is in your backpack.", "info")
	elseif item.kind == "held" then
		PlayerData.give(player, item.id)
		Wearables.giveTools(player)
		PlayerData.notify(player, "You bought the " .. item.name .. "! It's in your backpack.", "reward")
	elseif slot then
		PlayerData.give(player, item.id)
		local profile = PlayerData.get(player)
		if profile then
			profile.Equipped[slot] = item.id
			PlayerData.sync(player)
		end
		Wearables.apply(player)
		PlayerData.notify(player, "You bought the " .. item.name .. " and put it on!", "reward")
	end
end

local function equip(player: Player, slot: string, itemId: string?)
	local profile = PlayerData.get(player)
	if not profile or (slot ~= "hat" and slot ~= "face" and slot ~= "balloon") then
		return
	end
	if itemId and itemId ~= "" then
		local item = Items.get(itemId)
		if not item or Items.slot(item) ~= slot or not PlayerData.owns(player, itemId) then
			return
		end
		profile.Equipped[slot] = itemId
	else
		profile.Equipped[slot] = ""
	end
	PlayerData.sync(player)
	Wearables.apply(player)
end

function ShopService.start(venues: { [string]: VenueInfo }, onAction: (Player, any) -> ())
	for id, info in venues do
		info.prompt.Triggered:Connect(function(player)
			Net.remote("OpenVenue"):FireClient(player, id)
		end)
	end
	local action = Net.remote("Action")
	local lastAction: { [Player]: number } = {}
	action.OnServerEvent:Connect(function(player, payload)
		if type(payload) ~= "table" or type(payload.type) ~= "string" then
			return
		end
		-- light rate limit
		local now = Clock.now()
		if lastAction[player] and now - lastAction[player] < 0.15 then
			return
		end
		lastAction[player] = now
		local t = payload.type
		if t == "Buy" and type(payload.venue) == "string" and type(payload.item) == "string" then
			buy(player, payload.venue, payload.item)
		elseif t == "Equip" and type(payload.slot) == "string" then
			equip(player, payload.slot, if type(payload.item) == "string" then payload.item else nil)
		else
			onAction(player, payload)
		end
	end)
	-- hunger drain and movement refresh
	task.spawn(function()
		local tick = 0
		while true do
			task.wait(1)
			tick += 1
			for _, player in Players:GetPlayers() do
				if player:GetAttribute("DataReady") then
					if tick % Config.Hunger.DrainInterval == 0 then
						local h = (player:GetAttribute("Hunger") :: number?) or Config.Hunger.Max
						local nh = math.max(0, h - 1)
						player:SetAttribute("Hunger", nh)
						if nh == Config.Hunger.HungryAt then
							PlayerData.notify(player, "Your tummy is rumbling! Grab a bite at one of the park's restaurants.", "warn")
						elseif nh == 0 and h > 0 then
							PlayerData.notify(player, "You're too hungry to hurry. Eat something to get your speed back!", "warn")
						end
					end
					refreshMovement(player)
				end
			end
		end
	end)
	Players.PlayerRemoving:Connect(function(player)
		buffs[player] = nil
		lastAction[player] = nil
	end)
end

return ShopService
