-- Queue lines on the client: draws the simulated guests standing in each
-- ride's queue maze from the line order the server publishes, and walks the
-- local player forward with the line while they aren't steering.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)
local Props = require(Shared.Props)
local QueueLine = require(Shared.QueueLine)

local QueueView = {}

local FLOOR = 0.55 -- top of the queue floor
local WALK = 7 -- how fast guests shuffle forward (studs/s)
local SHOW_WITHIN = 360 -- draw lines this close to the camera
local HIDE_BEYOND = 420

type Token = { key: string, seed: number, player: boolean }
type Visual = { model: Model, s: number, lift: number, moving: boolean }
type LineState = {
	id: string,
	line: QueueLine.Line,
	folder: Instance,
	tokens: { Token },
	visuals: { [string]: Visual },
	shown: boolean,
	snap: boolean,
}

local lines: { LineState } = {}
local localPlayer = Players.LocalPlayer
local container: Folder

local function parse(value: any): { Token }
	local out: { Token } = {}
	if type(value) ~= "string" or value == "" then
		return out
	end
	for tok in string.gmatch(value, "[^,]+") do
		if string.sub(tok, 1, 1) == "p" then
			table.insert(out, { key = tok, seed = 0, player = true })
		else
			local seed = tonumber(string.match(tok, ":(%d+)$")) or 1
			table.insert(out, { key = tok, seed = seed, player = false })
		end
	end
	return out
end

local function place(v: Visual, line: QueueLine.Line, bob: number)
	local pos, facing = QueueLine.pointAt(line, v.s)
	local at = pos + Vector3.new(0, FLOOR + v.lift + bob, 0)
	v.model:PivotTo(CFrame.lookAt(at, at + facing))
end

local function makeGuest(seed: number): (Model, number)
	local model = Props.guest(seed, "stand")
	model.Name = "QueueGuest"
	model.Parent = container
	-- how far the pivot sits above the guest's feet
	local cf, size = model:GetBoundingBox()
	local lift = model:GetPivot().Position.Y - (cf.Position.Y - size.Y / 2)
	return model, lift
end

local function clear(ls: LineState)
	for key, v in ls.visuals do
		v.model:Destroy()
		ls.visuals[key] = nil
	end
end

local function updateLine(ls: LineState, dt: number, now: number)
	local seen: { [string]: boolean } = {}
	for index, tok in ls.tokens do
		if tok.player then
			continue
		end
		seen[tok.key] = true
		local target = QueueLine.slot(index)
		local v = ls.visuals[tok.key]
		if not v then
			local model, lift = makeGuest(tok.seed)
			-- newcomers walk in from outside the entrance sign
			local start = if ls.snap then target else math.max(target, math.min(ls.line.length, ls.line.signAt + 4))
			v = { model = model, s = start, lift = lift, moving = true }
			ls.visuals[tok.key] = v
		end
		local visual = v :: Visual
		local gap = target - visual.s
		if math.abs(gap) > 0.05 then
			visual.s += math.clamp(gap, -WALK * dt, WALK * dt)
			visual.moving = true
			place(visual, ls.line, math.abs(math.sin(now * 9 + tok.seed)) * 0.35)
		elseif visual.moving then
			visual.moving = false
			place(visual, ls.line, 0)
		end
	end
	for key, v in ls.visuals do
		if not seen[key] then
			v.model:Destroy()
			ls.visuals[key] = nil
		end
	end
	ls.snap = false
end

-- Next point for the local player to walk to, or nil when in their spot.
local function lineTarget(root: BasePart): Vector3?
	local rideId = localPlayer:GetAttribute("QueueRide")
	local pos = localPlayer:GetAttribute("QueuePos")
	if type(rideId) ~= "string" or rideId == "" or type(pos) ~= "number" or pos < 1 then
		return nil
	end
	local riding = localPlayer:GetAttribute("Riding")
	if type(riding) == "string" and riding ~= "" then
		return nil
	end
	local line = QueueLine.get(rideId)
	if not line then
		return nil
	end
	local slot = QueueLine.slot(pos)
	local along, off = QueueLine.project(line, root.Position)
	if off > 1.5 then
		return (QueueLine.pointAt(line, along))
	end
	if math.abs(along - slot) < 0.6 then
		return nil
	end
	-- walk to the next bend between here and our spot
	local cum = line.cum
	if slot < along then
		for i = #cum, 1, -1 do
			if cum[i] < along - 0.05 and cum[i] > slot then
				return line.points[i]
			end
		end
	else
		for i = 1, #cum do
			if cum[i] > along + 0.05 and cum[i] < slot then
				return line.points[i]
			end
		end
	end
	return (QueueLine.pointAt(line, slot))
end

local shuffleTimer = 0
local function shuffle(dt: number)
	shuffleTimer += dt
	if shuffleTimer < 0.2 then
		return
	end
	shuffleTimer = 0
	local character = localPlayer.Character
	local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	local hum = character and character:FindFirstChildOfClass("Humanoid")
	if not root or not hum then
		return
	end
	-- the player is steering themselves
	if hum.MoveDirection.Magnitude > 0.1 then
		return
	end
	local target = lineTarget(root)
	if target then
		hum:MoveTo(Vector3.new(target.X, root.Position.Y, target.Z))
	end
end

function QueueView.start()
	container = Instance.new("Folder")
	container.Name = "BentonQueueGuests"
	container.Parent = workspace
	local rideState = Net.state():WaitForChild("Rides")
	for _, ride in Config.Rides do
		local line = QueueLine.get(ride.id)
		local folder = rideState:WaitForChild(ride.id, 10)
		if line and folder then
			local ls: LineState = {
				id = ride.id,
				line = line,
				folder = folder,
				tokens = parse(folder:GetAttribute("Line")),
				visuals = {},
				shown = false,
				snap = true,
			}
			folder:GetAttributeChangedSignal("Line"):Connect(function()
				ls.tokens = parse(folder:GetAttribute("Line"))
			end)
			table.insert(lines, ls)
		end
	end
	RunService.RenderStepped:Connect(function(dt)
		local camera = workspace.CurrentCamera
		local camPos = if camera then camera.CFrame.Position else Vector3.zero
		local now = os.clock()
		for _, ls in lines do
			local d = (Vector3.new(camPos.X, 0, camPos.Z) - ls.line.gate).Magnitude
			if ls.shown and d > HIDE_BEYOND then
				ls.shown = false
				clear(ls)
			elseif not ls.shown and d < SHOW_WITHIN then
				ls.shown = true
				ls.snap = true
			end
			if ls.shown then
				updateLine(ls, dt, now)
			end
		end
		shuffle(dt)
	end)
end

return QueueView
