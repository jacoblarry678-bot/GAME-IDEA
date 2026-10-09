-- Ride crews and park staff on the client. While a train boards, the
-- attendants walk the loading platform car by car and push every lap bar
-- or harness down (riders pull most of their own first), give the operator
-- a thumbs up, and wave the train off; restraints lift again at unload.
-- Staff at shops, carts and the gate say hello as you come by, and
-- sweepers work the walkways. Speech shows as bubbles over their heads.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local CollectionService = game:GetService("CollectionService")
local UserInputService = game:GetService("UserInputService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Clock = require(Shared.Clock)
local Net = require(Shared.Net)
local Props = require(Shared.Props)
local RideMotion = require(Shared.RideMotion)
local Staff = require(Shared.Staff)

local RideStaff = {}

local localPlayer = Players.LocalPlayer
local HIDDEN = CFrame.new(0, -500, 0)
local STAND = Props.STAND_HEIGHT

-- hinge (seat space) and opening angle of each restraint type
type Hinge = { at: CFrame, open: number }
local HINGE: { [string]: Hinge } = {
	lapbar = { at = CFrame.new(0, -1.9, -1.5), open = math.rad(-60) },
	harness = { at = CFrame.new(0, 1.6, 0.5), open = math.rad(100) },
}

type Bar = { part: BasePart, car: number, seat: number, closedRel: CFrame, hinge: CFrame, open: number, angle: number, target: number }
type Task = { kind: string, to: Vector3?, yaw: number?, stop: number?, dur: number?, time: number, done: boolean, speed: number? }
type Person = { models: { [string]: Model }, shown: string, pos: Vector3, yaw: number, homePos: Vector3, homeYaw: number, route: { number }, tasks: { Task }, bob: number }
type CrewState = {
	ride: Config.Ride,
	crew: Staff.Crew,
	folder: Instance,
	cars: { Model },
	seats: { { CFrame } },
	bars: { Bar },
	attendants: { Person },
	operator: Model?,
	cycle: number,
	status: string,
	said: { [string]: boolean },
	pulls: { { car: number, seat: number, at: number, done: boolean } },
	runSince: number,
	chatter: number,
}

local crews: { CrewState } = {}
local holder: Folder

local function pick(list: { string }?): string
	if not list or #list == 0 then
		return ""
	end
	return list[math.random(1, #list)]
end

local function yawCFrame(pos: Vector3, yaw: number): CFrame
	return CFrame.new(pos) * CFrame.Angles(0, yaw, 0)
end

local function yawOf(cf: CFrame): number
	local look = cf.LookVector
	return math.atan2(-look.X, -look.Z)
end

---------------------------------------------------------------------------
-- Speech bubbles
---------------------------------------------------------------------------
local function say(model: Model?, text: string)
	if not model or text == "" then
		return
	end
	local root = model.PrimaryPart
	if not root then
		return
	end
	local camera = workspace.CurrentCamera
	if camera and (camera.CFrame.Position - root.Position).Magnitude > 80 then
		return
	end
	local old = root:FindFirstChild("Speech")
	if old then
		old:Destroy()
	end
	local gui = Instance.new("BillboardGui")
	gui.Name = "Speech"
	gui.Size = UDim2.fromOffset(240, 44)
	gui.StudsOffset = Vector3.new(0, 3.6, 0)
	gui.MaxDistance = 80
	gui.LightInfluence = 0
	gui.Parent = root
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	label.BackgroundTransparency = 0.05
	label.TextColor3 = Color3.fromRGB(27, 34, 51)
	label.FontFace = Font.fromEnum(Enum.Font.GothamBold)
	label.TextScaled = true
	label.Text = text
	label.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.4, 0)
	corner.Parent = label
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 10)
	pad.PaddingRight = UDim.new(0, 10)
	pad.Parent = label
	task.delay(2.8, function()
		if gui.Parent then
			gui:Destroy()
		end
	end)
end

---------------------------------------------------------------------------
-- Attendants
---------------------------------------------------------------------------
local POSES = { "stand", "check", "thumbs", "wave" }

local function newPerson(seed: number, land: string, at: CFrame): Person
	local models = {}
	for _, pose in POSES do
		local m = Staff.figure(seed, land, pose)
		m.Name = "Attendant"
		m:PivotTo(HIDDEN)
		m.Parent = holder
		models[pose] = m
	end
	return {
		models = models,
		shown = "",
		pos = at.Position,
		yaw = yawOf(at),
		homePos = at.Position,
		homeYaw = yawOf(at),
		route = {},
		tasks = {},
		bob = 0,
	}
end

local function show(p: Person, pose: string)
	if p.shown ~= pose then
		local old = p.models[p.shown]
		if old then
			old:PivotTo(HIDDEN)
		end
		p.shown = pose
	end
	local lift = math.abs(math.sin(p.bob)) * 0.25
	p.models[pose]:PivotTo(yawCFrame(p.pos + Vector3.new(0, STAND + lift, 0), p.yaw))
end

local function turn(from: number, to: number, k: number): number
	local d = math.atan2(math.sin(to - from), math.cos(to - from))
	return from + d * math.min(1, k)
end

---------------------------------------------------------------------------
-- Restraints
---------------------------------------------------------------------------
local function collectBars(c: CrewState)
	local hinge = HINGE[c.crew.restraint]
	if not hinge then
		return
	end
	for ci, car in c.cars do
		local seats = c.seats[ci] or {}
		local n = 0
		for _, d in car:GetDescendants() do
			if d.Name == "Restraint" and d:IsA("BasePart") then
				local part = d :: BasePart
				n += 1
				local seat = seats[n]
				if seat then
					local pivot = car:GetPivot()
					table.insert(c.bars, {
						part = part,
						car = ci,
						seat = n,
						closedRel = pivot:Inverse() * part.CFrame,
						hinge = seat * hinge.at,
						open = hinge.open,
						angle = 0,
						target = hinge.open,
					})
				end
			end
		end
	end
end

local function poseBar(c: CrewState, b: Bar)
	local car = c.cars[b.car]
	-- rotate the closed position about the hinge (all in car space)
	local rel = b.hinge * CFrame.Angles(b.angle, 0, 0) * b.hinge:Inverse() * b.closedRel
	b.part.CFrame = car:GetPivot() * rel
end

local function setBar(c: CrewState, car: number, seat: number, closed: boolean): boolean
	for _, b in c.bars do
		if b.car == car and b.seat == seat then
			local target = if closed then 0 else b.open
			if b.target == target then
				return false
			end
			b.target = target
			return true
		end
	end
	return false
end

local function setAll(c: CrewState, closed: boolean)
	for _, b in c.bars do
		b.target = if closed then 0 else b.open
	end
end

---------------------------------------------------------------------------
-- Boarding
---------------------------------------------------------------------------
type Rider = { c: number, s: number, u: number, n: number }

local function riders(c: CrewState): { Rider }
	local raw = c.folder:GetAttribute("Riders")
	if type(raw) ~= "string" or raw == "" then
		return {}
	end
	local ok, data = pcall(function()
		return HttpService:JSONDecode(raw)
	end)
	return if ok and type(data) == "table" then data :: any else {}
end

local function plan(c: CrewState, p: Person, e: number)
	local B = Config.BoardingTime
	local start = math.max(e, Staff.CHECK_FROM)
	local avail = math.max(1.2, B - Staff.ALL_CLEAR - start - 0.2)
	local pts = { p.pos }
	for _, i in p.route do
		table.insert(pts, c.crew.stops[i].Position)
	end
	local flat = c.ride.kind == "carousel" or c.ride.kind == "spinner" or c.ride.kind == "pendulum" or c.ride.kind == "droptower"
	if flat then
		table.insert(pts, p.homePos)
	end
	local dist = 0
	for i = 2, #pts do
		dist += (pts[i] - pts[i - 1]).Magnitude
	end
	local n = #p.route
	local dwell, speed = Staff.CHECK_TIME, Staff.WALK
	if dist / speed + n * dwell > avail then
		dwell = math.max(0.3, math.min(Staff.CHECK_TIME, avail * 0.3 / math.max(1, n)))
		speed = math.min(18, dist / math.max(0.4, avail - n * dwell))
	end
	p.tasks = {}
	if e < Staff.CHECK_FROM then
		table.insert(p.tasks, { kind = "wait", dur = Staff.CHECK_FROM - e, time = 0, done = false })
	end
	for _, i in p.route do
		local stop = c.crew.stops[i]
		table.insert(p.tasks, { kind = "walk", to = stop.Position, time = 0, done = false, speed = speed })
		table.insert(p.tasks, { kind = "check", stop = i, yaw = yawOf(stop), dur = dwell, time = 0, done = false })
	end
	if flat then
		table.insert(p.tasks, { kind = "walk", to = p.homePos, yaw = p.homeYaw, time = 0, done = false, speed = speed })
	end
end

-- an attendant reaches a car: push down every restraint there
local function check(c: CrewState, p: Person, stop: number, list: { Rider })
	local car = c.crew.stopCars[stop]
	local seats = c.seats[car] or {}
	-- one big car checked from several stops: split its seats between them
	local same = {}
	for i, cc in c.crew.stopCars do
		if cc == car then
			table.insert(same, i)
		end
	end
	local first, last = 1, #seats
	if #same > 1 then
		local k = (table.find(same, stop) or 1) :: number
		local per = math.ceil(#seats / #same)
		first = (k - 1) * per + 1
		last = math.min(#seats, k * per) :: number
	end
	local mine = false
	for s = first, last :: number do
		for _, r in list do
			if r.c == car and r.s == s and r.u == localPlayer.UserId then
				mine = true
			end
		end
		setBar(c, car, s, true)
	end
	if mine then
		say(p.models[p.shown], pick(Staff.LINES.check))
	elseif math.random() < 0.3 then
		say(p.models[p.shown], pick(if c.crew.restraint == "none" then Staff.LINES.checkNone else Staff.LINES.check))
	end
end

local function step(c: CrewState, p: Person, dt: number, list: { Rider })
	local t = p.tasks[1]
	if not t then
		return "stand"
	end
	if t.kind == "walk" then
		local to = t.to :: Vector3
		local d = Vector3.new(to.X - p.pos.X, 0, to.Z - p.pos.Z)
		local move = (t.speed or Staff.WALK) * dt
		if d.Magnitude <= move or d.Magnitude < 0.05 then
			p.pos = to
			table.remove(p.tasks, 1)
			if t.yaw then
				p.yaw = t.yaw
			end
		else
			local u = d.Unit
			p.pos = Vector3.new(p.pos.X + u.X * move, p.pos.Y + (to.Y - p.pos.Y) * math.min(1, dt * 6), p.pos.Z + u.Z * move)
			p.yaw = turn(p.yaw, math.atan2(-u.X, -u.Z), dt * 10)
			p.bob += dt * 9
		end
		return "stand"
	elseif t.kind == "check" then
		t.time += dt
		p.yaw = turn(p.yaw, t.yaw or p.yaw, dt * 10)
		if not t.done and t.time >= (t.dur or 0.5) * 0.55 then
			t.done = true
			check(c, p, t.stop or 1, list)
		end
		if t.time >= (t.dur or 0.5) then
			table.remove(p.tasks, 1)
		end
		return "check"
	else
		t.time += dt
		if t.time >= (t.dur or 0) then
			table.remove(p.tasks, 1)
		end
		return if t.kind == "wave" then "wave" else "stand"
	end
end

local function finish(c: CrewState, p: Person, list: { Rider })
	for _, t in p.tasks do
		if t.kind == "check" and not t.done then
			t.done = true
			check(c, p, t.stop or 1, list)
		elseif t.kind == "walk" then
			p.pos = t.to :: Vector3
		end
	end
	p.tasks = {}
end

local function updateCrew(c: CrewState, dt: number)
	local status = c.folder:GetAttribute("Status")
	if type(status) ~= "string" then
		return
	end
	local cycle = c.folder:GetAttribute("CycleId")
	local start = c.folder:GetAttribute("CycleStart")
	local now = Clock.now()
	local B = Config.BoardingTime
	local list = riders(c)
	local opModel = c.operator
	if status == "Boarding" and type(start) == "number" then
		local e = math.clamp(now - (start - B), 0, B)
		if cycle ~= c.cycle or c.status ~= "Boarding" then
			c.cycle = if type(cycle) == "number" then cycle else c.cycle + 1
			c.said = {}
			setAll(c, false)
			c.pulls = {}
			for _, r in list do
				if r.u == 0 and r.c > 0 and math.random() > 0.18 then
					table.insert(c.pulls, { car = r.c, seat = r.s, at = 0.6 + math.random() * (Staff.PULL_BY - 0.6), done = false })
				end
			end
			for _, p in c.attendants do
				plan(c, p, e)
			end
		end
		for _, pull in c.pulls do
			if not pull.done and e >= pull.at then
				pull.done = true
				setBar(c, pull.car, pull.seat, true)
			end
		end
		if e < 2.5 and not c.said.pull then
			c.said.pull = true
			local r = c.crew.restraint
			say(opModel, pick(if r == "harness" then Staff.LINES.pullHarness elseif r == "belt" then Staff.LINES.belt elseif r == "lapbar" then Staff.LINES.pull else Staff.LINES.checkNone))
		end
		if e >= B - Staff.DISPATCH and not c.said.dispatch then
			c.said.dispatch = true
			say(opModel, pick(Staff.LINES.dispatch))
		end
		for k, p in c.attendants do
			local pose = step(c, p, dt, list)
			if e >= B - Staff.ALL_CLEAR and #p.tasks > 0 then
				finish(c, p, list)
			end
			if #p.tasks == 0 and e >= B - Staff.ALL_CLEAR then
				pose = "thumbs"
				if k == 1 and not c.said.clear then
					c.said.clear = true
					say(p.models.thumbs, pick(Staff.LINES.clear))
				end
			end
			show(p, pose)
		end
	elseif status == "Running" then
		if c.status ~= "Running" then
			-- every restraint locks as the train leaves the station
			for _, b in c.bars do
				b.angle, b.target = 0, 0
				poseBar(c, b)
			end
			for _, p in c.attendants do
				p.tasks = {
					{ kind = "wave", dur = 2.4, time = 0, done = false },
					{ kind = "walk", to = p.homePos, yaw = p.homeYaw, time = 0, done = false, speed = Staff.WALK * 0.7 },
				}
			end
		end
		for _, p in c.attendants do
			show(p, step(c, p, dt, list))
		end
	else
		if status == "Unloading" and c.status ~= "Unloading" then
			setAll(c, false)
			say(opModel, pick(Staff.LINES.unload))
		elseif status ~= c.status then
			setAll(c, false)
		end
		for _, p in c.attendants do
			show(p, step(c, p, dt, list))
		end
		c.chatter -= dt
		if c.chatter <= 0 then
			c.chatter = 20 + math.random() * 25
			local character = localPlayer.Character
			local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
			if status == "Open" and root and opModel and opModel.PrimaryPart and (root.Position - opModel.PrimaryPart.Position).Magnitude < 30 then
				say(opModel, pick(Staff.LINES.wait))
			end
		end
	end
	c.status = status
	-- swing restraints (only while the cars sit in the station)
	if status ~= "Running" then
		for _, b in c.bars do
			if b.angle ~= b.target then
				local stepA = dt * 3
				local d = b.target - b.angle
				b.angle = if math.abs(d) <= stepA then b.target else b.angle + math.sign(d) * stepA
				poseBar(c, b)
			end
		end
	end
end

---------------------------------------------------------------------------
-- Park staff: greetings, and sweepers on the walkways
---------------------------------------------------------------------------
type Greeter = { model: Model, role: string, kind: string, greeted: boolean }
local greeters: { Greeter } = {}

local SWEEP_LINES = {
	{ Vector3.new(-14, 0.4, 222), Vector3.new(-14, 0.4, 6) },
	{ Vector3.new(-30, 0.4, 15), Vector3.new(-158, 0.4, 15) },
	{ Vector3.new(0, 0.4, -118), Vector3.new(0, 0.4, -290) },
	{ Vector3.new(112, 0.4, 60), Vector3.new(112, 0.4, 246) },
	{ Vector3.new(130, 0.4, -120), Vector3.new(215, 0.4, -180) },
}
type Sweeper = { model: Model, a: Vector3, b: Vector3, s: number, dir: number, pause: number }
local sweepers: { Sweeper } = {}

local function broom(m: Model)
	local root = m.PrimaryPart :: BasePart
	local function bit(size: Vector3, offset: CFrame, color: Color3, material: Enum.Material)
		local p = Instance.new("Part")
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.Size = size
		p.Color = color
		p.Material = material
		p.CFrame = root.CFrame * offset
		p.Parent = m
	end
	bit(Vector3.new(0.2, 4.4, 0.2), CFrame.new(0.9, -1.3, -1.3) * CFrame.Angles(math.rad(-30), 0, 0), Color3.fromRGB(110, 76, 44), Enum.Material.Wood)
	bit(Vector3.new(1.6, 0.4, 0.4), CFrame.new(0.9, -2.8, -2.35), Color3.fromRGB(170, 130, 70), Enum.Material.Fabric)
end

local function updatePark(dt: number)
	local character = localPlayer.Character
	local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if root then
		for _, g in greeters do
			local pp = g.model.PrimaryPart
			if pp then
				local d = (pp.Position - root.Position).Magnitude
				local range = if g.role == "greeter" then 22 else 15
				if d < range and not g.greeted then
					g.greeted = true
					local key = if g.role == "cashier" then (if g.kind == "restaurant" then "food" else "shop") elseif g.role == "vendor" then g.kind else g.role
					say(g.model, pick((Staff.LINES :: any)[key]))
				elseif d > 30 then
					g.greeted = false
				end
			end
		end
	end
	for _, s in sweepers do
		local len = (s.b - s.a).Magnitude
		if s.pause > 0 then
			s.pause -= dt
		else
			s.s += dt * 0.9 * s.dir / len
			if s.s > 1 or s.s < 0 then
				s.dir = -s.dir
				s.s = math.clamp(s.s, 0, 1)
				s.pause = 3
			end
		end
		local p = s.a:Lerp(s.b, s.s) + (s.b - s.a).Unit:Cross(Vector3.yAxis) * 6
		local look = (s.b - s.a).Unit * s.dir
		s.model:PivotTo(CFrame.lookAt(p + Vector3.new(0, STAND, 0), p + Vector3.new(0, STAND, 0) + look))
	end
end

---------------------------------------------------------------------------
-- The player's own restraint
---------------------------------------------------------------------------
local function pullMine()
	local riding = localPlayer:GetAttribute("Riding")
	if type(riding) ~= "string" or riding == "" then
		return
	end
	for _, c in crews do
		if c.ride.id == riding and c.status == "Boarding" then
			for _, r in riders(c) do
				if r.u == localPlayer.UserId then
					setBar(c, r.c, r.s, true)
				end
			end
		end
	end
end

function RideStaff.start(root: Instance)
	holder = Instance.new("Folder")
	holder.Name = "RideStaff"
	holder.Parent = workspace
	local rides = root:WaitForChild("Rides")
	local stateRides = Net.state():WaitForChild("Rides")
	for _, ride in Config.Rides do
		local crew = Staff.crew(ride.id)
		local model = rides:WaitForChild(ride.id, 30)
		local folder = stateRides:WaitForChild(ride.id, 30)
		if crew and model and folder then
			local motion = RideMotion.get(ride.id)
			local carsFolder = model:WaitForChild("Cars")
			local cars = {}
			for i = 1, motion.carCount do
				cars[i] = carsFolder:WaitForChild("Car" .. i) :: Model
			end
			local c: CrewState = {
				ride = ride,
				crew = crew,
				folder = folder,
				cars = cars,
				seats = motion.seats,
				bars = {},
				attendants = {},
				operator = nil,
				cycle = -1,
				status = "",
				said = {},
				pulls = {},
				runSince = 0,
				chatter = 10 + math.random() * 20,
			}
			for _, m in CollectionService:GetTagged("StaffSpot") do
				if m:GetAttribute("RideId") == ride.id and m:IsA("Model") then
					c.operator = m :: Model
				end
			end
			collectBars(c)
			for k = 1, crew.attendants do
				local p = newPerson(#ride.id * 53 + k * 7, ride.land, crew.homes[k])
				p.route = Staff.route(crew, k)
				show(p, "stand")
				table.insert(c.attendants, p)
			end
			table.insert(crews, c)
		end
	end
	for _, m in CollectionService:GetTagged("StaffSpot") do
		local role = m:GetAttribute("Role")
		if m:IsA("Model") and type(role) == "string" and role ~= "operator" then
			local kind = m:GetAttribute("Kind")
			table.insert(greeters, { model = m :: Model, role = role, kind = if type(kind) == "string" then kind else "", greeted = false })
		end
	end
	for i, line in SWEEP_LINES do
		local m = Staff.figure(7700 + i * 13, "Plaza", "check")
		m.Name = "Sweeper"
		m.Parent = holder
		broom(m)
		table.insert(sweepers, { model = m, a = line[1], b = line[2], s = i * 0.17, dir = if i % 2 == 0 then 1 else -1, pause = 0 })
	end
	UserInputService.InputBegan:Connect(function(input, processed)
		if not processed and input.KeyCode == Enum.KeyCode.E then
			pullMine()
		end
	end)
	RunService.RenderStepped:Connect(function(dt: number)
		for _, c in crews do
			updateCrew(c, math.min(dt, 0.25))
		end
		updatePark(dt)
	end)
end

return RideStaff
