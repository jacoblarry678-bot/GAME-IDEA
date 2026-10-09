-- Terrain, perimeter wall, parking lot, front gate and the spawn.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Kit = require(script.Parent.Kit)
local Staff = require(Shared.Staff)

local M = Enum.Material
local C = Config.Colors

local Ground = {}

local function terrain()
	local t = workspace.Terrain
	-- grass everywhere, surface at y = 0 (filled in tiles to keep each
	-- terrain write small)
	for x = -550, 450, 200 do
		for z = -590, 410, 200 do
			t:FillBlock(CFrame.new(x + 100, -6, z + 100), Vector3.new(200, 12, 200), M.Grass)
		end
	end
	-- rolling hills outside the walls
	local rng = Random.new(7)
	for _ = 1, 26 do
		local side = rng:NextInteger(1, 3)
		local x: number, z: number
		if side == 1 then
			x, z = rng:NextNumber(-540, -420), rng:NextNumber(-520, 420)
		elseif side == 2 then
			x, z = rng:NextNumber(420, 540), rng:NextNumber(-520, 420)
		else
			x, z = rng:NextNumber(-500, 500), rng:NextNumber(-560, -450)
		end
		t:FillBall(Vector3.new(x, -20, z), rng:NextNumber(40, 70), M.Grass)
	end
	-- the lake at Benton Family Landing
	t:FillCylinder(CFrame.new(235, -4, 125), 10, 52, M.Air)
	t:FillCylinder(CFrame.new(235, -6, 125), 9, 54, M.Sand)
	t:FillCylinder(CFrame.new(235, -2.5, 125), 4, 50, M.Water)
	-- Splashdown pool and river basin at Backwoods Rapids
	t:FillBlock(CFrame.new(-264, -2, -296), Vector3.new(16, 6, 28), M.Water)
	-- Backwoods ridge (behind the flume and the tow-truck coaster)
	local rocks = {
		{ -345, -8, -392, 34 },
		{ -315, -12, -398, 32 },
		{ -285, -14, -400, 28 },
		{ -362, -10, -330, 22 },
		{ -250, -16, -398, 24 },
		{ -215, -18, -400, 22 },
		{ -365, -14, -270, 18 },
	}
	for _, r in rocks do
		t:FillBall(Vector3.new(r[1], r[2], r[3]), r[4], M.Rock)
	end
	t:FillBall(Vector3.new(-300, -6, -330), 16, M.Rock)
	t:FillBall(Vector3.new(-312, -4, -305), 12, M.Ground)
end

local function wall(parent: Instance)
	local b = Config.Bounds
	local h = 14
	local stone = Color3.fromRGB(150, 146, 140)
	local cap = Color3.fromRGB(196, 190, 180)
	local function segment(a: Vector3, c: Vector3)
		local d = c - a
		local len = d.Magnitude
		local mid = (a + c) / 2
		Kit.block(parent, Vector3.new(2.5, h, len), CFrame.lookAt(mid + Vector3.new(0, h / 2, 0), c + Vector3.new(0, h / 2, 0)), stone, M.Concrete)
		Kit.block(parent, Vector3.new(3.4, 1, len + 1), CFrame.lookAt(mid + Vector3.new(0, h + 0.5, 0), c + Vector3.new(0, h + 0.5, 0)), cap, M.Concrete)
		local n = math.floor(len / 40)
		for i = 0, n do
			local p = a + d * (i / math.max(n, 1))
			Kit.box(parent, Vector3.new(4.5, h + 3, 4.5), p, cap, M.Concrete)
		end
	end
	local sw = Vector3.new(b.minX, 0, b.maxZ)
	local se = Vector3.new(b.maxX, 0, b.maxZ)
	local nw = Vector3.new(b.minX, 0, b.minZ)
	local ne = Vector3.new(b.maxX, 0, b.minZ)
	segment(nw, ne)
	segment(nw, sw)
	segment(ne, se)
	-- south wall with a gap for the gate (x -42..42)
	segment(sw, Vector3.new(-42, 0, b.maxZ))
	segment(Vector3.new(42, 0, b.maxZ), se)
	-- slogan panels on the outside of the south wall (as on the park map)
	local slogans = {
		{ x = -220, text = "WORKSHOPS - MOVIES - THRILLS - FAMILIES - A BRIGHTER TOMORROW" },
		{ x = -120, text = "BUILT TO KEEP THE WORLD MOVING" },
		{ x = 120, text = "SPEED FUELS PEOPLE TOGETHER" },
		{ x = 220, text = "DIESEL FANS - BRIGHTER TOMORROWS" },
	}
	for _, s in slogans do
		local cf = CFrame.new(s.x, 8, b.maxZ + 1.4) * CFrame.Angles(0, math.pi, 0)
		Kit.sign(parent, s.text, Vector3.new(70, 7, 0.4), cf, { bg = Color3.fromRGB(70, 72, 80), fg = C.Cream, font = Enum.Font.GothamBold })
		Kit.gear(parent, CFrame.new(s.x - 42, 8, b.maxZ + 1.6) * CFrame.Angles(0, math.pi, 0), 6, Color3.fromRGB(40, 40, 46))
	end
