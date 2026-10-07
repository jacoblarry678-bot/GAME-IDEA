-- Building kit: small helpers the land builders use to put the park
-- together out of plain parts.

local Kit = {}

local HALF_PI = math.pi / 2
local M = Enum.Material

Kit.rng = Random.new(20240601)

export type SignOptions = {
	bg: Color3?,
	fg: Color3?,
	font: Enum.Font?,
	both: boolean?,
	stroke: Color3?,
	glow: boolean?,
	material: Enum.Material?,
	transparentBg: boolean?,
}

function Kit.folder(name: string, parent: Instance): Folder
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

function Kit.model(name: string, parent: Instance): Model
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

local function finish(part: BasePart, parent: Instance, color: Color3, material: Enum.Material?)
	part.Anchored = true
	part.Color = color
	part.Material = material or M.SmoothPlastic
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
end

-- Box part centered at cf.
function Kit.block(parent: Instance, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material?): Part
	local p = Instance.new("Part")
	p.Size = size
	p.CFrame = cf
	finish(p, parent, color, material)
	return p
end

-- Box sitting on the ground: `pos` is the bottom-center.
function Kit.box(parent: Instance, size: Vector3, pos: Vector3, color: Color3, material: Enum.Material?, yaw: number?): Part
	local cf = CFrame.new(pos + Vector3.new(0, size.Y / 2, 0)) * CFrame.Angles(0, math.rad(yaw or 0), 0)
	return Kit.block(parent, size, cf, color, material)
end

-- Cylinder whose axis runs along cf's X axis.
function Kit.cyl(parent: Instance, length: number, diameter: number, cf: CFrame, color: Color3, material: Enum.Material?): Part
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(length, diameter, diameter)
	p.CFrame = cf
	finish(p, parent, color, material)
	return p
end

-- Upright cylinder standing on `base` (bottom center).
function Kit.post(parent: Instance, height: number, diameter: number, base: Vector3, color: Color3, material: Enum.Material?): Part
	return Kit.cyl(parent, height, diameter, CFrame.new(base + Vector3.new(0, height / 2, 0)) * CFrame.Angles(0, 0, HALF_PI), color, material)
end

-- Flat disc lying on the ground, top at `top`.
function Kit.disc(parent: Instance, diameter: number, thickness: number, center: Vector3, color: Color3, material: Enum.Material?): Part
	return Kit.cyl(parent, thickness, diameter, CFrame.new(center - Vector3.new(0, thickness / 2, 0)) * CFrame.Angles(0, 0, HALF_PI), color, material)
end

function Kit.ball(parent: Instance, diameter: number, pos: Vector3, color: Color3, material: Enum.Material?): Part
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Ball
	p.Size = Vector3.new(diameter, diameter, diameter)
	p.CFrame = CFrame.new(pos)
	finish(p, parent, color, material)
	return p
end

function Kit.ellipsoid(parent: Instance, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material?): Part
	local p = Kit.block(parent, size, cf, color, material)
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Sphere
	mesh.Parent = p
	return p
end

function Kit.wedge(parent: Instance, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material?): WedgePart
	local p = Instance.new("WedgePart")
	p.Size = size
	p.CFrame = cf
	finish(p, parent, color, material)
	return p
end

-- A bar from a to b (block or round).
function Kit.beam(parent: Instance, a: Vector3, b: Vector3, thickness: number, color: Color3, material: Enum.Material?, round: boolean?): Part
	local d = b - a
	local len = d.Magnitude
	local mid = (a + b) / 2
	if round then
		local cf = CFrame.lookAt(mid, b) * CFrame.Angles(0, HALF_PI, 0)
		return Kit.cyl(parent, len, thickness, cf, color, material)
	end
	return Kit.block(parent, Vector3.new(thickness, thickness, len), CFrame.lookAt(mid, b), color, material)
end

