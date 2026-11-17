-- DataModel, services, players, require() and friends for the headless
-- test harness.

local M = _G.__mock
local S = M.state
local Methods = M.Methods
local Signal = M.Signal
local newInstance = M.newInstance
local getSignal = M.getSignal
local report = M.report
local typeOf = M.typeof

local game = newInstance("DataModel", true)
S[game].props.Name = "Game"
M.game = game
_G.game = game

local services = {}
local function getService(name: string)
	local svc = services[name]
	if svc then
		return svc
	end
	local info = M.classInfo(name)
	if not info or not info.Service then
		error("'" .. tostring(name) .. "' is not a valid Service name", 3)
	end
	svc = newInstance(name, true)
	S[svc].props.Name = name
	S[svc].parent = game
	table.insert(S[game].children, svc)
	services[name] = svc
	return svc
end
M.getService = getService

function Methods.GetService(inst, name)
	assert(inst == game, "GetService must be called on game")
	return getService(name)
end
Methods.FindService = Methods.GetService

local ws = getService("Workspace")
_G.workspace = ws
M.workspace = ws
for _, name in { "Players", "Lighting", "ReplicatedStorage", "ReplicatedFirst", "ServerScriptService", "ServerStorage", "StarterGui", "StarterPack", "StarterPlayer", "SoundService", "Teams", "TextChatService" } do
	getService(name)
end
local starterPlayer = getService("StarterPlayer")
local sps = newInstance("StarterPlayerScripts", true)
S[sps].props.Name = "StarterPlayerScripts"
sps.Parent = starterPlayer
local scs = newInstance("StarterCharacterScripts", true)
S[scs].props.Name = "StarterCharacterScripts"
scs.Parent = starterPlayer

local terrain = newInstance("Terrain", true)
S[terrain].props.Name = "Terrain"
terrain.Parent = ws
S[ws].props.Terrain = terrain
local camera = newInstance("Camera")
camera.Name = "Camera"
camera.Parent = ws
S[ws].props.CurrentCamera = camera

M.serverTimeOffset = 1000
function Methods.GetServerTimeNow()
	return M.serverTimeOffset + M.now
end
function Methods.Raycast(_, origin, direction, params)
	assert(typeOf(origin) == "Vector3" and typeOf(direction) == "Vector3", "Raycast expects Vector3 origin and direction")
	if params ~= nil then
		assert(typeOf(params) == "RaycastParams", "Raycast params must be RaycastParams")
	end
	return nil
end
function Methods.GetPartBoundsInBox()
	return {}
end
function Methods.GetPartBoundsInRadius()
	return {}
end
function Methods.GetPartsInPart()
	return {}
end

-- Terrain: record operations for previews
M.terrainOps = {}
local function terrainOp(kind, ...)
	table.insert(M.terrainOps, { kind, ... })
end
local function checkMaterial(m)
	assert(typeOf(m) == "EnumItem" and m.EnumType == Enum.Material, "Terrain fill expects an Enum.Material")
end
function Methods.FillBlock(inst, cf, size, material)
	assert(S[inst].class == "Terrain", "FillBlock is a Terrain method")
	assert(typeOf(cf) == "CFrame" and typeOf(size) == "Vector3", "FillBlock(CFrame, Vector3, Material)")
	checkMaterial(material)
	terrainOp("block", cf, size, material.Name)
end
function Methods.FillBall(inst, center, radius, material)
	assert(S[inst].class == "Terrain", "FillBall is a Terrain method")
	assert(typeOf(center) == "Vector3" and type(radius) == "number", "FillBall(Vector3, number, Material)")
	checkMaterial(material)
	terrainOp("ball", center, radius, material.Name)
end
function Methods.FillCylinder(inst, cf, height, radius, material)
	assert(S[inst].class == "Terrain", "FillCylinder is a Terrain method")
	assert(typeOf(cf) == "CFrame" and type(height) == "number" and type(radius) == "number", "FillCylinder(CFrame, number, number, Material)")
	checkMaterial(material)
	terrainOp("cylinder", cf, height, radius, material.Name)
