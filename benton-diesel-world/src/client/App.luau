-- The Benton App: the park's on-screen companion. Top bar (clock, Benton
-- Bucks, Express Passes, hunger), a dock of tabs (Wait Times, Map, Shows,
-- Dining, Shops, Passport, Bag), the queue/ride status pill, toasts, land
-- welcome banners and the shop/restaurant counters.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Clock = require(Shared.Clock)
local Items = require(Shared.Items)
local Net = require(Shared.Net)
local Props = require(Shared.Props)

local UI = require(script.Parent.UI)
local Guide = require(script.Parent.Guide)

local App = {}

local C = UI.Colors
local F = UI.Fonts
local player = Players.LocalPlayer

type Profile = {
	Bucks: number,
	Passes: number,
	Owned: { string },
	Equipped: { [string]: string },
	Stamps: { string },
	Stats: { [string]: number },
}

local profile: Profile = { Bucks = 0, Passes = 0, Owned = {}, Equipped = {}, Stamps = {}, Stats = {} }

local gui: ScreenGui
local panel: Frame
local panelTitle: TextLabel
local content: ScrollingFrame
local currentTab: string? = nil
local live: { () -> () } = {}
local dockButtons: { [string]: TextButton } = {}
local toastHolder: Frame
local bannerFrame: Frame
local venueModal: Frame? = nil
local openVenueId: string? = nil

local rideState: Folder
local showState: Folder

local function owns(id: string): boolean
	return table.find(profile.Owned, id) ~= nil
end

local function action(payload: { [string]: any })
	Net.remote("Action"):FireServer(payload)
end

---------------------------------------------------------------------------
-- Toasts and banners
---------------------------------------------------------------------------
local KIND_COLORS = {
	reward = C.Green,
	warn = C.Orange,
	show = Color3.fromRGB(190, 130, 255),
	info = C.Blue,
}

function App.toast(text: string, kind: string?, amount: number?)
	local color = KIND_COLORS[kind or "info"] or C.Blue
	local frame = UI.make("Frame", {
		BackgroundColor3 = C.Panel,
		BackgroundTransparency = 0.05,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		LayoutOrder = -math.floor(os.clock() * 100),
		Parent = toastHolder,
	}, { UI.corner(10), UI.stroke(color, 1.5, 0.3), UI.padding(10) })
	UI.make("Frame", {
		BackgroundColor3 = color,
		BorderSizePixel = 0,
		Size = UDim2.new(0, 4, 1, 0),
		Position = UDim2.new(0, -6, 0, 0),
		Parent = frame,
	}, { UI.corner(2) })
	local msg = text
	if amount and amount ~= 0 then
		msg = string.format("+%d %s  %s", amount, Config.CurrencyShort, text)
	end
	UI.label(msg, 15, C.Cream, F.Bold, { Parent = frame })
	local children = toastHolder:GetChildren()
	local frames = {}
	for _, c in children do
		if c:IsA("Frame") then
			table.insert(frames, c)
		end
	end
	if #frames > 4 then
		table.sort(frames, function(a, b)
			return (a :: Frame).LayoutOrder > (b :: Frame).LayoutOrder
		end)
		for i = 5, #frames do
			frames[i]:Destroy()
		end
	end
	task.delay(5.5, function()
		if frame.Parent then
			frame:Destroy()
		end
	end)
end

local function banner(title: string, subtitle: string, color: Color3)
	bannerFrame.Visible = true
	local titleLabel = bannerFrame:FindFirstChild("Title") :: TextLabel
	local subLabel = bannerFrame:FindFirstChild("Subtitle") :: TextLabel
	local bar = bannerFrame:FindFirstChild("Bar") :: Frame
	titleLabel.Text = string.upper(title)
	titleLabel.TextColor3 = C.Cream
	subLabel.Text = subtitle
	bar.BackgroundColor3 = color
	bannerFrame.Position = UDim2.new(0.5, 0, 0, 40)
	local tween = TweenService:Create(bannerFrame, TweenInfo.new(0.4, Enum.EasingStyle.Back), { Position = UDim2.new(0.5, 0, 0, 70) })
	tween:Play()
	local token = os.clock()
	bannerFrame:SetAttribute("Token", token)
	task.delay(3.5, function()
		if bannerFrame:GetAttribute("Token") == token then
			bannerFrame.Visible = false
		end
	end)
end

---------------------------------------------------------------------------
-- Panel helpers
---------------------------------------------------------------------------
local function clearContent()
	live = {}
	for _, c in content:GetChildren() do
		if not c:IsA("UIListLayout") and not c:IsA("UIPadding") then
			c:Destroy()
		end
	end
	content.CanvasPosition = Vector2.zero
end

local order = 0
local function nextOrder(): number
	order += 1
	return order
end

local function header(text: string, color: Color3?)
	UI.label(text, 18, color or C.Gold, F.Black, { Parent = content, LayoutOrder = nextOrder() })
