-- Part-built visuals shared by server and client: hats, balloons, held
-- souvenirs, food, and the simple guest figures that ride along with
-- players and walk around the park. No uploaded assets are needed.

local Items = require(script.Parent.Items)

local Props = {}

local HALF_PI = math.pi / 2

export type Piece = {
	shape: string, -- block | ball | cyl | disc | wedge | ellipsoid | round
	size: Vector3,
	cf: CFrame,
	color: Color3,
	material: Enum.Material?,
	transparency: number?,
	name: string?,
}

local function piece(shape: string, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material?, transparency: number?): Piece
	return { shape = shape, size = size, cf = cf, color = color, material = material, transparency = transparency }
end

-- A flat disc lying in the XZ plane (cylinder axis pointing up).
local function disc(diameter: number, thickness: number, cf: CFrame, color: Color3, material: Enum.Material?): Piece
	return piece("cyl", Vector3.new(thickness, diameter, diameter), cf * CFrame.Angles(0, 0, HALF_PI), color, material)
end

-- A disc standing up and facing forward (-Z), like a wheel seen from the side.
local function wheel(diameter: number, thickness: number, cf: CFrame, color: Color3): Piece
	return piece("cyl", Vector3.new(thickness, diameter, diameter), cf, color, Enum.Material.SmoothPlastic)
end

local function makePart(p: Piece): BasePart
	local part: BasePart
	if p.shape == "wedge" then
		part = Instance.new("WedgePart")
	else
		local block = Instance.new("Part")
		if p.shape == "ball" then
			block.Shape = Enum.PartType.Ball
		elseif p.shape == "cyl" then
			block.Shape = Enum.PartType.Cylinder
		end
		part = block
	end
	part.Name = p.name or "Piece"
	part.Size = p.size
	part.Color = p.color
	part.Material = p.material or Enum.Material.SmoothPlastic
	part.Transparency = p.transparency or 0
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	if p.shape == "ellipsoid" or p.shape == "round" then
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = if p.shape == "ellipsoid" then Enum.MeshType.Sphere else Enum.MeshType.Head
		mesh.Parent = part
	end
	return part
end
Props.makePart = makePart

-- Assemble pieces into a model. The first piece becomes the root ("Handle"
-- for tools/accessories). Loose = unanchored + welded + massless.
local function assemble(pieces: { Piece }, rootName: string, loose: boolean, at: CFrame?): (BasePart, { BasePart })
	local base = at or CFrame.new()
	local parts: { BasePart } = {}
	local root: BasePart? = nil
	for i, p in pieces do
		local part = makePart(p)
		part.CFrame = base * p.cf
		part.CanCollide = false
		part.CanTouch = false
		part.CanQuery = false
		if loose then
			part.Anchored = false
			part.Massless = true
		else
			part.Anchored = true
		end
		if i == 1 then
			part.Name = rootName
			root = part
		elseif loose and root then
			local weld = Instance.new("Weld")
			weld.Part0 = root
			weld.Part1 = part
			weld.C0 = p.cf
			weld.Parent = part
		end
		table.insert(parts, part)
	end
	assert(root, "assemble needs at least one piece")
	for i = 2, #parts do
		parts[i].Parent = root
	end
	return root, parts
end
Props.assemble = assemble

---------------------------------------------------------------------------
-- Hats
---------------------------------------------------------------------------
local gold = Color3.fromRGB(240, 196, 64)

local function gearPieces(cf: CFrame, size: number, color: Color3): { Piece }
	local out = { wheel(size, size * 0.18, cf * CFrame.Angles(0, HALF_PI, 0), color) }
	for k = 0, 5 do
		local a = k * math.pi / 3
		table.insert(out, piece("block", Vector3.new(size * 0.22, size * 0.22, size * 0.16), cf * CFrame.Angles(0, 0, a) * CFrame.new(0, size * 0.5, 0), color))
	end
	return out
end
Props.gearPieces = gearPieces