end
function Methods.FillWedge(inst, cf, size, material)
	assert(typeOf(cf) == "CFrame" and typeOf(size) == "Vector3", "FillWedge(CFrame, Vector3, Material)")
	checkMaterial(material)
	terrainOp("wedge", cf, size, material.Name)
end
function Methods.SetMaterialColor(_, material, color)
	checkMaterial(material)
	assert(typeOf(color) == "Color3", "SetMaterialColor expects a Color3")
end

-- Camera
function Methods.WorldToViewportPoint(_, p)
	return Vector3.new(640, 360, 10), true
end
Methods.WorldToScreenPoint = Methods.WorldToViewportPoint
function Methods.ViewportPointToRay()
	return Ray.new(Vector3.zero, Vector3.new(0, 0, -1))
end
Methods.ScreenPointToRay = Methods.ViewportPointToRay

-- Lighting
function Methods.GetMinutesAfterMidnight(inst)
	return (S[inst].props.ClockTime or 14) * 60
end
function Methods.SetMinutesAfterMidnight(inst, m)
	S[inst].props.ClockTime = (m / 60) % 24
end

---------------------------------------------------------------------------
-- RunService
---------------------------------------------------------------------------
local runService = getService("RunService")
M.renderBindings = {}
function Methods.IsServer()
	return true
end
function Methods.IsClient()
	return true
end
function Methods.IsStudio()
	return true
end
function Methods.IsRunning()
	return true
end
function Methods.IsRunMode()
	return true
end
function Methods.BindToRenderStep(_, name, priority, fn)
	assert(type(name) == "string" and type(priority) == "number" and type(fn) == "function", "BindToRenderStep(name, priority, fn)")
	M.renderBindings[name] = { priority = priority, fn = fn }
end
function Methods.UnbindFromRenderStep(_, name)
	M.renderBindings[name] = nil
end

function M.frame(dt: number)
	for _, b in M.renderBindings do
		local co = coroutine.create(b.fn)
		M.resume(co, dt)
	end
	getSignal(runService, "RenderStepped"):Fire(dt)
	getSignal(runService, "PreRender"):Fire(dt)
	getSignal(runService, "Stepped"):Fire(M.now, dt)
	getSignal(runService, "PreSimulation"):Fire(dt)
	getSignal(runService, "Heartbeat"):Fire(dt)
	getSignal(runService, "PostSimulation"):Fire(dt)
end

---------------------------------------------------------------------------
-- TweenService
---------------------------------------------------------------------------
local tweenService = getService("TweenService")
local tweenGoals = setmetatable({}, { __mode = "k" })
function Methods.Create(svc, inst, info, goals)
	if svc ~= tweenService then
		error("Create is only mocked on TweenService", 2)
	end
	assert(M.isInstance(inst), "TweenService:Create expects an Instance")
	assert(typeOf(info) == "TweenInfo", "TweenService:Create expects TweenInfo")
	assert(type(goals) == "table", "TweenService:Create expects a goals table")
	local cls = S[inst].class
	for k, v in goals do
		local member = M.memberInfo(cls, k)
		if not member or member.MemberType ~= "Property" then
			error("TweenService:Create property named '" .. tostring(k) .. "' cannot be tweened due to type mismatch (property is a unknown type)", 2)
		end
		local current = inst[k]
		if typeOf(current) ~= typeOf(v) and not (member.Category == "Enum") then
			error("TweenService:Create property named '" .. k .. "' cannot be tweened due to type mismatch (property is a '" .. typeOf(current) .. "', but given type is '" .. typeOf(v) .. "')", 2)
		end
		local tweenable = { number = true, Vector3 = true, CFrame = true, Color3 = true, UDim2 = true, UDim = true, Vector2 = true, boolean = true, NumberRange = true, Rect = true }
		if not tweenable[typeOf(v)] then
			error("TweenService:Create property named '" .. k .. "' is not tweenable", 2)
		end
	end
	local tween = newInstance("Tween", true)
	tweenGoals[tween] = { inst = inst, info = info, goals = goals }
	S[tween].props.Instance = inst
	S[tween].props.TweenInfo = info
	return tween