-- Flat ground strip from a to b (y ignored), top surface at y = top.
function Kit.path(parent: Instance, a: Vector3, b: Vector3, width: number, color: Color3, material: Enum.Material?, top: number?): Part
	local y = (top or 0.4) - 0.5
	local A = Vector3.new(a.X, y, a.Z)
	local B = Vector3.new(b.X, y, b.Z)
	local len = (B - A).Magnitude
	local p = Kit.block(parent, Vector3.new(width, 1, len + width * 0.5), CFrame.lookAt((A + B) / 2, B), color, material or M.Pavement)
	p.CastShadow = false
	return p
end

-- Rectangular ground pad: x1,z1 - x2,z2.
function Kit.pad(parent: Instance, x1: number, z1: number, x2: number, z2: number, color: Color3, material: Enum.Material?, top: number?): Part
	local y = (top or 0.4) - 0.5
	local p = Kit.block(parent, Vector3.new(math.abs(x2 - x1), 1, math.abs(z2 - z1)), CFrame.new((x1 + x2) / 2, y, (z1 + z2) / 2), color, material or M.Pavement)
	p.CastShadow = false
	return p
end

-- Round ground pad.
function Kit.roundPad(parent: Instance, center: Vector3, diameter: number, color: Color3, material: Enum.Material?, top: number?): Part
	local p = Kit.disc(parent, diameter, 1, Vector3.new(center.X, top or 0.42, center.Z), color, material or M.Pavement)
	p.CastShadow = false
	return p
end

---------------------------------------------------------------------------
-- Signs and text
---------------------------------------------------------------------------
function Kit.label(part: BasePart, face: Enum.NormalId, text: string, opts: SignOptions?): TextLabel
	local o: SignOptions = opts or {}
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	-- keep sign textures small: big signs get fewer pixels per stud
	local area = part.Size.X * part.Size.Y
	gui.PixelsPerStud = if area > 200 then 14 elseif area > 60 then 22 else 32
	gui.LightInfluence = if o.glow then 0 else 0.4
	gui.Brightness = if o.glow then 1.4 else 1
	gui.MaxDistance = 450
	gui.Parent = part
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextScaled = true
	label.TextColor3 = o.fg or Color3.new(1, 1, 1)
	label.FontFace = Font.fromEnum(o.font or Enum.Font.GothamBlack)
	label.TextWrapped = true
	label.Parent = gui
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0.04, 0)
	pad.PaddingRight = UDim.new(0.04, 0)
	pad.PaddingTop = UDim.new(0.08, 0)
	pad.PaddingBottom = UDim.new(0.08, 0)
	pad.Parent = label
	if o.stroke then
		local stroke = Instance.new("UIStroke")
		stroke.Color = o.stroke
		stroke.Thickness = 3
		stroke.Parent = label
	end
	return label
end

-- A sign board. `cf` faces the reader along its LookVector.
function Kit.sign(parent: Instance, text: string, size: Vector3, cf: CFrame, opts: SignOptions?): Part
	local o: SignOptions = opts or {}
	local board = Kit.block(parent, size, cf, o.bg or Color3.fromRGB(22, 34, 58), o.material or M.SmoothPlastic)
	board.Name = "Sign"
	if o.transparentBg then
		board.Transparency = 1
	end
	Kit.label(board, Enum.NormalId.Front, text, o)
	if o.both then
		Kit.label(board, Enum.NormalId.Back, text, o)
	end
	return board
end

-- Sign on two posts, bottom of posts at `base`, facing `facing` (unit).
function Kit.postSign(parent: Instance, text: string, base: Vector3, facing: Vector3, width: number, height: number, opts: SignOptions?): Part
	local cf = CFrame.lookAt(base, base + facing)
	local postColor = Color3.fromRGB(60, 60, 66)
	for _, sx in { -1, 1 } do
		local p = cf * Vector3.new(sx * (width / 2 - 0.4), 0, 0)
		Kit.post(parent, 4 + height, 0.5, p, postColor, M.Metal)
	end
	return Kit.sign(parent, text, Vector3.new(width, height, 0.5), cf * CFrame.new(0, 4 + height / 2, 0), opts)