end

local function note(text: string)
	UI.label(text, 13, C.Muted, F.Medium, { Parent = content, LayoutOrder = nextOrder() })
end

local function guideButton(position: Vector3, name: string, parent: Instance): TextButton
	return UI.button("Guide me", C.Gold, function()
		Guide.set(position, name)
		App.toast("Follow the glowing path to " .. name .. "!", "info")
	end, { Parent = parent, Size = UDim2.new(0, 86, 0, 28), TextSize = 13 })
end

-- A card with a title, subtitle and a right-aligned area.
local function rowCard(title: string, subtitle: string, accent: Color3): (Frame, Frame)
	local card = UI.card({ Parent = content, LayoutOrder = nextOrder() })
	UI.make("Frame", {
		BackgroundColor3 = accent,
		BorderSizePixel = 0,
		Size = UDim2.new(0, 4, 1, 0),
		Position = UDim2.new(0, -10, 0, 0),
		Parent = card,
	})
	local left = UI.make("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, -110, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Parent = card,
	}, { UI.list(2) })
	UI.label(title, 16, C.Cream, F.Black, { Parent = left, LayoutOrder = 1 })
	UI.label(subtitle, 12, C.Muted, F.Medium, { Parent = left, LayoutOrder = 2 })
	local right = UI.make("Frame", {
		BackgroundTransparency = 1,
		AnchorPoint = Vector2.new(1, 0),
		Position = UDim2.new(1, 0, 0, 0),
		Size = UDim2.new(0, 100, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		Parent = card,
	}, { UI.list(4, false, Enum.HorizontalAlignment.Right) })
	return card, right
end

---------------------------------------------------------------------------
-- Tabs
---------------------------------------------------------------------------
local function waitText(folder: Instance?): (string, Color3)
	if not folder then
		return "--", C.Muted
	end
	local wait = folder:GetAttribute("Wait")
	local status = folder:GetAttribute("Status")
	if status == "Closed" or wait == -1 then
		return "CLOSED", C.Red
	end
	if type(wait) ~= "number" then
		return "--", C.Muted
	end
	return wait .. " min", UI.waitColor(wait)
end

local function renderWaits()
	note("Posted waits update live. One park minute is one real second, so a 20 min wait is about 20 seconds. Use an Express Pass [F] to skip the line!")
	local sortBy = panel:GetAttribute("SortWaits") == true
	local sortRow = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 30), LayoutOrder = nextOrder(), Parent = content }, { UI.list(6, true) })
	UI.button(if sortBy then "Sort: shortest wait" else "Sort: by land", C.Card, function()
		panel:SetAttribute("SortWaits", not sortBy)
		App.open("Waits")
	end, { Parent = sortRow, Size = UDim2.new(0, 170, 0, 28), TextSize = 13, TextColor3 = C.Cream })
	local rides = table.clone(Config.Rides)
	if sortBy then
		table.sort(rides, function(a, b)
			local fa, fb = rideState:FindFirstChild(a.id), rideState:FindFirstChild(b.id)
			local wa = if fa then fa:GetAttribute("Wait") else 999
			local wb = if fb then fb:GetAttribute("Wait") else 999
			wa = if type(wa) == "number" and wa >= 0 then wa else 999
			wb = if type(wb) == "number" and wb >= 0 then wb else 999
			return wa < wb
		end)
	end
	local lastLand = ""
	for _, ride in rides do
		local land = Config.landById(ride.land) :: Config.Land
		if not sortBy and ride.land ~= lastLand then
			lastLand = ride.land
			header(land.name, land.color)
		end
		local subtitle = string.format("%s  %s  |  %s", ride.category, UI.stars(ride.thrill), if sortBy then land.name else ride.kind)
		local _, right = rowCard(ride.name, subtitle, land.color)
		local waitLabel = UI.label("--", 20, C.Cream, F.Black, { Parent = right, LayoutOrder = 1, TextXAlignment = Enum.TextXAlignment.Right })
		guideButton(ride.entrance, ride.name, right).LayoutOrder = 2
		local folder = rideState:FindFirstChild(ride.id)
		table.insert(live, function()
			local text, color = waitText(folder)
			waitLabel.Text = text
			waitLabel.TextColor3 = color
		end)
	end
end

local MAP_W = Config.Bounds.maxX - Config.Bounds.minX
local MAP_H = Config.Bounds.maxZ - Config.Bounds.minZ

local function mapPos(x: number, z: number): UDim2
	return UDim2.fromScale((x - Config.Bounds.minX) / MAP_W, (z - Config.Bounds.minZ) / MAP_H)
end