end
function M.playTween(tween)
	local data = tweenGoals[tween]
	local total = data.info.Time + data.info.DelayTime
	if data.info.RepeatCount < 0 then
		-- infinite: apply goals once and never complete
		for k, v in data.goals do
			if not S[data.inst].destroyed then
				data.inst[k] = v
			end
		end
		return
	end
	task.delay(total, function()
		if S[tween].tweenCancelled then
			return
		end
		if not S[data.inst].destroyed then
			for k, v in data.goals do
				data.inst[k] = v
			end
		end
		getSignal(tween, "Completed"):Fire(Enum.PlaybackState.Completed)
	end)
end
function Methods.GetValue(_, alpha)
	return alpha
end

---------------------------------------------------------------------------
-- HttpService (JSON)
---------------------------------------------------------------------------
local function encode(v, out, depth)
	if depth > 50 then
		error("JSONEncode: too deep", 4)
	end
	local t = typeOf(v)
	if t == "nil" then
		table.insert(out, "null")
	elseif t == "boolean" then
		table.insert(out, tostring(v))
	elseif t == "number" then
		if v ~= v or v == math.huge or v == -math.huge then
			table.insert(out, "null")
		elseif v == math.floor(v) and math.abs(v) < 1e15 then
			table.insert(out, string.format("%d", v))
		else
			table.insert(out, string.format("%.14g", v))
		end
	elseif t == "string" then
		table.insert(out, '"' .. v:gsub('[%c"\\]', function(c)
			local map = { ['"'] = '\\"', ["\\"] = "\\\\", ["\n"] = "\\n", ["\r"] = "\\r", ["\t"] = "\\t" }
			return map[c] or string.format("\\u%04x", c:byte())
		end) .. '"')
	elseif t == "table" then
		local n = #v
		local count = 0
		for _ in v do
			count += 1
		end
		if count == 0 then
			table.insert(out, "[]")
		elseif n == count then
			table.insert(out, "[")
			for i = 1, n do
				if i > 1 then
					table.insert(out, ",")
				end
				encode(v[i], out, depth + 1)
			end
			table.insert(out, "]")
		else
			table.insert(out, "{")
			local first = true
			for k, val in v do
				if type(k) ~= "string" then
					error("JSONEncode: mixed or non-string table keys cannot be encoded", 4)
				end
				if not first then
					table.insert(out, ",")
				end
				first = false
				encode(k, out, depth + 1)
				table.insert(out, ":")
				encode(val, out, depth + 1)
			end
			table.insert(out, "}")
		end
	else
		error("JSONEncode: cannot encode " .. t, 4)
	end
end

