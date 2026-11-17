-- Shops and restaurants: open-front buildings with a counter, a prompt,
-- item displays, a menu board and (for restaurants) patio seating.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Items = require(Shared.Items)
local Props = require(Shared.Props)
local Staff = require(Shared.Staff)
local Kit = require(script.Parent.Kit)

local M = Enum.Material
local C = Config.Colors

local Venues = {}

local AWNINGS = {
	Plaza = C.Red,
	Diesel = C.Orange,
	Haulers = C.Gold,
	Backwoods = Color3.fromRGB(70, 110, 60),
	Studios = Color3.fromRGB(150, 110, 200),
	Velocity = C.Blue,
	Family = Color3.fromRGB(70, 170, 160),
}

local MATERIALS = {
	Plaza = M.Brick,
	Diesel = M.Brick,
	Haulers = M.SmoothPlastic,
	Backwoods = M.WoodPlanks,
	Studios = M.Concrete,
	Velocity = M.Glass,
	Family = M.WoodPlanks,
}

export type VenueInfo = {
	venue: Config.Venue,
	model: Model,
	prompt: ProximityPrompt,
}

local function menuBoard(parent: Instance, venue: Config.Venue, cf: CFrame)
	local board = Kit.block(parent, Vector3.new(9, 7, 0.4), cf, Color3.fromRGB(28, 28, 32), M.SmoothPlastic)
	board.Name = "MenuBoard"
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 36
	gui.LightInfluence = 0.2
	gui.Parent = board
	local layout = Instance.new("UIListLayout")
	layout.Padding = UDim.new(0.02, 0)
	layout.Parent = gui
	local title = Instance.new("TextLabel")
	title.Size = UDim2.fromScale(1, 0.22)
	title.BackgroundTransparency = 1
	title.Text = if venue.kind == "restaurant" then "MENU" else "TODAY'S DEALS"
	title.TextScaled = true
	title.TextColor3 = C.Gold
	title.FontFace = Font.fromEnum(Enum.Font.GothamBlack)
	title.Parent = gui
	for _, id in venue.items do
		local item = Items.get(id)
		if item then
			local row = Instance.new("TextLabel")
			row.Size = UDim2.fromScale(1, 0.16)
			row.BackgroundTransparency = 1
			row.Text = string.format("%s  -  %s%d", item.name, Config.CurrencyShort, item.price)
			row.TextScaled = true
			row.TextColor3 = C.Cream
			row.FontFace = Font.fromEnum(Enum.Font.GothamBold)
			row.Parent = gui
		end
	end
end

local function build(parent: Instance, venue: Config.Venue): VenueInfo
	local facing = Config.facingVector(venue.facing)
	local pos = venue.position
	local front = Vector3.new(pos.X, 0.4, pos.Z)
	local cf = CFrame.lookAt(front, front + facing)
	local model = Kit.building(parent, cf, {
		size = venue.size,
		wall = venue.color,
		trim = C.Cream,
		roof = Color3.fromRGB(60, 56, 56),
		material = MATERIALS[venue.land] or M.Brick,
		windows = true,
		awning = AWNINGS[venue.land] or C.Red,
		sign = string.upper(venue.name),
		signColors = { C.Navy, C.Cream },
		open = true,
	})
	model.Name = venue.id
	model:SetAttribute("VenueId", venue.id)
	local counter = model:FindFirstChild("Counter") :: Part
	local prompt = Kit.prompt(counter, if venue.kind == "restaurant" then "Order Food" else "Browse Shop", venue.name, Enum.KeyCode.E, 14)
	prompt.Name = "VenuePrompt"
	prompt:SetAttribute("VenueId", venue.id)
	local hz = venue.size.Z / 2
	-- show the goods on the counter
	local n = #venue.items
	for i, id in venue.items do
		local item = Items.get(id)
		if item and item.kind ~= "pass" then
			local preview = Props.preview(item)
			local x = (i - (n + 1) / 2) * math.min(5, (venue.size.X - 10) / n)
			local lift = if item.kind == "balloon" then 4.5 else 4.4
			preview:PivotTo(cf * CFrame.new(x, lift, -hz + 3))
			preview.Parent = model
		end
	end
	-- cashiers behind the counter, facing out
	for k, x in { venue.size.X / 4, -venue.size.X / 5 } do
		local cashier = Staff.place(model, "cashier", venue.land, #venue.id * 31 + k * 7, cf * CFrame.new(x, 0.55, -hz + 5.5))
		cashier.Name = "Cashier"
		cashier:SetAttribute("VenueId", venue.id)
		cashier:SetAttribute("Kind", venue.kind)
	end
	-- sidewalk menu board on legs
	local boardCF = cf * CFrame.new(-venue.size.X / 2 + 4, 0, -hz - 5)
	for _, sx in { -4, 4 } do
		Kit.block(model, Vector3.new(0.4, 5, 0.4), boardCF * CFrame.new(sx, 2.5, 0), Color3.fromRGB(60, 60, 66), M.Metal)
	end
	menuBoard(model, venue, boardCF * CFrame.new(0, 6, 0))
	if venue.kind == "restaurant" then
		local umbrella = AWNINGS[venue.land] or C.Red
		for i = 0, 3 do
			local lateral = (i - 1.5) * 10
			local p = cf * Vector3.new(lateral, 0.4, -hz - 13 - (i % 2) * 7)
			Kit.cafeTable(model, p, umbrella)
		end
	end
	Kit.lamp(model, (cf * CFrame.new(venue.size.X / 2 + 3, 0, -hz - 4)).Position)
	return { venue = venue, model = model, prompt = prompt }
end

function Venues.build(root: Instance): { [string]: VenueInfo }
	local folder = Kit.folder("Venues", root)
	local infos = {}
	for _, venue in Config.Venues do
		infos[venue.id] = build(folder, venue)
	end
	return infos
end

return Venues