end

---------------------------------------------------------------------------
-- Scenery
---------------------------------------------------------------------------
local LEAF = {
	Color3.fromRGB(58, 125, 52),
	Color3.fromRGB(72, 140, 60),
	Color3.fromRGB(46, 110, 58),
	Color3.fromRGB(90, 150, 64),
}

function Kit.tree(parent: Instance, pos: Vector3, kind: string?, scale: number?)
	local rng = Kit.rng
	local s = scale or rng:NextNumber(0.8, 1.25)
	local k = kind or (if rng:NextNumber() < 0.5 then "round" else "pine")
	local trunk = Color3.fromRGB(110, 78, 50)
	if k == "pine" then
		Kit.post(parent, 6 * s, 1.4 * s, pos, trunk, M.Wood)
		local leaf = Color3.fromRGB(40, 100, 56)
		for i = 0, 3 do
			local d = (11 - i * 2.6) * s
			Kit.post(parent, 3.6 * s, d, pos + Vector3.new(0, (4.5 + i * 3.2) * s, 0), leaf, M.Grass)
		end
	elseif k == "palm" then
		local top = pos + Vector3.new(0, 16 * s, 0)
		Kit.beam(parent, pos, top, 1.3 * s, trunk, M.Wood, true)
		for i = 0, 5 do
			local a = i * math.pi / 3
			local tip = top + Vector3.new(math.cos(a) * 7 * s, -2.5 * s, math.sin(a) * 7 * s)
			local leaf = Kit.beam(parent, top, tip, 1, Color3.fromRGB(60, 140, 60), M.Grass)
			leaf.Size = Vector3.new(2.4 * s, 0.3, leaf.Size.Z)
		end
	else
		Kit.post(parent, 7 * s, 1.6 * s, pos, trunk, M.Wood)
		local color = LEAF[rng:NextInteger(1, #LEAF)]
		Kit.ball(parent, 9 * s, pos + Vector3.new(0, 9.5 * s, 0), color, M.Grass)
		Kit.ball(parent, 6 * s, pos + Vector3.new(2.5 * s, 8 * s, 1 * s), color, M.Grass)
		Kit.ball(parent, 6 * s, pos + Vector3.new(-2 * s, 8.5 * s, -1.5 * s), color, M.Grass)
	end
end

function Kit.bush(parent: Instance, pos: Vector3, size: number?)
	local s = size or Kit.rng:NextNumber(2.5, 4)
	local b = Kit.ball(parent, s, pos + Vector3.new(0, s * 0.35, 0), LEAF[Kit.rng:NextInteger(1, #LEAF)], M.Grass)
	b.CastShadow = false
end

-- Flower bed: low box of soil with colorful blooms.
function Kit.flowerBed(parent: Instance, center: Vector3, sx: number, sz: number)
	Kit.box(parent, Vector3.new(sx, 1.2, sz), center, Color3.fromRGB(150, 140, 130), M.Brick)
	Kit.box(parent, Vector3.new(sx - 0.8, 1.3, sz - 0.8), center, Color3.fromRGB(80, 56, 40), M.Ground)
	local colors = { Color3.fromRGB(230, 60, 80), Color3.fromRGB(250, 210, 60), Color3.fromRGB(240, 130, 200), Color3.fromRGB(250, 250, 250), Color3.fromRGB(150, 90, 220) }
	local n = math.floor(sx * sz / 7)
	for _ = 1, math.min(n, 24) do
		local p = center + Vector3.new(Kit.rng:NextNumber(-sx / 2 + 1, sx / 2 - 1), 1.6, Kit.rng:NextNumber(-sz / 2 + 1, sz / 2 - 1))
		local f = Kit.ball(parent, 0.9, p, colors[Kit.rng:NextInteger(1, #colors)], M.SmoothPlastic)
		f.CastShadow = false
	end
end

function Kit.lamp(parent: Instance, pos: Vector3, color: Color3?)
	local poleColor = Color3.fromRGB(30, 34, 44)
	Kit.post(parent, 1, 1.4, pos, poleColor, M.Metal)
	Kit.post(parent, 11, 0.5, pos, poleColor, M.Metal)
	local bulb = Kit.ball(parent, 1.6, pos + Vector3.new(0, 11.6, 0), Color3.fromRGB(255, 236, 190), M.Neon)
	bulb.CastShadow = false
	Kit.disc(parent, 2.2, 0.3, pos + Vector3.new(0, 12.6, 0), poleColor, M.Metal)
	local light = Instance.new("PointLight")
	light.Color = color or Color3.fromRGB(255, 214, 160)
	light.Range = 22
	light.Brightness = 1.2
	light.Shadows = false
	light.Parent = bulb
	bulb:AddTag("ParkLamp")
end

-- Bench facing along cf.LookVector, cf at ground under its center.
function Kit.bench(parent: Instance, cf: CFrame)
	local wood = Color3.fromRGB(150, 100, 60)
	local iron = Color3.fromRGB(40, 40, 46)
	local seat = Instance.new("Seat")
	seat.Size = Vector3.new(5, 0.4, 1.6)
	seat.CFrame = cf * CFrame.new(0, 1.6, 0)
	finish(seat, parent, wood, M.WoodPlanks)
	Kit.block(parent, Vector3.new(5, 1.4, 0.3), cf * CFrame.new(0, 2.6, 0.75) * CFrame.Angles(math.rad(-10), 0, 0), wood, M.WoodPlanks)
	for _, sx in { -2.2, 2.2 } do
		Kit.block(parent, Vector3.new(0.3, 1.6, 1.4), cf * CFrame.new(sx, 0.8, 0), iron, M.Metal)
	end
end

-- Café table with umbrella and two seats.
function Kit.cafeTable(parent: Instance, pos: Vector3, umbrella: Color3)
	local white = Color3.fromRGB(240, 240, 236)
	Kit.post(parent, 3, 0.4, pos, Color3.fromRGB(60, 60, 66), M.Metal)
	Kit.disc(parent, 3.4, 0.2, pos + Vector3.new(0, 3.1, 0), white, M.SmoothPlastic)
	Kit.post(parent, 8, 0.25, pos + Vector3.new(0, 3, 0), white, M.Metal)
	Kit.cyl(parent, 1.4, 8, CFrame.new(pos + Vector3.new(0, 10.5, 0)) * CFrame.Angles(0, 0, math.pi / 2), umbrella, M.Fabric)
	for _, sx in { -1, 1 } do
		local seat = Instance.new("Seat")
		seat.Size = Vector3.new(1.8, 0.4, 1.8)
		seat.CFrame = CFrame.lookAt(pos + Vector3.new(sx * 2.8, 1.8, 0), pos + Vector3.new(0, 1.8, 0))
		finish(seat, parent, white, M.SmoothPlastic)
		Kit.post(parent, 1.6, 0.3, pos + Vector3.new(sx * 2.8, 0, 0), Color3.fromRGB(60, 60, 66), M.Metal)
	end
end

function Kit.fence(parent: Instance, a: Vector3, b: Vector3, height: number?, color: Color3?)
	local h = height or 3
	local c = color or Color3.fromRGB(40, 44, 54)
	local d = b - a
	local len = d.Magnitude
	local n = math.max(1, math.floor(len / 8))
	for i = 0, n do
		Kit.post(parent, h, 0.35, a + d * (i / n), c, M.Metal)
	end
	Kit.beam(parent, a + Vector3.new(0, h - 0.2, 0), b + Vector3.new(0, h - 0.2, 0), 0.25, c, M.Metal, true)
	Kit.beam(parent, a + Vector3.new(0, h * 0.45, 0), b + Vector3.new(0, h * 0.45, 0), 0.2, c, M.Metal, true)
end

function Kit.flag(parent: Instance, base: Vector3, color: Color3, height: number?)
	local h = height or 22
	Kit.post(parent, h, 0.4, base, Color3.fromRGB(220, 220, 225), M.Metal)
	local f = Kit.block(parent, Vector3.new(0.1, 3, 5), CFrame.new(base + Vector3.new(0, h - 2, 2.6)), color, M.Fabric)
	f.CastShadow = false
	Kit.ball(parent, 0.8, base + Vector3.new(0, h + 0.3, 0), Color3.fromRGB(240, 196, 64), M.Metal)
end

-- Hanging banner on a lamp-style pole (Main Street).
function Kit.bannerPole(parent: Instance, base: Vector3, color: Color3, facing: Vector3)
	Kit.post(parent, 16, 0.5, base, Color3.fromRGB(30, 34, 44), M.Metal)
	local cf = CFrame.lookAt(base, base + facing)
	local banner = Kit.block(parent, Vector3.new(2.6, 6, 0.15), cf * CFrame.new(1.5, 11, 0), color, M.Fabric)
	banner.CastShadow = false
	local white = Kit.block(parent, Vector3.new(1.4, 1.4, 0.2), cf * CFrame.new(1.5, 12, 0), Color3.fromRGB(250, 243, 224), M.SmoothPlastic)
	white.CastShadow = false
end

function Kit.waterTower(parent: Instance, base: Vector3, text: string, tank: Color3, legs: Color3?)
	local legColor = legs or Color3.fromRGB(70, 60, 54)
	for i = 0, 3 do
		local a = i * HALF_PI + math.pi / 4
		local foot = base + Vector3.new(math.cos(a) * 6, 0, math.sin(a) * 6)
		local top = base + Vector3.new(math.cos(a) * 4.5, 28, math.sin(a) * 4.5)
		Kit.beam(parent, foot, top, 1, legColor, M.Metal, true)
	end
	local body = Kit.cyl(parent, 14, 13, CFrame.new(base + Vector3.new(0, 35, 0)) * CFrame.Angles(0, 0, HALF_PI), tank, M.Metal)
	Kit.cyl(parent, 3, 14, CFrame.new(base + Vector3.new(0, 43, 0)) * CFrame.Angles(0, 0, HALF_PI), legColor, M.Metal)
	Kit.ball(parent, 2, base + Vector3.new(0, 45, 0), legColor, M.Metal)
	-- text panels around the tank
	for i = 0, 3 do
		local a = i * HALF_PI
		local cf = CFrame.new(base + Vector3.new(0, 35, 0)) * CFrame.Angles(0, a, 0) * CFrame.new(0, 0, -6.6)
		Kit.sign(parent, text, Vector3.new(8, 5, 0.2), cf, { transparentBg = true, fg = Color3.fromRGB(250, 243, 224), font = Enum.Font.GothamBlack })
	end
	local _ = body
end

-- Land entrance arch spanning a path. cf: center of the path at ground
-- level, looking toward the land (visitors read the front from outside).
function Kit.arch(parent: Instance, cf: CFrame, width: number, text: string, colors: { Color3 })
	local main, trim = colors[1], colors[2] or Color3.fromRGB(250, 243, 224)
	local h = 24
	for _, sx in { -1, 1 } do
		local x = sx * (width / 2 + 2)
		Kit.block(parent, Vector3.new(4.5, h, 4.5), cf * CFrame.new(x, h / 2, 0), main, M.Brick)
		Kit.block(parent, Vector3.new(5.5, 1.2, 5.5), cf * CFrame.new(x, h + 0.6, 0), trim, M.Concrete)
		Kit.block(parent, Vector3.new(5.5, 1.5, 5.5), cf * CFrame.new(x, 0.75, 0), trim, M.Concrete)
		local lantern = Kit.ball(parent, 2, (cf * CFrame.new(x, h + 2.4, 0)).Position, Color3.fromRGB(255, 230, 170), M.Neon)
		local light = Instance.new("PointLight")
		light.Range = 18
		light.Color = Color3.fromRGB(255, 210, 150)
		light.Parent = lantern
	end
	local beamCF = cf * CFrame.new(0, h - 3, 0)
	Kit.block(parent, Vector3.new(width + 11, 6.5, 3.2), beamCF, main, M.SmoothPlastic)
	-- outside face (visitors arriving) and inside face (visitors leaving)
	local outside = beamCF * CFrame.new(0, 0, 1.75) * CFrame.Angles(0, math.pi, 0)
	Kit.sign(parent, text, Vector3.new(width + 9, 5, 0.3), outside, { bg = trim, fg = main, font = Enum.Font.GothamBlack, glow = true })
	local inside = beamCF * CFrame.new(0, 0, -1.75)
	Kit.sign(parent, text, Vector3.new(width + 9, 5, 0.3), inside, { bg = trim, fg = main, font = Enum.Font.GothamBlack, glow = true })
end

function Kit.light(part: BasePart, color: Color3, range: number, brightness: number?): PointLight
	local l = Instance.new("PointLight")
	l.Color = color
	l.Range = range
	l.Brightness = brightness or 1
	l.Parent = part
	return l
end

function Kit.prompt(part: BasePart, action: string, object: string, key: Enum.KeyCode?, distance: number?): ProximityPrompt
	local p = Instance.new("ProximityPrompt")
	p.ActionText = action
	p.ObjectText = object
	p.KeyboardKeyCode = key or Enum.KeyCode.E
	p.MaxActivationDistance = distance or 12
	p.RequiresLineOfSight = false
	p.HoldDuration = 0
	p.Parent = part
	return p
end

-- Simple building: box with roof slab, trim, windows and an optional
-- awning on the front (cf LookVector = front).
export type BuildingOptions = {
	size: Vector3,
	wall: Color3,
	trim: Color3?,
	roof: Color3?,
	material: Enum.Material?,
	windows: boolean?,
	awning: Color3?,
	sign: string?,
	signColors: { Color3 }?,
	open: boolean?, -- open front (counter) instead of a solid wall
}

function Kit.building(parent: Instance, cf: CFrame, o: BuildingOptions): Model
	local model = Kit.model("Building", parent)
	local size = o.size
	local trim = o.trim or Color3.fromRGB(250, 243, 224)
	local roof = o.roof or Color3.fromRGB(60, 60, 66)
	local mat = o.material or M.Brick
	local hx, hz = size.X / 2, size.Z / 2
	-- walls: back + sides, and front (solid or open)
	Kit.block(model, Vector3.new(size.X, size.Y, 1), cf * CFrame.new(0, size.Y / 2, hz - 0.5), o.wall, mat)
	Kit.block(model, Vector3.new(1, size.Y, size.Z), cf * CFrame.new(-hx + 0.5, size.Y / 2, 0), o.wall, mat)
	Kit.block(model, Vector3.new(1, size.Y, size.Z), cf * CFrame.new(hx - 0.5, size.Y / 2, 0), o.wall, mat)
	if o.open then
		local openH = math.min(12, size.Y - 4)
		Kit.block(model, Vector3.new(size.X, size.Y - openH, 1), cf * CFrame.new(0, openH + (size.Y - openH) / 2, -hz + 0.5), o.wall, mat)
		-- counter
		local counter = Kit.block(model, Vector3.new(size.X - 6, 3.6, 2.4), cf * CFrame.new(0, 1.8, -hz + 3), trim, M.Wood)
		counter.Name = "Counter"
		-- interior floor/back shelves
		Kit.block(model, Vector3.new(size.X - 2, 0.4, size.Z - 2), cf * CFrame.new(0, 0.2, 0), Color3.fromRGB(190, 170, 150), M.WoodPlanks)
		for i = -1, 1 do
			Kit.block(model, Vector3.new(size.X / 4, 7, 1.6), cf * CFrame.new(i * size.X / 3.2, 3.5, hz - 2), Color3.fromRGB(120, 90, 60), M.Wood)
		end
	else
		Kit.block(model, Vector3.new(size.X, size.Y, 1), cf * CFrame.new(0, size.Y / 2, -hz + 0.5), o.wall, mat)
		local door = Kit.block(model, Vector3.new(6, 9, 0.4), cf * CFrame.new(0, 4.5, -hz - 0.1), Color3.fromRGB(70, 46, 30), M.Wood)
		door.Name = "Door"
	end
	-- roof and trim
	Kit.block(model, Vector3.new(size.X + 2, 1.4, size.Z + 2), cf * CFrame.new(0, size.Y + 0.7, 0), roof, M.Slate)
	Kit.block(model, Vector3.new(size.X + 0.6, 1.2, size.Z + 0.6), cf * CFrame.new(0, size.Y - 0.6, 0), trim, M.Concrete)
	if o.windows ~= false then
		local floors = math.max(1, math.floor((size.Y - 4) / 9))
		local cols = math.max(1, math.floor(size.X / 9))
		for f = 1, floors do
			for c = 1, cols do
				local x = -hx + (c - 0.5) * size.X / cols
				local y = 6 + (f - 1) * 9 + (if o.open then 9 else 0)
				if y < size.Y - 3 and not (not o.open and f == 1 and math.abs(x) < 5) then
					local w = Kit.block(model, Vector3.new(3.2, 4.2, 0.3), cf * CFrame.new(x, y, -hz - 0.05), Color3.fromRGB(150, 196, 220), M.Glass)
					w.Transparency = 0.2
					Kit.block(model, Vector3.new(3.8, 0.4, 0.5), cf * CFrame.new(x, y - 2.3, -hz - 0.1), trim, M.Concrete)
				end
			end
		end
	end
	if o.awning then
		local depth = 6
		local awn = Kit.wedge(model, Vector3.new(size.X - 2, 1.6, depth), cf * CFrame.new(0, 13.2, -hz - depth / 2), o.awning, M.Fabric)
		awn.CastShadow = true
		-- stripes
		for i = 0, math.floor((size.X - 2) / 4) - 1, 2 do
			local x = -((size.X - 2) / 2) + i * 4 + 2
			local s = Kit.wedge(model, Vector3.new(4, 1.62, depth + 0.02), cf * CFrame.new(x, 13.2, -hz - depth / 2), trim, M.Fabric)
			s.CastShadow = false
		end
	end
	if o.sign then
		local colors = o.signColors or { Color3.fromRGB(22, 34, 58), trim }
		Kit.sign(model, o.sign, Vector3.new(math.min(size.X - 2, 40), 4.5, 0.6), cf * CFrame.new(0, size.Y - 3.6, -hz - 0.4), {
			bg = colors[1],
			fg = colors[2],
			font = Enum.Font.GothamBlack,
			glow = true,
		})
	end
	return model
end

-- Gear emblem (decorative), facing cf.LookVector.
function Kit.gear(parent: Instance, cf: CFrame, diameter: number, color: Color3, material: Enum.Material?)
	local mat = material or M.Metal
	Kit.cyl(parent, diameter * 0.18, diameter, cf * CFrame.Angles(0, HALF_PI, 0), color, mat)
	for k = 0, 7 do
		local a = k * math.pi / 4
		Kit.block(parent, Vector3.new(diameter * 0.2, diameter * 0.22, diameter * 0.16), cf * CFrame.Angles(0, 0, a) * CFrame.new(0, diameter * 0.52, 0), color, mat)
	end
	Kit.cyl(parent, diameter * 0.2, diameter * 0.32, cf * CFrame.Angles(0, HALF_PI, 0), Color3.fromRGB(30, 30, 36), mat)
end

return Kit