-- Returns pieces relative to the hat's root, and the root's offset above
-- the head's HatAttachment.
local function hatPieces(item: Items.Item): ({ Piece }, CFrame)
	local c1, c2 = item.colors[1], item.colors[2] or item.colors[1]
	local id = CFrame.new()
	if item.shape == "ears" then
		local p = {
			piece("block", Vector3.new(1.5, 0.22, 0.3), id, c1),
			wheel(1.05, 0.14, CFrame.new(-0.72, 0.55, 0) * CFrame.Angles(0, HALF_PI, 0), c1),
			wheel(1.05, 0.14, CFrame.new(0.72, 0.55, 0) * CFrame.Angles(0, HALF_PI, 0), c1),
		}
		for _, g in gearPieces(CFrame.new(0, 0.35, -0.2), 0.45, c2) do
			table.insert(p, g)
		end
		return p, CFrame.new(0, 0.05, 0)
	elseif item.shape == "cap" then
		return {
			piece("ellipsoid", Vector3.new(1.4, 0.9, 1.45), id, c1),
			piece("block", Vector3.new(1.15, 0.1, 0.75), CFrame.new(0, -0.18, -0.85) * CFrame.Angles(math.rad(-8), 0, 0), c1),
			wheel(0.42, 0.06, CFrame.new(0, 0.12, -0.66) * CFrame.Angles(math.rad(-25), HALF_PI, 0), c2),
			piece("ball", Vector3.new(0.2, 0.2, 0.2), CFrame.new(0, 0.45, 0), c2),
		}, CFrame.new(0, -0.15, 0.05)
	elseif item.shape == "hardhat" then
		return {
			piece("ellipsoid", Vector3.new(1.45, 1.05, 1.55), id, c1, Enum.Material.Plastic),
			disc(1.95, 0.1, CFrame.new(0, -0.3, -0.05), c1, Enum.Material.Plastic),
			piece("block", Vector3.new(0.22, 0.25, 1.5), CFrame.new(0, 0.42, 0), c1, Enum.Material.Plastic),
		}, CFrame.new(0, -0.1, 0)
	elseif item.shape == "cone" then
		return {
			disc(1.4, 0.18, id, c2),
			disc(1.0, 0.45, CFrame.new(0, 0.3, 0), c1),
			disc(0.78, 0.4, CFrame.new(0, 0.7, 0), c2),
			disc(0.56, 0.45, CFrame.new(0, 1.1, 0), c1),
			disc(0.32, 0.35, CFrame.new(0, 1.45, 0), c1),
		}, CFrame.new(0, 0.1, 0)
	elseif item.shape == "cowboy" then
		return {
			piece("round", Vector3.new(1.25, 0.85, 1.35), id, c1),
			disc(2.7, 0.08, CFrame.new(0, -0.35, 0), c1),
			disc(1.32, 0.18, CFrame.new(0, -0.2, 0), c2),
		}, CFrame.new(0, 0.2, 0)
	elseif item.shape == "beret" then
		return {
			piece("ellipsoid", Vector3.new(1.55, 0.45, 1.55), CFrame.Angles(0, 0, math.rad(-10)), c1),
			piece("block", Vector3.new(0.1, 0.22, 0.1), CFrame.new(0, 0.25, 0), c1),
			piece("block", Vector3.new(0.5, 0.06, 0.04), CFrame.new(0.3, 0.02, -0.74), c2),
		}, CFrame.new(0, 0, 0)
	elseif item.shape == "helmet" then
		return {
			piece("ellipsoid", Vector3.new(1.75, 1.75, 1.85), id, c1, Enum.Material.SmoothPlastic),
			piece("ellipsoid", Vector3.new(1.3, 0.6, 0.6), CFrame.new(0, -0.1, -0.68), c2, Enum.Material.Glass, 0.15),
			piece("block", Vector3.new(0.28, 0.06, 1.7), CFrame.new(0, 0.86, 0), Color3.fromRGB(250, 250, 250)),
		}, CFrame.new(0, -0.55, 0)
	elseif item.shape == "captain" then
		return {
			disc(1.35, 0.55, id, c1),
			disc(1.38, 0.16, CFrame.new(0, -0.18, 0), c2),
			piece("block", Vector3.new(1.05, 0.08, 0.6), CFrame.new(0, -0.3, -0.72) * CFrame.Angles(math.rad(-10), 0, 0), Color3.fromRGB(20, 20, 24)),
			wheel(0.3, 0.06, CFrame.new(0, 0.02, -0.7) * CFrame.Angles(0, HALF_PI, 0), gold),
		}, CFrame.new(0, 0.12, 0)
	elseif item.shape == "shades" then
		return {
			piece("block", Vector3.new(0.35, 0.08, 0.06), id, c1),
			piece("block", Vector3.new(0.48, 0.36, 0.06), CFrame.new(-0.42, 0, 0), c1),
			piece("block", Vector3.new(0.48, 0.36, 0.06), CFrame.new(0.42, 0, 0), c1),
			piece("block", Vector3.new(0.4, 0.28, 0.04), CFrame.new(-0.42, 0, -0.04), c2, Enum.Material.Glass),
			piece("block", Vector3.new(0.4, 0.28, 0.04), CFrame.new(0.42, 0, -0.04), c2, Enum.Material.Glass),
		}, CFrame.new(0, 0.15, -0.05)
	end
	return { piece("block", Vector3.new(1, 0.5, 1), id, c1) }, CFrame.new()