local function renderMap()
	note("Tap a ride, show or restaurant to get directions.")
	local holder = UI.make("Frame", {
		BackgroundColor3 = Color3.fromRGB(70, 130, 70),
		Size = UDim2.fromOffset(392, math.floor(392 * MAP_H / MAP_W)),
		LayoutOrder = nextOrder(),
		Parent = content,
		ClipsDescendants = true,
	}, { UI.corner(10) })
	-- lands
	for _, land in Config.Lands do
		for _, r in land.regions do
			UI.make("Frame", {
				BackgroundColor3 = land.color,
				BackgroundTransparency = 0.45,
				BorderSizePixel = 0,
				Position = mapPos(r[1], r[2]),
				Size = UDim2.fromScale((r[3] - r[1]) / MAP_W, (r[4] - r[2]) / MAP_H),
				Parent = holder,
			})
		end
		UI.make("TextLabel", {
			BackgroundTransparency = 1,
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = mapPos(land.center.X, land.center.Z),
			Size = UDim2.new(0.3, 0, 0, 16),
			Text = string.upper(land.name),
			TextScaled = true,
			TextColor3 = Color3.new(1, 1, 1),
			TextTransparency = 0.15,
			FontFace = F.Black,
			ZIndex = 2,
			Parent = holder,
		}, { UI.stroke(Color3.new(0, 0, 0), 1.5, 0.4) })
	end
	-- main street, hub and lake
	UI.make("Frame", { BackgroundColor3 = Config.Colors.Paver, BorderSizePixel = 0, Position = mapPos(-26, -4), Size = UDim2.fromScale(52 / MAP_W, 230 / MAP_H), Parent = holder })
	UI.make("Frame", { BackgroundColor3 = Config.Colors.Paver, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = mapPos(0, -60), Size = UDim2.fromScale(124 / MAP_W, 124 / MAP_H), Parent = holder }, { UI.corner(999) })
	UI.make("Frame", { BackgroundColor3 = Color3.fromRGB(60, 130, 200), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = mapPos(235, 125), Size = UDim2.fromScale(100 / MAP_W, 100 / MAP_H), Parent = holder }, { UI.corner(999) })
	local function pin(pos: Vector3, color: Color3, name: string, size: number, round: boolean)
		local b = UI.make("TextButton", {
			Text = "",
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = mapPos(pos.X, pos.Z),
			Size = UDim2.fromOffset(size, size),
			BackgroundColor3 = color,
			ZIndex = 3,
			Parent = holder,
		}, { UI.corner(if round then 999 else 3), UI.stroke(Color3.new(1, 1, 1), 1.5, 0) })
		b.Activated:Connect(function()
			Guide.set(pos, name)
			App.toast("Directions to " .. name .. " - follow the glowing path!", "info")
		end)
		UI.make("TextLabel", {
			BackgroundTransparency = 1,
			Position = UDim2.new(1, 2, 0, -2),
			Size = UDim2.fromOffset(120, 12),
			Text = name,
			TextSize = 10,
			TextXAlignment = Enum.TextXAlignment.Left,
			TextColor3 = Color3.new(1, 1, 1),
			FontFace = F.Bold,
			ZIndex = 4,
			Parent = b,
		}, { UI.stroke(Color3.new(0, 0, 0), 1, 0.3) })
	end
	for _, ride in Config.Rides do
		pin(ride.entrance, C.Orange, ride.name, 11, true)
	end
	for _, venue in Config.Venues do
		pin(venue.position, if venue.kind == "restaurant" then C.Red else C.Blue, venue.name, 8, false)
	end
	for _, show in Config.Shows do
		if show.id == "BigDreams" or show.id == "StuntSpectacular" then
			pin(show.viewing, Color3.fromRGB(190, 130, 255), show.venue, 9, true)
		end
	end
	local me = UI.make("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Size = UDim2.fromOffset(14, 14),
		BackgroundColor3 = Color3.new(1, 1, 1),
		ZIndex = 6,
		Parent = holder,
	}, { UI.corner(999), UI.stroke(C.Navy, 3, 0) })
	local legend = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 20), LayoutOrder = nextOrder(), Parent = content }, { UI.list(12, true) })
	for _, l in { { "Rides", C.Orange }, { "Food", C.Red }, { "Shops", C.Blue }, { "Shows", Color3.fromRGB(190, 130, 255) }, { "You", Color3.new(1, 1, 1) } } do
		UI.label("● " .. (l[1] :: string), 12, l[2] :: Color3, F.Bold, { Parent = legend, Size = UDim2.new(0, 60, 0, 16), AutomaticSize = Enum.AutomaticSize.X })
	end
	table.insert(live, function()
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if root then
			me.Position = mapPos(root.Position.X, root.Position.Z)
		end
	end)
end

local function showStatus(show: Config.Show): (string, Color3)
	local folder = showState:FindFirstChild(show.id)
	if folder and folder:GetAttribute("Running") then
		return "NOW PLAYING!", C.Green
	end
	local best, bestTime = math.huge, 0
	for _, t in show.times do
		local s = Clock.secondsUntil(t)
		if s < best then
			best, bestTime = s, t
		end
	end
	return string.format("Next show %s  (in %d min)", Clock.format(bestTime), math.ceil(best)), C.Gold