end

local function parking(parent: Instance)
	local asphalt = Color3.fromRGB(70, 72, 76)
	Kit.pad(parent, -320, 296, 320, 470, asphalt, M.Asphalt, 0.3)
	-- forecourt between the lot and the gate
	Kit.pad(parent, -70, 281, 70, 345, C.Paver, M.Brick, 0.42)
	-- parking stripes and cars
	local carColors = { C.Red, C.Blue, Color3.fromRGB(240, 240, 240), Color3.fromRGB(30, 30, 34), C.Gold, Color3.fromRGB(120, 130, 140), C.Green }
	local rng = Random.new(99)
	for row = 0, 3 do
		local z = 370 + row * 26
		for col = -14, 14 do
			local x = col * 20
			if math.abs(x) > 80 then
				Kit.block(parent, Vector3.new(0.4, 0.05, 12), CFrame.new(x - 10, 0.33, z), Color3.fromRGB(240, 240, 240), M.SmoothPlastic)
				if rng:NextNumber() < 0.55 then
					local car = Kit.model("Car", parent)
					local color = carColors[rng:NextInteger(1, #carColors)]
					local base = Vector3.new(x, 0.3, z)
					Kit.box(car, Vector3.new(6.5, 2.4, 11), base + Vector3.new(0, 0.9, 0), color, M.SmoothPlastic)
					Kit.box(car, Vector3.new(6, 2.2, 6), base + Vector3.new(0, 3.3, 0.5), Color3.fromRGB(160, 200, 230), M.Glass)
					for _, wx in { -3.2, 3.2 } do
						for _, wz in { -3.6, 3.6 } do
							Kit.cyl(car, 0.8, 2.6, CFrame.new(base + Vector3.new(wx, 1.3, wz)), Color3.fromRGB(25, 25, 25), M.SmoothPlastic)
						end
					end
				end
			end
		end
	end
	-- coach buses along the east side
	for i = 0, 2 do
		local base = Vector3.new(250, 0.3, 365 + i * 22)
		local bus = Kit.model("Bus", parent)
		Kit.box(bus, Vector3.new(36, 11, 9), base + Vector3.new(0, 1.5, 0), Color3.fromRGB(240, 240, 236), M.SmoothPlastic)
		Kit.box(bus, Vector3.new(34, 3, 9.2), base + Vector3.new(0, 7, 0), Color3.fromRGB(30, 60, 120), M.Glass)
		Kit.box(bus, Vector3.new(36.2, 1.5, 9.2), base + Vector3.new(0, 3, 0), C.Orange, M.SmoothPlastic)
		for _, wx in { -12, 12 } do
			for _, wz in { -4.6, 4.6 } do
				Kit.cyl(bus, 1, 3.4, CFrame.new(base + Vector3.new(wx, 1.7, wz)) * CFrame.Angles(0, math.pi / 2, 0), Color3.fromRGB(25, 25, 25), M.SmoothPlastic)
			end
		end
	end
	for _, x in { -200, -120, 120, 200 } do
		for _, z in { 340, 420 } do
			Kit.lamp(parent, Vector3.new(x, 0.3, z))
		end
	end
end

local function gate(parent: Instance)
	local z = Config.Bounds.maxZ
	local stone = Color3.fromRGB(222, 214, 196)
	local dark = C.Navy
	-- two towers
	for _, sx in { -1, 1 } do
		local x = sx * 34
		Kit.box(parent, Vector3.new(14, 30, 16), Vector3.new(x, 0, z), stone, M.Concrete)
		Kit.box(parent, Vector3.new(16, 2, 18), Vector3.new(x, 30, z), dark, M.Concrete)
		local banner = Kit.block(parent, Vector3.new(7, 14, 0.3), CFrame.new(x, 15, z + 8.3), C.Red, M.Fabric)
		banner.CastShadow = false
		Kit.gear(parent, CFrame.new(x, 17, z + 8.6) * CFrame.Angles(0, math.pi, 0), 4.5, C.Cream, M.SmoothPlastic)
		-- ticket windows on the outside
		local booth = Kit.block(parent, Vector3.new(8, 4, 0.3), CFrame.new(x, 5, z + 8.2), Color3.fromRGB(150, 200, 230), M.Glass)
		booth.Transparency = 0.3
		Kit.sign(parent, "TICKETS", Vector3.new(8, 2, 0.3), CFrame.new(x, 8.2, z + 8.3) * CFrame.Angles(0, math.pi, 0), { bg = dark, fg = C.Gold, font = Enum.Font.GothamBlack, glow = true })
		Kit.flag(parent, Vector3.new(x, 32, z), if sx < 0 then C.Red else C.Blue, 12)
	end
	-- the arch with the park name
	Kit.block(parent, Vector3.new(56, 10, 12), CFrame.new(0, 27, z), stone, M.Concrete)
	Kit.block(parent, Vector3.new(58, 1.6, 14), CFrame.new(0, 32.8, z), dark, M.Concrete)
	Kit.sign(parent, "BENTON DIESEL WORLD", Vector3.new(50, 6, 0.4), CFrame.new(0, 26.5, z + 6.2) * CFrame.Angles(0, math.pi, 0), {
		bg = dark,
		fg = C.Cream,
		font = Enum.Font.GothamBlack,
		glow = true,
	})
	Kit.sign(parent, "WELCOME BACK - HAVE A GREAT DAY!", Vector3.new(44, 3.5, 0.4), CFrame.new(0, 26.5, z - 6.2), {
		bg = dark,
		fg = C.Gold,
		font = Enum.Font.GothamBold,
		glow = true,
	})
	Kit.gear(parent, CFrame.new(0, 37, z) * CFrame.Angles(0, math.pi, 0), 8, C.Gold)
	-- turnstiles (walk-through)
	for i = -3, 3 do
		local x = i * 6
		local post = Kit.box(parent, Vector3.new(1.2, 3.6, 3), Vector3.new(x - 2.4, 0.4, z), Color3.fromRGB(180, 184, 190), M.Metal)
		post.CanCollide = false
		local top = Kit.block(parent, Vector3.new(0.6, 0.6, 0.6), CFrame.new(x - 2.4, 4.3, z - 1), C.Green, M.Neon)
		top.CanCollide = false
	end
	-- greeters just inside the gate, welcoming guests in
	for i, x in { -24, 24 } do
		Staff.place(parent, "greeter", "Plaza", 4100 + i * 13, CFrame.lookAt(Vector3.new(x, 0.4, z - 10), Vector3.new(x * 0.6, 0.4, z + 10)))
	end
	-- palms and planters on the forecourt
	for _, x in { -60, -48, 48, 60 } do
		Kit.tree(parent, Vector3.new(x, 0.4, 300), "palm", 1)
	end
	Kit.flowerBed(parent, Vector3.new(-30, 0.4, 312), 18, 8)
	Kit.flowerBed(parent, Vector3.new(30, 0.4, 312), 18, 8)
	-- big welcome sign facing the parking lot
	Kit.postSign(parent, "BENTON DIESEL WORLD\nWorkshops - Movies - Thrills - Families", Vector3.new(0, 0.4, 352), Vector3.new(0, 0, 1), 34, 9, {
		bg = dark,
		fg = C.Cream,
		font = Enum.Font.GothamBlack,
		glow = true,
		both = true,
	})
end

local function spawn(parent: Instance)
	local s = Instance.new("SpawnLocation")
	s.Name = "MainGateSpawn"
	s.Size = Vector3.new(30, 1, 16)
	s.CFrame = CFrame.new(Config.Spawn - Vector3.new(0, 2.6, 0))
	s.Anchored = true
	s.Neutral = true
	s.Duration = 0
	s.Color = C.Paver
	s.Material = M.Brick
	s.TopSurface = Enum.SurfaceType.Smooth
	s.Transparency = 0
	s.Parent = parent
	local decal = s:FindFirstChildOfClass("Decal")
	if decal then
		decal:Destroy()
	end
end

function Ground.build(root: Instance)
	terrain()
	local folder = Kit.folder("Grounds", root)
	wall(folder)
	parking(folder)
	gate(folder)
	spawn(folder)
end

return Ground