end

-- An Accessory a Humanoid can wear (Humanoid:AddAccessory).
function Props.accessory(item: Items.Item): Accessory
	local pieces, offset = hatPieces(item)
	local acc = Instance.new("Accessory")
	acc.Name = item.id
	local handle = assemble(pieces, "Handle", true)
	local att = Instance.new("Attachment")
	att.Name = if item.kind == "face" then "FaceFrontAttachment" else "HatAttachment"
	-- the attachment marks where the head attachment should line up
	att.CFrame = offset:Inverse()
	att.Parent = handle
	handle.Parent = acc
	return acc
end

-- Anchored hat model for previews and guest figures, placed at `at`
-- (which should be the HatAttachment world CFrame).
function Props.hatModel(item: Items.Item, at: CFrame): Model
	local pieces, offset = hatPieces(item)
	local model = Instance.new("Model")
	model.Name = item.id
	local root = assemble(pieces, "Root", false, at * offset)
	root.Parent = model
	model.PrimaryPart = root
	return model
end

---------------------------------------------------------------------------
-- Balloons
---------------------------------------------------------------------------
function Props.balloon(item: Items.Item): Model
	local c1, c2 = item.colors[1], item.colors[2] or item.colors[1]
	local pieces: { Piece } = {
		piece("ball", Vector3.new(2.6, 2.6, 2.6), CFrame.new(), c1, Enum.Material.SmoothPlastic),
		piece("ball", Vector3.new(0.35, 0.35, 0.35), CFrame.new(0, -1.35, 0), c1),
	}
	if item.shape == "globe" then
		table.insert(pieces, piece("ellipsoid", Vector3.new(1.2, 0.9, 0.5), CFrame.new(0.3, 0.3, -1.05), c2))
		table.insert(pieces, piece("ellipsoid", Vector3.new(0.9, 1.1, 0.5), CFrame.new(-0.6, -0.3, -0.95), c2))
		table.insert(pieces, piece("ellipsoid", Vector3.new(0.5, 1.2, 0.9), CFrame.new(1.05, -0.1, 0.4), c2))
	elseif item.shape == "duck" then
		table.insert(pieces, piece("ball", Vector3.new(1.5, 1.5, 1.5), CFrame.new(0, 1.5, -0.6), c1))
		table.insert(pieces, piece("ellipsoid", Vector3.new(0.7, 0.3, 0.7), CFrame.new(0, 1.4, -1.45), c2))
		table.insert(pieces, piece("ball", Vector3.new(0.25, 0.25, 0.25), CFrame.new(-0.4, 1.75, -1.2), Color3.fromRGB(20, 20, 20)))
		table.insert(pieces, piece("ball", Vector3.new(0.25, 0.25, 0.25), CFrame.new(0.4, 1.75, -1.2), Color3.fromRGB(20, 20, 20)))
	else
		for _, g in gearPieces(CFrame.new(0, 0, -1.25), 1.2, c2) do
			table.insert(pieces, g)
		end
	end
	local model = Instance.new("Model")
	model.Name = item.id
	local root = assemble(pieces, "Balloon", true)
	root.Massless = false
	root.Parent = model
	model.PrimaryPart = root
	local bottom = Instance.new("Attachment")
	bottom.Name = "StringAttachment"
	bottom.Position = Vector3.new(0, -1.5, 0)
	bottom.Parent = root
	return model
end