end

local function renderShows()
	note("Watch a show from the audience area to earn " .. Config.Economy.ShowReward .. " " .. Config.Currency .. ".")
	for _, show in Config.Shows do
		local land = Config.landById(show.land) :: Config.Land
		local _, right = rowCard(show.name, show.venue .. "  |  " .. show.description, land.color)
		local status = UI.label("", 12, C.Gold, F.Black, { Parent = right, LayoutOrder = 1, TextXAlignment = Enum.TextXAlignment.Right })
		guideButton(show.viewing, show.name, right).LayoutOrder = 2
		local times = {}
		for _, t in show.times do
			table.insert(times, Clock.format(t))
		end
		UI.label("Showtimes: " .. table.concat(times, ", "), 12, C.Muted, F.Medium, { Parent = content, LayoutOrder = nextOrder() })
		table.insert(live, function()
			local text, color = showStatus(show)
			status.Text = text
			status.TextColor3 = color
		end)
	end
end

local function itemLine(item: Items.Item): string
	local extra = ""
	if item.kind == "food" then
		extra = string.format("  |  +%d hunger", item.hunger or 0)
		if item.buff then
			extra ..= if item.buff.kind == "speed" then "  |  SPEED BOOST" else "  |  JUMP BOOST"
		end
	elseif owns(item.id) then
		extra = "  |  OWNED"
	end
	return string.format("%s  -  %s%d%s", item.name, Config.CurrencyShort, item.price, extra)
end

local function renderVenues(kind: string)
	note(if kind == "restaurant"
		then "Hungry guests walk slower. Eat at any restaurant to fill up - some treats give speed or jump boosts!"
		else "Souvenirs are saved to your Bag. Wear hats, shades and balloons, and carry toys around the park.")
	for _, venue in Config.Venues do
		if venue.kind == kind then
			local land = Config.landById(venue.land) :: Config.Land
			local _, right = rowCard(venue.name, land.name .. "  |  " .. venue.description, land.color)
			guideButton(venue.position + Config.facingVector(venue.facing) * (venue.size.Z / 2 + 6), venue.name, right)
			for _, id in venue.items do
				local item = Items.get(id)
				if item then
					UI.label("  " .. itemLine(item), 12, C.Cream, F.Medium, { Parent = content, LayoutOrder = nextOrder() })
				end
			end
		end
	end
end