local function decode(str)
	local pos = 1
	local function ws()
		pos = str:find("[^ \t\r\n]", pos) or #str + 1
	end
	local value
	local function parseString()
		local out = {}
		pos += 1
		while true do
			local c = str:sub(pos, pos)
			if c == "" then
				error("JSONDecode: unterminated string")
			elseif c == '"' then
				pos += 1
				break
			elseif c == "\\" then
				local e = str:sub(pos + 1, pos + 1)
				local map = { n = "\n", r = "\r", t = "\t", b = "\b", f = "\f", ['"'] = '"', ["\\"] = "\\", ["/"] = "/" }
				if e == "u" then
					table.insert(out, utf8.char(tonumber(str:sub(pos + 2, pos + 5), 16)))
					pos += 6
				else
					table.insert(out, map[e] or e)
					pos += 2
				end
			else
				table.insert(out, c)
				pos += 1
			end
		end
		return table.concat(out)
	end
	value = function()
		ws()
		local c = str:sub(pos, pos)
		if c == "{" then
			pos += 1
			local obj = {}
			ws()
			if str:sub(pos, pos) == "}" then
				pos += 1
				return obj
			end
			while true do
				ws()
				local k = parseString()
				ws()
				assert(str:sub(pos, pos) == ":", "JSONDecode: expected ':'")
				pos += 1
				obj[k] = value()
				ws()
				local d = str:sub(pos, pos)
				pos += 1
				if d == "}" then
					return obj
				end
				assert(d == ",", "JSONDecode: expected ','")
			end
		elseif c == "[" then
			pos += 1
			local arr = {}
			ws()
			if str:sub(pos, pos) == "]" then
				pos += 1
				return arr
			end
			while true do
				table.insert(arr, value())
				ws()
				local d = str:sub(pos, pos)
				pos += 1
				if d == "]" then
					return arr
				end
				assert(d == ",", "JSONDecode: expected ','")
			end
		elseif c == '"' then
			return parseString()
		elseif str:sub(pos, pos + 3) == "true" then
			pos += 4
			return true
		elseif str:sub(pos, pos + 4) == "false" then
			pos += 5
			return false
		elseif str:sub(pos, pos + 3) == "null" then
			pos += 4
			return nil
		end
		local num = str:match("^-?%d+%.?%d*[eE]?[-+]?%d*", pos)
		if not num then
			error("JSONDecode: unexpected character at " .. pos)
		end
		pos += #num
		return tonumber(num)
	end
	return value()
end

function Methods.JSONEncode(_, v)
	local out = {}
	encode(v, out, 0)
	return table.concat(out)
end
function Methods.JSONDecode(_, s)
	assert(type(s) == "string", "JSONDecode expects a string")
	return decode(s)
end
local guid = 0
function Methods.GenerateGUID(_, braces)
	guid += 1
	local g = string.format("00000000-0000-4000-8000-%012d", guid)
	if braces == false then
		return g
	end
	return "{" .. g .. "}"
end