---------------------------------------------------------------------------
-- Held items and food (Tools)
---------------------------------------------------------------------------
local function heldPieces(item: Items.Item): { Piece }
	local c1, c2 = item.colors[1], item.colors[2] or item.colors[1]
	local id = CFrame.new()
	local s = item.shape
	if s == "wrench" then
		return {
			piece("block", Vector3.new(0.3, 0.3, 2.6), id, c1, Enum.Material.Metal),
			piece("block", Vector3.new(0.9, 0.3, 0.3), CFrame.new(0, 0, -1.3), c1, Enum.Material.Metal),
			piece("block", Vector3.new(0.25, 0.3, 0.55), CFrame.new(-0.35, 0, -1.6), c1, Enum.Material.Metal),
			piece("block", Vector3.new(0.25, 0.3, 0.55), CFrame.new(0.35, 0, -1.6), c1, Enum.Material.Metal),
			disc(0.7, 0.3, CFrame.new(0, 0, 1.35) * CFrame.Angles(HALF_PI, 0, 0), c1, Enum.Material.Metal),
		}
	elseif s == "toytruck" then
		return {
			piece("block", Vector3.new(0.6, 0.5, 1.6), id, c2),
			piece("block", Vector3.new(0.62, 0.65, 0.6), CFrame.new(0, 0.1, -1.0), c1),
			piece("block", Vector3.new(0.5, 0.25, 0.05), CFrame.new(0, 0.25, -1.31), Color3.fromRGB(150, 200, 230), Enum.Material.Glass),
			wheel(0.38, 0.1, CFrame.new(-0.33, -0.3, -0.9), Color3.fromRGB(20, 20, 20)),
			wheel(0.38, 0.1, CFrame.new(0.33, -0.3, -0.9), Color3.fromRGB(20, 20, 20)),
			wheel(0.38, 0.1, CFrame.new(-0.33, -0.3, 0.55), Color3.fromRGB(20, 20, 20)),
			wheel(0.38, 0.1, CFrame.new(0.33, -0.3, 0.55), Color3.fromRGB(20, 20, 20)),
		}
	elseif s == "lantern" then
		return {
			piece("block", Vector3.new(0.7, 0.12, 0.7), id, c1, Enum.Material.Metal),
			piece("block", Vector3.new(0.55, 0.8, 0.55), CFrame.new(0, 0.48, 0), c2, Enum.Material.Neon, 0.1),
			piece("block", Vector3.new(0.7, 0.12, 0.7), CFrame.new(0, 0.94, 0), c1, Enum.Material.Metal),
			piece("block", Vector3.new(0.08, 0.45, 0.08), CFrame.new(0, 1.2, 0), c1, Enum.Material.Metal),
		}
	elseif s == "clapper" then
		local p = {
			piece("block", Vector3.new(1.4, 1.0, 0.1), id, c1),
			piece("block", Vector3.new(1.4, 0.25, 0.1), CFrame.new(0, 0.66, 0) * CFrame.Angles(0, 0, math.rad(-12)), c2),
		}
		for k = 0, 3 do
			table.insert(p, piece("block", Vector3.new(0.16, 0.26, 0.12), CFrame.new(-0.5 + k * 0.34, 0.68 - k * 0.07, 0) * CFrame.Angles(0, 0, math.rad(-12)), c1))
		end
		return p
	elseif s == "flag" then
		local p = { piece("cyl", Vector3.new(3.2, 0.14, 0.14), CFrame.Angles(0, 0, HALF_PI), Color3.fromRGB(200, 200, 205), Enum.Material.Metal) }
		for row = 0, 2 do
			for col = 0, 3 do
				local color = if (row + col) % 2 == 0 then c1 else c2
				table.insert(p, piece("block", Vector3.new(0.05, 0.35, 0.35), CFrame.new(0, 1.35 - row * 0.35, -0.25 - col * 0.35), color, Enum.Material.Fabric))
			end
		end
		return p
	end
	-- food ---------------------------------------------------------------
	if s == "donut" then
		local p = { disc(1.0, 0.32, id, c1) }
		table.insert(p, disc(0.95, 0.1, CFrame.new(0, 0.18, 0), c2))
		table.insert(p, disc(0.35, 0.36, CFrame.new(0, 0.02, 0), Color3.fromRGB(245, 240, 230)))
		return p
	elseif s == "roll" then
		return {
			disc(1.1, 0.45, id, c1),
			disc(0.8, 0.1, CFrame.new(0, 0.26, 0), c2),
			disc(0.4, 0.12, CFrame.new(0, 0.3, 0), c1),
		}
	elseif s == "cup" then
		return {
			disc(0.65, 1.1, id, c1),
			disc(0.55, 0.06, CFrame.new(0, 0.5, 0), c2),
			disc(0.7, 0.08, CFrame.new(0, 0.58, 0), Color3.fromRGB(250, 250, 250)),
			piece("cyl", Vector3.new(0.6, 0.08, 0.08), CFrame.new(0.1, 0.85, 0) * CFrame.Angles(0, 0, math.rad(80)), Color3.fromRGB(230, 60, 60)),
		}
	elseif s == "hotdog" then
		return {
			piece("ellipsoid", Vector3.new(0.6, 0.4, 2.0), id, c1),
			piece("ellipsoid", Vector3.new(0.35, 0.35, 2.3), CFrame.new(0, 0.15, 0), c2),
			piece("block", Vector3.new(0.08, 0.05, 1.8), CFrame.new(0, 0.33, 0), Color3.fromRGB(250, 210, 40)),
		}
	elseif s == "pretzel" then
		return {
			disc(0.75, 0.2, CFrame.new(-0.3, 0, 0) * CFrame.Angles(HALF_PI, 0, 0), c1),
			disc(0.75, 0.2, CFrame.new(0.3, 0, 0) * CFrame.Angles(HALF_PI, 0, 0), c1),
			piece("block", Vector3.new(1.2, 0.18, 0.2), CFrame.new(0, -0.32, 0), c1),
		}
	elseif s == "shake" then
		return {
			disc(0.7, 1.2, id, c2, Enum.Material.Glass),
			disc(0.62, 1.0, CFrame.new(0, -0.05, 0), c1),
			piece("ball", Vector3.new(0.7, 0.7, 0.7), CFrame.new(0, 0.7, 0), Color3.fromRGB(255, 250, 245)),
			piece("ball", Vector3.new(0.22, 0.22, 0.22), CFrame.new(0, 1.07, 0), Color3.fromRGB(200, 20, 40)),
		}
	elseif s == "platter" then
		return {
			disc(1.8, 0.1, id, c1),
			piece("ellipsoid", Vector3.new(0.9, 0.3, 0.7), CFrame.new(-0.2, 0.18, 0.1), c2),
			piece("block", Vector3.new(0.45, 0.25, 0.45), CFrame.new(0.5, 0.15, -0.3), Color3.fromRGB(240, 200, 90)),
			piece("ellipsoid", Vector3.new(0.5, 0.2, 0.5), CFrame.new(0.4, 0.12, 0.45), Color3.fromRGB(150, 70, 40)),
		}
	elseif s == "sandwich" then
		return {
			piece("ellipsoid", Vector3.new(1.2, 0.35, 1.2), id, c1),
			piece("block", Vector3.new(1.1, 0.2, 1.1), CFrame.new(0, 0.2, 0), c2),
			piece("ellipsoid", Vector3.new(1.2, 0.55, 1.2), CFrame.new(0, 0.42, 0), c1),
		}
	elseif s == "popcorn" then
		local p = { disc(0.9, 1.2, id, Color3.fromRGB(250, 250, 250)) }
		for k = 0, 3 do
			local a = k * HALF_PI
			table.insert(p, piece("block", Vector3.new(0.12, 1.21, 0.2), CFrame.Angles(0, a, 0) * CFrame.new(0, 0, -0.41), c1))
		end
		for k = 0, 6 do
			local a = k * 0.9
			table.insert(p, piece("ball", Vector3.new(0.3, 0.3, 0.3), CFrame.new(math.cos(a) * 0.25, 0.65 + (k % 3) * 0.08, math.sin(a) * 0.25), c2))
		end
		return p
	elseif s == "taco" then
		return {
			piece("cyl", Vector3.new(0.5, 1.2, 1.2), CFrame.Angles(0, HALF_PI, 0), c1),
			piece("block", Vector3.new(0.35, 0.3, 1.0), CFrame.new(0, 0.4, 0), c2),
		}
	elseif s == "nachos" then
		local p = { piece("block", Vector3.new(1.4, 0.2, 1.0), id, Color3.fromRGB(250, 250, 250)) }
		for k = 0, 4 do
			table.insert(p, piece("wedge", Vector3.new(0.1, 0.4, 0.45), CFrame.new(-0.5 + k * 0.25, 0.25, (k % 2) * 0.2 - 0.1) * CFrame.Angles(0, k, 0.4), c1))
		end
		table.insert(p, piece("ellipsoid", Vector3.new(1.0, 0.15, 0.7), CFrame.new(0, 0.32, 0), c2))
		return p
	elseif s == "slice" then
		return {
			piece("wedge", Vector3.new(0.12, 1.6, 1.0), CFrame.Angles(HALF_PI, 0, 0) * CFrame.Angles(0, 0, HALF_PI), c1),
			disc(0.3, 0.06, CFrame.new(0, 0.08, -0.1), c2),
			disc(0.3, 0.06, CFrame.new(0.2, 0.08, 0.35), c2),
			disc(0.3, 0.06, CFrame.new(-0.15, 0.08, 0.5), c2),
		}
	elseif s == "knots" then
		local p = { disc(1.2, 0.08, id, Color3.fromRGB(250, 250, 250)) }
		for k = 0, 5 do
			local a = k * math.pi / 3
			table.insert(p, piece("ball", Vector3.new(0.38, 0.38, 0.38), CFrame.new(math.cos(a) * 0.35, 0.18, math.sin(a) * 0.35), c1))
		end
		return p
	elseif s == "burger" then
		return {
			disc(1.1, 0.25, id, c1),
			disc(1.15, 0.2, CFrame.new(0, 0.22, 0), c2),
			piece("block", Vector3.new(1.05, 0.06, 1.05), CFrame.new(0, 0.34, 0) * CFrame.Angles(0, math.rad(45), 0), Color3.fromRGB(250, 200, 40)),
			disc(1.15, 0.2, CFrame.new(0, 0.45, 0), c2),
			disc(1.2, 0.08, CFrame.new(0, 0.58, 0), Color3.fromRGB(90, 170, 60)),
			piece("ellipsoid", Vector3.new(1.15, 0.6, 1.15), CFrame.new(0, 0.78, 0), c1),
		}
	elseif s == "fries" then
		local p = { piece("block", Vector3.new(0.9, 0.6, 0.6), id, c1) }
		for k = 0, 6 do
			table.insert(p, piece("block", Vector3.new(0.12, 0.7, 0.12), CFrame.new(-0.33 + k * 0.11, 0.45 + (k % 2) * 0.1, (k % 3) * 0.12 - 0.12) * CFrame.Angles(0, 0, (k - 3) * 0.08), c2))
		end
		return p
	elseif s == "pass" then
		return {
			piece("block", Vector3.new(1.2, 0.05, 0.8), id, c1),
		}
	end
	return { piece("block", Vector3.new(0.8, 0.8, 0.8), id, c1) }