local function renderPassport()
	local stamped = 0
	for _, ride in Config.Rides do
		if table.find(profile.Stamps, ride.id) then
			stamped += 1
		end
	end
	header(string.format("Park Passport  %d / %d", stamped, #Config.Rides))
	note(string.format("Ride every attraction to collect its stamp (+%d bonus). Finish a whole land for +%d!", Config.Economy.FirstRideBonus, Config.Economy.LandCompleteBonus))
	local grid = UI.make("Frame", {
		BackgroundTransparency = 1,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		LayoutOrder = nextOrder(),
		Parent = content,
	})
	UI.make("UIGridLayout", { CellSize = UDim2.new(0.5, -5, 0, 64), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = grid })
	for i, ride in Config.Rides do
		local land = Config.landById(ride.land) :: Config.Land
		local has = table.find(profile.Stamps, ride.id) ~= nil
		local tile = UI.make("Frame", {
			BackgroundColor3 = if has then land.color else C.Card,
			BackgroundTransparency = if has then 0.1 else 0,
			LayoutOrder = i,
			Parent = grid,
		}, { UI.corner(10), UI.padding(8), UI.stroke(if has then C.Gold else C.Muted, 2, if has then 0 else 0.7) })
		UI.label((if has then "✔ " else "") .. ride.name, 13, if has then Color3.new(1, 1, 1) else C.Muted, F.Black, { Parent = tile })
		UI.label(land.name, 11, if has then C.Cream else C.Muted, F.Medium, { Parent = tile, Position = UDim2.new(0, 0, 1, -14) })
	end
	local stats = profile.Stats
	header("Your day so far")
	note(string.format("Rides taken: %d   |   Shows watched: %d   |   Meals eaten: %d", stats.Rides or 0, stats.Shows or 0, stats.Meals or 0))
end

local SLOT_NAMES = { hat = "Hats", face = "Shades", balloon = "Balloons" }

local function renderBag()
	header(string.format("%s %d   |   Express Passes: %d", Config.CurrencyShort, profile.Bucks, profile.Passes))
	note("Earn Benton Bucks by riding rides, watching shows and spending time in the park.")
	for _, slot in { "hat", "face", "balloon" } do
		header(SLOT_NAMES[slot], C.Cream)
		local any = false
		for _, id in profile.Owned do
			local item = Items.get(id)
			if item and Items.slot(item) == slot then
				any = true
				local equipped = profile.Equipped[slot] == id
				local _, right = rowCard(item.name, item.description, item.colors[1])
				UI.button(if equipped then "Take off" else "Wear", if equipped then C.Card else C.Orange, function()
					action({ type = "Equip", slot = slot, item = if equipped then "" else id })
				end, { Parent = right, Size = UDim2.new(0, 90, 0, 30), TextColor3 = if equipped then C.Cream else C.Navy })
			end
		end
		if not any then
			note("None yet - check the shops!")
		end
	end
	header("Toys & tools", C.Cream)
	local anyHeld = false
	for _, id in profile.Owned do
		local item = Items.get(id)
		if item and item.kind == "held" then
			anyHeld = true
			note("• " .. item.name .. " (in your backpack)")
		end
	end
	if not anyHeld then
		note("None yet.")
	end
end

local RENDER: { [string]: () -> () } = {
	Waits = renderWaits,
	Map = renderMap,
	Shows = renderShows,
	Dining = function()
		renderVenues("restaurant")
	end,
	Shops = function()
		renderVenues("shop")
	end,
	Passport = renderPassport,
	Bag = renderBag,
}

local TABS = {
	{ id = "Waits", icon = "⏱", label = "Wait Times" },
	{ id = "Map", icon = "🗺", label = "Park Map" },
	{ id = "Shows", icon = "🎭", label = "Shows" },
	{ id = "Dining", icon = "🍔", label = "Dining" },
	{ id = "Shops", icon = "🛍", label = "Shops" },
	{ id = "Passport", icon = "📘", label = "Passport" },
	{ id = "Bag", icon = "🎒", label = "My Bag" },
}

function App.open(tab: string?)
	if tab == nil then
		panel.Visible = false
		currentTab = nil
	else
		currentTab = tab
		panel.Visible = true
		for _, t in TABS do
			if t.id == tab then
				panelTitle.Text = t.icon .. "  " .. t.label
			end
		end
		clearContent()
		order = 0
		RENDER[tab]()
		for _, fn in live do
			fn()
		end
	end
	for id, b in dockButtons do
		b.BackgroundColor3 = if id == currentTab then C.Orange else C.Panel
	end
end

---------------------------------------------------------------------------
-- Shop / restaurant counter
---------------------------------------------------------------------------
local function preview(item: Items.Item, parent: Instance)
	local vp = UI.make("ViewportFrame", {
		BackgroundColor3 = Color3.fromRGB(44, 58, 92),
		Size = UDim2.new(1, 0, 0, 92),
		Ambient = Color3.fromRGB(170, 170, 180),
		LightColor = Color3.new(1, 1, 1),
		LightDirection = Vector3.new(-1, -2, -1),
		LayoutOrder = 1,
		Parent = parent,
	}, { UI.corner(8) })
	local ok, model = pcall(Props.preview, item)
	if not ok then
		return
	end
	model.Parent = vp
	local cam = Instance.new("Camera")
	cam.FieldOfView = 40
	cam.Parent = vp
	vp.CurrentCamera = cam
	local center, size = model:GetBoundingBox()
	local dist = math.max(size.Magnitude, 1) * 1.5
	cam.CFrame = CFrame.lookAt(center.Position + Vector3.new(0.7, 0.55, -1).Unit * dist, center.Position)
end

local function closeVenue()
	if venueModal then
		venueModal:Destroy()
		venueModal = nil
	end
	openVenueId = nil
end

local function openVenue(venueId: string)
	closeVenue()
	local venue = Config.VenueById[venueId]
	if not venue then
		return
	end
	openVenueId = venueId
	local land = Config.landById(venue.land) :: Config.Land
	local modal = UI.make("Frame", {
		Name = "VenueModal",
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.52),
		Size = UDim2.new(0.92, 0, 0.78, 0),
		BackgroundColor3 = C.Navy,
		ZIndex = 20,
		Parent = gui,
	}, { UI.corner(16), UI.stroke(land.color, 3, 0), UI.padding(14) })
	UI.make("UISizeConstraint", { MaxSize = Vector2.new(760, 520), Parent = modal })
	venueModal = modal
	UI.label(venue.name, 24, C.Cream, F.Black, { Parent = modal, Size = UDim2.new(1, -50, 0, 28), AutomaticSize = Enum.AutomaticSize.None })
	UI.label(venue.description .. "   |   You have " .. Config.CurrencyShort .. profile.Bucks, 13, C.Muted, F.Medium, {
		Parent = modal,
		Position = UDim2.new(0, 0, 0, 30),
		Size = UDim2.new(1, -50, 0, 18),
		AutomaticSize = Enum.AutomaticSize.None,
	})
	UI.button("X", C.Red, closeVenue, { Parent = modal, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, 0, 0, 0), Size = UDim2.fromOffset(36, 36), TextColor3 = Color3.new(1, 1, 1) })
	local scroller = UI.make("ScrollingFrame", {
		BackgroundTransparency = 1,
		Position = UDim2.new(0, 0, 0, 56),
		Size = UDim2.new(1, 0, 1, -56),
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 6,
		BorderSizePixel = 0,
		Parent = modal,
	})
	UI.make("UIGridLayout", { CellSize = UDim2.fromOffset(170, 232), CellPadding = UDim2.fromOffset(10, 10), SortOrder = Enum.SortOrder.LayoutOrder, Parent = scroller })
	for i, id in venue.items do
		local item = Items.get(id)
		if item then
			local card = UI.make("Frame", { BackgroundColor3 = C.Card, LayoutOrder = i, Parent = scroller }, { UI.corner(12), UI.padding(8), UI.list(4) })
			preview(item, card)
			UI.label(item.name, 14, C.Cream, F.Black, { Parent = card, LayoutOrder = 2 })
			UI.label(item.description, 11, C.Muted, F.Medium, { Parent = card, LayoutOrder = 3, Size = UDim2.new(1, 0, 0, 40), AutomaticSize = Enum.AutomaticSize.None })
			local owned = (Items.slot(item) ~= nil or item.kind == "held") and owns(item.id)
			local text = if owned then "Owned" else string.format("Buy  %s%d", Config.CurrencyShort, item.price)
			UI.button(text, if owned then C.Card else C.Orange, function()
				if owned then
					App.open("Bag")
					closeVenue()
					return
				end
				action({ type = "Buy", venue = venue.id, item = item.id })
			end, { Parent = card, LayoutOrder = 4, Size = UDim2.new(1, 0, 0, 30), TextColor3 = if owned then C.Cream else C.Navy })
		end
	end