---------------------------------------------------------------------------
-- DataStoreService (in-memory)
---------------------------------------------------------------------------
M.dataStores = {}
function Methods.GetDataStore(_, name)
	assert(type(name) == "string", "GetDataStore expects a name")
	local store = M.dataStores[name]
	if store then
		return store
	end
	local data = {}
	store = {}
	local function checkKey(key)
		assert(type(key) == "string" and #key <= 50, "DataStore key must be a string of at most 50 characters")
	end
	local function checkValue(v)
		local ok, err = pcall(Methods.JSONEncode, nil, v)
		if not ok then
			error("DataStore value cannot be stored: " .. tostring(err), 3)
		end
	end
	function store.GetAsync(self, key)
		checkKey(key)
		task.wait(0.05)
		local v = data[key]
		return if v ~= nil then decode(v) else nil
	end
	function store.SetAsync(self, key, value)
		checkKey(key)
		checkValue(value)
		task.wait(0.05)
		data[key] = Methods.JSONEncode(nil, value)
	end
	function store.UpdateAsync(self, key, fn)
		checkKey(key)
		task.wait(0.05)
		local old = data[key]
		local new = fn(if old ~= nil then decode(old) else nil)
		if new ~= nil then
			checkValue(new)
			data[key] = Methods.JSONEncode(nil, new)
		end
		return new
	end
	function store.RemoveAsync(self, key)
		data[key] = nil
	end
	store._data = data
	M.dataStores[name] = store
	return store
end

---------------------------------------------------------------------------
-- Misc services
---------------------------------------------------------------------------
function Methods.GetTagged(_, tag)
	local out = {}
	for inst, s in S do
		if s.tags[tag] and not s.destroyed then
			table.insert(out, inst)
		end
	end
	return out
end
function Methods.GetInstanceAddedSignal(_, tag)
	return Signal.new("InstanceAdded:" .. tag)
end
function Methods.GetInstanceRemovedSignal(_, tag)
	return Signal.new("InstanceRemoved:" .. tag)
end

function Methods.GetGuiInset()
	return Vector2.new(0, 58), Vector2.new(0, 0)
end
function Methods.GetTextSize(_, text, size, font, frame)
	assert(type(text) == "string" and type(size) == "number", "GetTextSize(text, size, font, frameSize)")
	assert(typeOf(font) == "EnumItem" and font.EnumType == Enum.Font, "GetTextSize expects an Enum.Font")
	assert(typeOf(frame) == "Vector2", "GetTextSize expects a Vector2 frame size")
	return Vector2.new(math.min(#text * size * 0.5, frame.X), size)
end
function Methods.SetCore(_, name)
	if name == "ResetButtonCallback" then
		return
	end
end
function Methods.GetCore()
	return nil
end
function Methods.SetCoreGuiEnabled(_, t, enabled)
	assert(typeOf(t) == "EnumItem" and t.EnumType == Enum.CoreGuiType, "SetCoreGuiEnabled expects a CoreGuiType")
	assert(type(enabled) == "boolean", "SetCoreGuiEnabled expects a boolean")
end
function Methods.BindAction(_, name, fn, touch, ...)
	assert(type(name) == "string" and type(fn) == "function", "BindAction(name, fn, createTouchButton, ...inputs)")
end
function Methods.BindActionAtPriority(_, name, fn)
	assert(type(name) == "string" and type(fn) == "function", "BindActionAtPriority(name, fn, ...)")
end
function Methods.UnbindAction() end
function Methods.GetLastInputType()
	return Enum.UserInputType.MouseButton1
end
function Methods.GetMouseLocation()
	return Vector2.new(640, 360)
end
function Methods.IsKeyDown()
	return false
end
function Methods.PlayLocalSound() end
function Methods.RegisterCollisionGroup(_, name)
	assert(type(name) == "string", "RegisterCollisionGroup expects a string")
end
function Methods.CollisionGroupSetCollidable(_, a, b, v)
	assert(type(a) == "string" and type(b) == "string" and type(v) == "boolean", "CollisionGroupSetCollidable(string, string, bool)")
end
function Methods.IsCollisionGroupRegistered()
	return true
end
function Methods.GetPlayers()
	local out = {}
	for _, c in S[getService("Players")].children do
		if S[c].class == "Player" then
			table.insert(out, c)
		end
	end
	return out
end
function Methods.GetPlayerByUserId(_, id)
	for _, p in Methods.GetPlayers() do
		if p.UserId == id then
			return p
		end
	end
	return nil
end
function Methods.GetPlayerFromCharacter(_, char)
	for _, p in Methods.GetPlayers() do
		if p.Character == char then
			return p
		end
	end
	return nil
end
function Methods.Kick(p, msg)
	report("warn", "player kicked: " .. tostring(msg))
end
function Methods.GetUserThumbnailAsync()
	return "rbxasset://textures/ui/GuiImagePlaceholder.png", true
end
function Methods.IsInGroup()
	return false
end
function Methods.GetRankInGroup()
	return 0
end
function Methods.UserOwnsGamePassAsync()
	return false
end
function Methods.PromptGamePassPurchase() end
function Methods.PromptProductPurchase() end
function Methods.AwardBadge()
	return true
end
function Methods.UserHasBadgeAsync()
	return false
end

---------------------------------------------------------------------------
-- Players and characters
---------------------------------------------------------------------------
local function makeCharacter(player)
	local char = newInstance("Model")
	char.Name = player.Name
	local function part(name, size, cf)
		local p = newInstance("Part")
		p.Name = name
		p.Size = size
		p.CFrame = cf
		p.Parent = char
		return p
	end
	local root = part("HumanoidRootPart", Vector3.new(2, 2, 1), CFrame.new(0, 5, 330))
	root.Transparency = 1
	part("Head", Vector3.new(2, 1, 1), CFrame.new(0, 6.5, 330))
	part("UpperTorso", Vector3.new(2, 1.6, 1), CFrame.new(0, 5.2, 330))
	part("LowerTorso", Vector3.new(2, 0.4, 1), CFrame.new(0, 4.2, 330))
	part("RightHand", Vector3.new(0.6, 0.6, 0.6), CFrame.new(1.5, 3.8, 330))
	part("LeftHand", Vector3.new(0.6, 0.6, 0.6), CFrame.new(-1.5, 3.8, 330))
	local rha = newInstance("Attachment")
	rha.Name = "RightGripAttachment"
	rha.Parent = char.RightHand
	local hat = newInstance("Attachment")
	hat.Name = "HatAttachment"
	hat.Parent = char.Head
	char.PrimaryPart = root
	local hum = newInstance("Humanoid")
	hum.Parent = char
	local animator = newInstance("Animator")
	animator.Parent = hum
	return char
end

function Methods.LoadCharacter(player)
	assert(Methods.IsA(player, "Player"), "LoadCharacter is a Player method")
	local old = S[player].props.Character
	if old then
		M.destroy(old)
	end
	local char = makeCharacter(player)
	S[player].props.Character = char
	char.Parent = ws
	getSignal(player, "CharacterAdded"):Fire(char)
	return char
end

Methods.LoadCharacterAsync = function(player)
	return Methods.LoadCharacter(player)
end
function Methods.BindToClose(_, fn)
	assert(type(fn) == "function", "BindToClose expects a function")
end

function M.addPlayer(name: string, userId: number)
	local players = getService("Players")
	local p = newInstance("Player", true)
	S[p].props.Name = name
	S[p].props.UserId = userId
	S[p].props.DisplayName = name
	for _, cls in { "Backpack", "PlayerGui", "PlayerScripts" } do
		local c = newInstance(cls, true)
		S[c].props.Name = cls
		c.Parent = p
	end
	p.Parent = players
	S[players].props.LocalPlayer = p
	M.localPlayer = p
	getSignal(players, "PlayerAdded"):Fire(p)
	return p
end

function M.removePlayer(p)
	local players = getService("Players")
	getSignal(players, "PlayerRemoving"):Fire(p)
	task.wait(0.1)
	M.destroy(p)
end

function Methods.GetMouse()
	return { Hit = CFrame.new(), Target = nil, Icon = "" }
end

---------------------------------------------------------------------------
-- require / scripts
---------------------------------------------------------------------------
local loaded = {}
local loading = {}
_G.require = function(module)
	if not M.isInstance(module) then
		error("Attempted to call require with invalid argument(s).", 2)
	end
	if S[module].class ~= "ModuleScript" then
		error("Attempted to call require with a non-ModuleScript", 2)
	end
	if loaded[module] then
		return loaded[module].value
	end
	if loading[module] then
		error("Requested module was required recursively: " .. M.fullName(module), 2)
	end
	loading[module] = true
	local source = S[module].props.Source or ""
	local fn = __load("local script = ...; " .. source, "=" .. M.fullName(module))
	local results = table.pack(fn(module))
	loading[module] = nil
	if results.n ~= 1 then
		error("Module code did not return exactly one value: " .. M.fullName(module), 2)
	end
	loaded[module] = { value = results[1] }
	return results[1]
end

function M.runScript(scriptInst)
	local source = S[scriptInst].props.Source or ""
	local fn = __load("local script = ...; " .. source, "=" .. M.fullName(scriptInst))
	return M.spawn(fn, scriptInst)
end

function M.makeScript(className: string, name: string, source: string?, parent)
	local inst = newInstance(className, true)
	S[inst].props.Name = name
	if source then
		S[inst].props.Source = source
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

function M.makeFolder(name: string, parent)
	local f = newInstance("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

return M