end

function Props.itemPieces(item: Items.Item): { Piece }
	if item.kind == "hat" or item.kind == "face" then
		local p = hatPieces(item)
		return p
	end
	return heldPieces(item)
end

-- A Tool with a Handle, for held souvenirs and food.
function Props.tool(item: Items.Item): Tool
	local tool = Instance.new("Tool")
	tool.Name = item.name
	tool.CanBeDropped = false
	tool.RequiresHandle = true
	tool.ToolTip = item.description
	tool:SetAttribute("ItemId", item.id)
	local handle = assemble(heldPieces(item), "Handle", true)
	handle.Massless = false
	handle.Parent = tool
	if item.shape == "lantern" then
		local light = Instance.new("PointLight")
		light.Color = Color3.fromRGB(255, 200, 120)
		light.Range = 14
		light.Brightness = 1.5
		light.Parent = handle
	end
	return tool
end

-- Anchored preview model of any item (for shop ViewportFrames).
function Props.preview(item: Items.Item): Model
	local model = Instance.new("Model")
	model.Name = item.id
	if item.kind == "balloon" then
		local b = Props.balloon(item)
		for _, d in b:GetDescendants() do
			if d:IsA("BasePart") then
				(d :: BasePart).Anchored = true
			end
		end
		b.Parent = model
		model.PrimaryPart = b.PrimaryPart
		return model
	end
	local root = assemble(Props.itemPieces(item), "Root", false)
	root.Parent = model
	model.PrimaryPart = root
	return model