end

---------------------------------------------------------------------------
-- Build
---------------------------------------------------------------------------
local function buildTopBar(): (TextLabel, TextLabel, TextLabel, Frame, TextLabel)
	local bar = UI.make("Frame", {
		Name = "TopBar",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 6),
		Size = UDim2.new(0, 0, 0, 40),
		AutomaticSize = Enum.AutomaticSize.X,
		BackgroundColor3 = C.Navy,
		BackgroundTransparency = 0.1,
		Parent = gui,
	}, { UI.corner(20), UI.stroke(C.Orange, 1.5, 0.4), UI.padding(14, 0), UI.list(14, true) })
	UI.label("⚙ BENTON DIESEL WORLD", 14, C.Orange, F.Black, { Parent = bar, LayoutOrder = 1, Size = UDim2.new(0, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false })
	local clock = UI.label("9:00 AM", 15, C.Cream, F.Bold, { Parent = bar, LayoutOrder = 2, Size = UDim2.new(0, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false })
	local bucks = UI.label(Config.CurrencyShort .. "0", 16, C.Gold, F.Black, { Parent = bar, LayoutOrder = 3, Size = UDim2.new(0, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false })
	local passes = UI.label("🎫 0", 15, C.Cream, F.Bold, { Parent = bar, LayoutOrder = 4, Size = UDim2.new(0, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false })
	local hungerHolder = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(0, 110, 1, 0), LayoutOrder = 5, Parent = bar })
	UI.label("🍔", 15, C.Cream, F.Bold, { Parent = hungerHolder, Size = UDim2.new(0, 20, 1, 0), AutomaticSize = Enum.AutomaticSize.None })
	local track = UI.make("Frame", { BackgroundColor3 = Color3.fromRGB(50, 56, 70), Position = UDim2.new(0, 24, 0.5, -5), Size = UDim2.new(1, -24, 0, 10), Parent = hungerHolder }, { UI.corner(5) })
	local fill = UI.make("Frame", { BackgroundColor3 = C.Green, Size = UDim2.fromScale(1, 1), Parent = track }, { UI.corner(5) })
	local boost = UI.label("", 15, C.Yellow, F.Black, { Parent = bar, LayoutOrder = 6, Size = UDim2.new(0, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false })
	return clock, bucks, passes, fill, boost
end

local function buildDock()
	local dock = UI.make("Frame", {
		Name = "Dock",
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(0, 10, 0.42, 0),
		Size = UDim2.new(0, 64, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		Parent = gui,
	}, { UI.list(6) })
	for i, t in TABS do
		local b = UI.make("TextButton", {
			Name = t.id,
			Text = "",
			LayoutOrder = i,
			Size = UDim2.fromOffset(64, 54),
			BackgroundColor3 = C.Panel,
			BackgroundTransparency = 0.05,
			AutoButtonColor = true,
			Parent = dock,
		}, { UI.corner(12), UI.stroke(C.Orange, 1, 0.6) })
		UI.make("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 30), Position = UDim2.new(0, 0, 0, 4), Text = t.icon, TextSize = 24, FontFace = F.Bold, TextColor3 = Color3.new(1, 1, 1), Parent = b })
		UI.make("TextLabel", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 14), Position = UDim2.new(0, 0, 1, -17), Text = t.label, TextSize = 10, FontFace = F.Bold, TextColor3 = C.Cream, Parent = b })
		b.Activated:Connect(function()
			if currentTab == t.id then
				App.open(nil)
			else
				App.open(t.id)
			end
		end)
		dockButtons[t.id] = b
	end
end

local function buildPanel()
	panel = UI.make("Frame", {
		Name = "Panel",
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, -12, 0.54, 0),
		Size = UDim2.new(0, 420, 0.78, 0),
		BackgroundColor3 = C.Navy,
		BackgroundTransparency = 0.04,
		Visible = false,
		Parent = gui,
	}, { UI.corner(16), UI.stroke(C.Orange, 1.5, 0.5) })
	panelTitle = UI.label("", 20, C.Cream, F.Black, { Parent = panel, Position = UDim2.new(0, 14, 0, 10), Size = UDim2.new(1, -70, 0, 26), AutomaticSize = Enum.AutomaticSize.None })
	UI.button("X", C.Red, function()
		App.open(nil)
	end, { Parent = panel, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -10, 0, 8), Size = UDim2.fromOffset(32, 32), TextColor3 = Color3.new(1, 1, 1) })
	content = UI.make("ScrollingFrame", {
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Position = UDim2.new(0, 0, 0, 46),
		Size = UDim2.new(1, 0, 1, -50),
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 6,
		ScrollingDirection = Enum.ScrollingDirection.Y,
		Parent = panel,
	}, { UI.list(8), UI.padding(12, 4) })
end

local function buildQueuePill(): (Frame, TextLabel, TextButton)
	local pill = UI.make("Frame", {
		Name = "QueuePill",
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -18),
		Size = UDim2.new(0, 0, 0, 44),
		AutomaticSize = Enum.AutomaticSize.X,
		BackgroundColor3 = C.Navy,
		BackgroundTransparency = 0.05,
		Visible = false,
		Parent = gui,
	}, { UI.corner(22), UI.stroke(C.Gold, 2, 0.2), UI.padding(16, 0), UI.list(12, true) })
	local label = UI.label("", 15, C.Cream, F.Bold, { Parent = pill, LayoutOrder = 1, Size = UDim2.new(0, 0, 1, 0), AutomaticSize = Enum.AutomaticSize.X, TextWrapped = false })
	local leave = UI.button("Leave line", C.Red, function()
		action({ type = "LeaveQueue" })
	end, { Parent = pill, LayoutOrder = 2, Size = UDim2.fromOffset(100, 30), TextColor3 = Color3.new(1, 1, 1), TextSize = 13 })
	return pill, label, leave
