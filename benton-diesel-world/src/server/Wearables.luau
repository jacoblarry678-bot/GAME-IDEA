-- Puts purchased souvenirs on characters: hats and shades as Accessories,
-- balloons floating on a rope from the left hand, and held souvenirs as
-- Tools in the Backpack.

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Items = require(Shared.Items)
local Props = require(Shared.Props)

local PlayerData = require(script.Parent.PlayerData)

local Wearables = {}

local TAG = "BentonWearable"

local function clear(character: Model, onlyBalloon: boolean?)
	for _, child in character:GetChildren() do
		if child:GetAttribute(TAG) then
			if not onlyBalloon or child:GetAttribute(TAG) == "balloon" then
				child:Destroy()
			end
		end
	end
end

local function attachBalloon(character: Model, item: Items.Item)
	local hand = character:FindFirstChild("LeftGripAttachment", true) :: Attachment?
	local root = character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hand or not root then
		return
	end
	local model = Props.balloon(item)
	model:SetAttribute(TAG, "balloon")
	local balloon = model.PrimaryPart :: BasePart
	model:PivotTo(root.CFrame * CFrame.new(-1.5, 7, 1))
	local rope = Instance.new("RopeConstraint")
	rope.Attachment0 = hand
	rope.Attachment1 = balloon:FindFirstChild("StringAttachment") :: Attachment
	rope.Length = 7
	rope.Visible = true
	rope.Thickness = 0.06
	rope.Color = BrickColor.new("Institutional white")
	rope.Parent = balloon
	local center = Instance.new("Attachment")
	center.Name = "LiftAttachment"
	center.Parent = balloon
	local lift = Instance.new("VectorForce")
	lift.Attachment0 = center
	lift.RelativeTo = Enum.ActuatorRelativeTo.World
	lift.ApplyAtCenterOfMass = true
	lift.Force = Vector3.new(0, balloon:GetMass() * workspace.Gravity * 1.35, 0)
	lift.Parent = balloon
	model.Parent = character
	pcall(function()
		local player = Players:GetPlayerFromCharacter(character)
		if player then
			balloon:SetNetworkOwner(player)
		end
	end)
end

function Wearables.apply(player: Player)
	local character = player.Character
	local profile = PlayerData.get(player)
	if not character or not profile then
		return
	end
	local hum = character:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
	clear(character)
	for _, slot in { "hat", "face" } do
		local id = profile.Equipped[slot]
		local item = if id and id ~= "" then Items.get(id) else nil
		if item and PlayerData.owns(player, item.id) then
			local acc = Props.accessory(item)
			acc:SetAttribute(TAG, slot)
			hum:AddAccessory(acc)
		end
	end
	if not player:GetAttribute("Riding") or player:GetAttribute("Riding") == "" then
		local id = profile.Equipped.balloon
		local item = if id and id ~= "" then Items.get(id) else nil
		if item and PlayerData.owns(player, item.id) then
			attachBalloon(character, item)
		end
	end
end

function Wearables.hideBalloon(character: Model)
	clear(character, true)
end

function Wearables.showBalloon(player: Player)
	local character = player.Character
	local profile = PlayerData.get(player)
	if not character or not profile then
		return
	end
	clear(character, true)
	local id = profile.Equipped.balloon
	local item = if id and id ~= "" then Items.get(id) else nil
	if item and PlayerData.owns(player, item.id) then
		attachBalloon(character, item)
	end
end

-- Give the player Tools for every held souvenir they own.
function Wearables.giveTools(player: Player)
	local backpack = player:FindFirstChildOfClass("Backpack")
	local profile = PlayerData.get(player)
	if not backpack or not profile then
		return
	end
	for _, id in profile.Owned do
		local item = Items.get(id)
		if item and item.kind == "held" then
			local has = false
			for _, holder in { backpack, player.Character } do
				if holder then
					for _, t in holder:GetChildren() do
						if t:IsA("Tool") and t:GetAttribute("ItemId") == id then
							has = true
						end
					end
				end
			end
			if not has then
				Props.tool(item).Parent = backpack
			end
		end
	end
end

function Wearables.start()
	local function hook(player: Player)
		player.CharacterAdded:Connect(function(character)
			character:WaitForChild("HumanoidRootPart", 10)
			character:WaitForChild("Humanoid", 10)
			task.wait(0.5)
			if player.Character == character then
				Wearables.apply(player)
				Wearables.giveTools(player)
			end
		end)
		if player.Character then
			Wearables.apply(player)
			Wearables.giveTools(player)
		end
	end
	PlayerData.onReady(hook)
end

return Wearables