end

---------------------------------------------------------------------------
-- Guest figures (no Humanoid; cheap anchored parts)
---------------------------------------------------------------------------
local SKIN = {
	Color3.fromRGB(255, 220, 190),
	Color3.fromRGB(240, 190, 150),
	Color3.fromRGB(200, 140, 100),
	Color3.fromRGB(150, 100, 70),
	Color3.fromRGB(100, 66, 46),
	Color3.fromRGB(250, 205, 70), -- classic yellow
}
local SHIRTS = {
	Color3.fromRGB(196, 40, 40),
	Color3.fromRGB(30, 110, 230),
	Color3.fromRGB(255, 140, 26),
	Color3.fromRGB(64, 160, 72),
	Color3.fromRGB(240, 240, 240),
	Color3.fromRGB(150, 110, 200),
	Color3.fromRGB(250, 210, 40),
	Color3.fromRGB(40, 40, 46),
	Color3.fromRGB(240, 120, 170),
	Color3.fromRGB(60, 200, 200),
}
local PANTS = {
	Color3.fromRGB(40, 60, 110),
	Color3.fromRGB(30, 30, 34),
	Color3.fromRGB(110, 90, 70),
	Color3.fromRGB(70, 70, 76),
	Color3.fromRGB(180, 160, 120),
}
local GUEST_HATS = { "GearEars", "TruckerCap", "CowboyHat", "HardHat", "CaptainHat", "RacingHelmet" }