end

local function buildBanner()
	bannerFrame = UI.make("Frame", {
		Name = "LandBanner",
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 70),
		Size = UDim2.new(0, 460, 0, 74),
		BackgroundColor3 = C.Navy,
		BackgroundTransparency = 0.15,
		Visible = false,
		Parent = gui,
	}, { UI.corner(14) })
	UI.label("WELCOME TO", 12, C.Muted, F.Bold, { Name = "Small", Parent = bannerFrame, Position = UDim2.new(0, 0, 0, 6), TextXAlignment = Enum.TextXAlignment.Center, AutomaticSize = Enum.AutomaticSize.None })
	UI.label("", 26, C.Cream, F.Black, { Name = "Title", Parent = bannerFrame, Position = UDim2.new(0, 0, 0, 20), TextXAlignment = Enum.TextXAlignment.Center, AutomaticSize = Enum.AutomaticSize.None })
	UI.label("", 13, C.Gold, F.Medium, { Name = "Subtitle", Parent = bannerFrame, Position = UDim2.new(0, 0, 0, 50), TextXAlignment = Enum.TextXAlignment.Center, AutomaticSize = Enum.AutomaticSize.None })
	UI.make("Frame", { Name = "Bar", BackgroundColor3 = C.Orange, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, 0), Size = UDim2.new(0.6, 0, 0, 4), Parent = bannerFrame })
end

function App.start()
	rideState = Net.state():WaitForChild("Rides") :: Folder
	showState = Net.state():WaitForChild("Shows") :: Folder
	gui = UI.make("ScreenGui", {
		Name = "BentonApp",
		ResetOnSpawn = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		Parent = player:WaitForChild("PlayerGui"),
	})
	local scale = UI.make("UIScale", { Parent = gui })
	local function rescale()
		local cam = workspace.CurrentCamera
		if cam then
			local v = cam.ViewportSize
			scale.Scale = math.clamp(math.min(v.X / 1280, v.Y / 760), 0.55, 1.1)
		end
	end
	rescale()
	if workspace.CurrentCamera then
		workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
	end

	local clock, bucks, passes, hungerFill, boostLabel = buildTopBar()
	buildDock()
	buildPanel()
	local pill, pillLabel, leaveButton = buildQueuePill()
	buildBanner()
	toastHolder = UI.make("Frame", {
		Name = "Toasts",
		AnchorPoint = Vector2.new(1, 1),
		Position = UDim2.new(1, -12, 1, -80),
		Size = UDim2.new(0, 330, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		Parent = gui,
	}, { UI.list(6) })
	local toastList = toastHolder:FindFirstChildOfClass("UIListLayout")
	if toastList then
		toastList.VerticalAlignment = Enum.VerticalAlignment.Bottom
	end

	local function refreshStats()
		local b = player:GetAttribute("Bucks")
		bucks.Text = Config.CurrencyShort .. tostring(if type(b) == "number" then b else profile.Bucks)
		local p = player:GetAttribute("Passes")
		passes.Text = "🎫 " .. tostring(if type(p) == "number" then p else 0)
		local h = player:GetAttribute("Hunger")
		local frac = math.clamp((if type(h) == "number" then h else Config.Hunger.Max) / Config.Hunger.Max, 0, 1)
		hungerFill.Size = UDim2.fromScale(frac, 1)
		hungerFill.BackgroundColor3 = if frac > 0.5 then C.Green elseif frac > 0.25 then C.Yellow else C.Red
		local boost = player:GetAttribute("Boost")
		boostLabel.Text = if boost == "speed" then "⚡ SPEED" elseif boost == "jump" then "🦘 JUMP" else ""
	end
	for _, attr in { "Bucks", "Passes", "Hunger", "Boost" } do
		player:GetAttributeChangedSignal(attr):Connect(refreshStats)
	end
	refreshStats()

	Net.remote("Profile").OnClientEvent:Connect(function(data)
		if type(data) == "table" then
			profile = data :: any
			profile.Owned = profile.Owned or {}
			profile.Equipped = profile.Equipped or {}
			profile.Stamps = profile.Stamps or {}
			profile.Stats = profile.Stats or {}
			if currentTab == "Bag" or currentTab == "Passport" or currentTab == "Shops" then
				App.open(currentTab)
			end
			if openVenueId then
				openVenue(openVenueId)
			end
		end
	end)
	Net.remote("Notify").OnClientEvent:Connect(function(data)
		if type(data) == "table" and type(data.text) == "string" then
			App.toast(data.text, data.kind, data.amount)
		end
	end)
	Net.remote("OpenVenue").OnClientEvent:Connect(function(id)
		if type(id) == "string" then
			openVenue(id)
		end
	end)
	Guide.onArrive(function(name)
		App.toast("You've arrived at " .. name .. "!", "info")
	end)

	-- live updates: clock, queue pill, land banner, open tab
	local lastLand: string? = nil
	local etaDeadline = 0
	local function refreshQueue()
		local riding = player:GetAttribute("Riding")
		local queueRide = player:GetAttribute("QueueRide")
		if type(riding) == "string" and riding ~= "" then
			local ride = Config.RideById[riding]
			pill.Visible = true
			leaveButton.Visible = false
			pillLabel.Text = "🎢  Enjoy " .. (if ride then ride.name else "the ride") .. "!  Keep your hands inside."
		elseif type(queueRide) == "string" and queueRide ~= "" then
			local ride = Config.RideById[queueRide]
			local pos = player:GetAttribute("QueuePos")
			local remaining = math.max(0, math.ceil(etaDeadline - os.clock()))
			pill.Visible = true
			leaveButton.Visible = true
			pillLabel.Text = string.format("🎟  In line: %s  |  #%s  |  boarding in ~%ds", if ride then ride.name else queueRide, tostring(pos or "?"), remaining)
		else
			pill.Visible = false
		end
	end
	player:GetAttributeChangedSignal("QueueEta"):Connect(function()
		local eta = player:GetAttribute("QueueEta")
		etaDeadline = os.clock() + (if type(eta) == "number" then eta else 0)
		refreshQueue()
	end)
	for _, attr in { "Riding", "QueueRide", "QueuePos" } do
		player:GetAttributeChangedSignal(attr):Connect(refreshQueue)
	end

	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc < 0.5 then
			return
		end
		acc = 0
		local minute = Clock.minutes()
		clock.Text = "🕒 " .. Clock.format(minute)
		refreshQueue()
		for _, fn in live do
			fn()
		end
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if root then
			local land = Config.landAt(root.Position)
			local id = if land then land.id else nil
			if id ~= lastLand then
				lastLand = id
				if land then
					banner(land.name, land.tagline, land.color)
				end
			end
		end
	end)

	task.delay(2, function()
		App.toast("Welcome to Benton Diesel World! Open the Wait Times tab to plan your day.", "info")
	end)
end

return App