-- Build a guest figure. The root sits where a player's HumanoidRootPart
-- would be. pose = "sit" | "stand" | "cheer".
function Props.guest(seed: number, pose: string): Model
	local rng = Random.new(seed)
	local skin = SKIN[rng:NextInteger(1, #SKIN)]
	local shirt = SHIRTS[rng:NextInteger(1, #SHIRTS)]
	local pants = PANTS[rng:NextInteger(1, #PANTS)]
	local scale = rng:NextNumber(0.75, 1.0)
	local pieces: { Piece } = {
		piece("block", Vector3.new(1.9, 1.9, 1) * scale, CFrame.new(0, 0, 0), shirt), -- torso / root
		piece("round", Vector3.new(1.15, 1.15, 1.15) * scale, CFrame.new(0, 1.55 * scale, 0), skin),
	}
	local armUp = pose == "cheer"
	for _, side in { -1, 1 } do
		local armCF = if armUp
			then CFrame.new(side * 1.45 * scale, 1.2 * scale, 0) * CFrame.Angles(0, 0, side * math.rad(-20))
			else CFrame.new(side * 1.45 * scale, -0.05 * scale, 0)
		table.insert(pieces, piece("block", Vector3.new(0.9, 1.9, 0.9) * scale, armCF, shirt))
		if pose == "sit" then
			table.insert(pieces, piece("block", Vector3.new(0.9, 0.9, 1.9) * scale, CFrame.new(side * 0.48 * scale, -1.4 * scale, -0.5 * scale), pants))
			table.insert(pieces, piece("block", Vector3.new(0.9, 1.4, 0.9) * scale, CFrame.new(side * 0.48 * scale, -2.0 * scale, -1.0 * scale), pants))
		else
			table.insert(pieces, piece("block", Vector3.new(0.9, 1.9, 0.9) * scale, CFrame.new(side * 0.48 * scale, -1.9 * scale, 0), pants))
		end
	end
	-- eyes
	table.insert(pieces, piece("block", Vector3.new(0.14, 0.2, 0.05) * scale, CFrame.new(-0.22 * scale, 1.62 * scale, -0.56 * scale), Color3.fromRGB(20, 20, 20)))
	table.insert(pieces, piece("block", Vector3.new(0.14, 0.2, 0.05) * scale, CFrame.new(0.22 * scale, 1.62 * scale, -0.56 * scale), Color3.fromRGB(20, 20, 20)))
	local model = Instance.new("Model")
	model.Name = "Guest"
	local root, parts = assemble(pieces, "Root", false)
	root.Parent = model
	model.PrimaryPart = root
	for _, p in parts do
		p.CastShadow = false
	end
	if rng:NextNumber() < 0.35 then
		local hat = Items.ById[GUEST_HATS[rng:NextInteger(1, #GUEST_HATS)]]
		local hatModel = Props.hatModel(hat, CFrame.new(0, 2.1 * scale, 0))
		hatModel.Parent = model
	end
	return model
end

return Props
