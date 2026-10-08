-- Instance emulation for the headless test harness. Every class name,
-- property, method, event and enum access is validated against the real
-- Roblox API dump (provided by the host through __api_* functions), and
-- property assignments are type-checked.

local M = _G.__mock
local Signal = M.Signal
local typeOf = M.typeof
local report = M.report

---------------------------------------------------------------------------
-- Enums
---------------------------------------------------------------------------
local enumData = __api_enums()
local EnumItemMT = { __type = "EnumItem" }
EnumItemMT.__index = function(item, k)
	if k == "IsA" then
		return function(self, name)
			return self.EnumType.__name == name
		end
	end
	error(tostring(k) .. " is not a valid member of EnumItem", 2)
end
EnumItemMT.__tostring = function(item)
	return "Enum." .. rawget(item, "EnumType").__name .. "." .. rawget(item, "Name")
end
local EnumMT = { __type = "Enum" }
EnumMT.__index = function(e, k)
	if k == "GetEnumItems" then
		return function(self)
			local out = {}
			for _, v in rawget(self, "__items") do
				table.insert(out, v)
			end
			table.sort(out, function(a, b)
				return a.Value < b.Value
			end)
			return out
		end
	elseif k == "FromName" then
		return function(self, name)
			return rawget(self, "__items")[name]
		end
	elseif k == "FromValue" then
		return function(self, value)
			for _, v in rawget(self, "__items") do
				if v.Value == value then
					return v
				end
			end
			return nil
		end
	end
	local item = rawget(e, "__items")[k]
	if item == nil then
		error(tostring(k) .. " is not a valid member of \"Enum." .. rawget(e, "__name") .. "\"", 2)
	end
	return item
end
EnumMT.__newindex = function()
	error("Enums are read-only", 2)
end
EnumMT.__tostring = function(e)
	return rawget(e, "__name")
end

local Enums = {}
for name, items in enumData do
	local e = setmetatable({ __name = name, __items = {} }, EnumMT)
	for itemName, value in items do
		rawget(e, "__items")[itemName] = setmetatable({ Name = itemName, Value = value, EnumType = e }, EnumItemMT)
	end
	Enums[name] = e
end
_G.Enum = setmetatable({}, {
	__type = "Enums",
	__index = function(_, k)
		if k == "GetEnums" then
			return function()
				local out = {}
				for _, e in Enums do
					table.insert(out, e)
				end
				return out
			end
		end
		local e = Enums[k]
		if not e then
			error(tostring(k) .. " is not a valid member of \"Enum\"", 2)
		end
		return e
	end,
	__newindex = function()
		error("Enum is read-only", 2)
	end,
})

---------------------------------------------------------------------------
-- API lookups (cached)
---------------------------------------------------------------------------
local classCache = {}
local function classInfo(name: string)
	local c = classCache[name]
	if c == nil then
		c = __api_class(name) or false
		classCache[name] = c
	end
	return c or nil
end
M.classInfo = classInfo

local memberCache = {}
local function memberInfo(className: string, member: string)
	local key = className .. "." .. member
	local m = memberCache[key]
	if m == nil then
		m = __api_member(className, member) or false
		memberCache[key] = m
	end
	return m or nil
end
M.memberInfo = memberInfo

local function classIsA(className: string, target: string): boolean
	local c = className
	while c do
		if c == target then
			return true
		end
		local info = classInfo(c)
		c = info and info.Superclass
		if c == "<<<ROOT>>>" then
			return false
		end
	end
	return false
end
M.classIsA = classIsA

---------------------------------------------------------------------------
-- Instances
---------------------------------------------------------------------------
local S = setmetatable({}, { __mode = "k" }) -- instance -> state
M.state = S
local InstanceMT = { __type = "Instance" }
local Methods = {}
M.Methods = Methods
local nextId = 0
M.instanceCount = 0

local function isInstance(v): boolean
	return getmetatable(v) == InstanceMT
end
M.isInstance = isInstance

local function st(inst)
	local s = S[inst]
	if not s then
		error("not an Instance", 3)
	end
	return s
end

local function fullName(inst): string
	local parts = {}
	local cur = inst
	while cur do
		local s = S[cur]
		if s.class == "DataModel" then
			break
		end
		table.insert(parts, 1, s.props.Name)
		cur = s.parent
	end
	return table.concat(parts, ".")
end
M.fullName = fullName

local function getSignal(inst, name)
	local s = st(inst)
	local sig = s.signals[name]
	if not sig then
		sig = Signal.new(name)
		s.signals[name] = sig
	end
	return sig
end
M.getSignal = getSignal

-- Default property values for things code may read before setting.
local Defaults = {
	BasePart = {
		Size = Vector3.new(4, 1, 2),
		CFrame = CFrame.new(),
		Color = Color3.fromRGB(163, 162, 165),
		Transparency = 0,
		Anchored = false,
		CanCollide = true,
		CanTouch = true,
		CanQuery = true,
		CastShadow = true,
		Locked = false,
		Massless = false,
		Reflectance = 0,
		Material = "Plastic",
	},
	Part = { Shape = "Block" },
	Instance = { Archivable = true },
	GuiObject = { Visible = true, BackgroundTransparency = 0, Size = UDim2.new(), Position = UDim2.new(), ZIndex = 1, BackgroundColor3 = Color3.new(1, 1, 1), Active = false },
	GuiBase2d = {},
	LayerCollector = { Enabled = true, ResetOnSpawn = true },
	SurfaceGuiBase = { Face = "Front" },
	TextLabel = { TextSize = 14, Text = "Label", TextColor3 = Color3.new(0, 0, 0), TextTransparency = 0, TextXAlignment = "Center", TextYAlignment = "Center" },
	TextButton = { TextSize = 14, Text = "Button", TextColor3 = Color3.new(0, 0, 0), TextTransparency = 0, AutoButtonColor = true, TextXAlignment = "Center", TextYAlignment = "Center" },
	TextBox = { TextSize = 14, Text = "", TextColor3 = Color3.new(0, 0, 0) },
	ImageLabel = { ImageTransparency = 0 },
	Humanoid = {
		WalkSpeed = 16,
		JumpPower = 50,
		JumpHeight = 7.2,
		Health = 100,
		MaxHealth = 100,
		HipHeight = 2,
		AutoRotate = true,
		UseJumpPower = false,
		Sit = false,
		DisplayDistanceType = "Viewer",
		MoveDirection = Vector3.zero,
	},
	Light = { Enabled = true, Brightness = 1, Color = Color3.new(1, 1, 1) },
	PointLight = { Range = 8 },
	SpotLight = { Range = 16, Angle = 90 },
	SurfaceLight = { Range = 16, Angle = 90 },
	ParticleEmitter = { Enabled = true, Rate = 5 },
	Beam = { Enabled = true },
	Trail = { Enabled = true },
	Fire = { Enabled = true },
	Smoke = { Enabled = true },
	Sparkles = { Enabled = true },
	ProximityPrompt = { Enabled = true, MaxActivationDistance = 10, RequiresLineOfSight = true, HoldDuration = 0, ActionText = "Interact", KeyboardKeyCode = "E" },
	Sound = { Volume = 0.5, PlaybackSpeed = 1 },
	Camera = { FieldOfView = 70, CFrame = CFrame.new(0, 20, 20), ViewportSize = Vector2.new(1280, 720) },
	Lighting = { ClockTime = 14, Brightness = 2 },
	Workspace = { Gravity = 196.2 },
	Player = { UserId = 1, DisplayName = "Player" },
	Model = { WorldPivot = CFrame.new() },
}

local function enumDefault(enumName: string)
	local e = Enums[enumName]
	if not e then
		return nil
	end
	local best
	for _, item in rawget(e, "__items") do
		if best == nil or item.Value < best.Value then
			best = item
		end
	end
	return best
end

local function typeDefault(member)
	local vt = member.ValueType
	local cat = member.Category
	if cat == "Enum" then
		return enumDefault(vt)
	elseif cat == "Class" then
		return nil
	end
	if vt == "bool" then
		return false
	elseif vt == "int" or vt == "int64" or vt == "float" or vt == "double" then
		return 0
	elseif vt == "string" or vt == "Content" or vt == "ContentId" then
		return ""
	elseif vt == "Vector3" then
		return Vector3.zero
	elseif vt == "Vector2" then
		return Vector2.zero
	elseif vt == "CFrame" then
		return CFrame.new()
	elseif vt == "Color3" then
		return Color3.new(1, 1, 1)
	elseif vt == "UDim2" then
		return UDim2.new()
	elseif vt == "UDim" then
		return UDim.new()
	elseif vt == "NumberRange" then
		return NumberRange.new(0, 0)
	elseif vt == "NumberSequence" then
		return NumberSequence.new(0)
	elseif vt == "ColorSequence" then
		return ColorSequence.new(Color3.new(1, 1, 1))
	elseif vt == "Font" then
		return Font.new("rbxasset://fonts/families/SourceSansPro.json")
	end
	return nil
end

local function defaultFor(className: string, prop: string, member)
	local c = className
	while c and c ~= "<<<ROOT>>>" do
		local d = Defaults[c]
		if d and d[prop] ~= nil then
			local v = d[prop]
			if member.Category == "Enum" and type(v) == "string" then
				return Enum[member.ValueType][v]
			end
			return v
		end
		local info = classInfo(c)
		c = info and info.Superclass
	end
	return typeDefault(member)
end

-- Type check a value against a property's declared type.
local numberTypes = { int = true, int64 = true, float = true, double = true }
local function checkValue(className: string, prop: string, member, value)
	local vt = member.ValueType
	local cat = member.Category
	local t = typeOf(value)
	local function fail()
		error(string.format("Unable to assign property %s. %s expected, got %s", prop, vt, t), 4)
	end
	if cat == "Class" then
		if value == nil then
			return value
		end
		if t ~= "Instance" or not classIsA(S[value].class, vt) then
			fail()
		end
		return value
	elseif cat == "Enum" then
		if t == "EnumItem" then
			if rawget(value.EnumType, "__name") ~= vt then
				fail()
			end
			return value
		elseif t == "number" then
			local e = Enums[vt]
			for _, item in rawget(e, "__items") do
				if item.Value == value then
					return item
				end
			end
			fail()
		elseif t == "string" then
			local item = rawget(Enums[vt], "__items")[value]
			if not item then
				fail()
			end
			return item
		end
		fail()
	end
	if vt == "bool" then
		if t ~= "boolean" then
			fail()
		end
	elseif numberTypes[vt] then
		if t ~= "number" then
			fail()
		end
		if value ~= value then
			error("Unable to assign property " .. prop .. " (NaN)", 4)
		end
	elseif vt == "string" then
		if t ~= "string" then
			fail()
		end
	elseif vt == "Content" or vt == "ContentId" then
		if t ~= "string" and t ~= "Content" then
			fail()
		end
	elseif vt == "PhysicalProperties" then
		if value ~= nil and t ~= "PhysicalProperties" then
			fail()
		end
	elseif vt == "Vector3" or vt == "Vector2" or vt == "CFrame" or vt == "Color3" or vt == "UDim2" or vt == "UDim" or vt == "NumberRange" or vt == "NumberSequence" or vt == "ColorSequence" or vt == "Rect" or vt == "Font" or vt == "BrickColor" or vt == "Ray" then
		if t ~= vt then
			fail()
		end
		if vt == "Vector3" and (value.X ~= value.X or value.Y ~= value.Y or value.Z ~= value.Z) then
			error("Unable to assign property " .. prop .. " (NaN Vector3)", 4)
		end
		if vt == "CFrame" and (value.X ~= value.X or value.Y ~= value.Y or value.Z ~= value.Z) then
			error("Unable to assign property " .. prop .. " (NaN CFrame)", 4)
		end
	end
	return value
end

local function newInstance(className: string, skipChecks: boolean?)
	local info = classInfo(className)
	if not info then
		error("Unable to create an Instance of type \"" .. tostring(className) .. "\"", 3)
	end
	if not skipChecks and not info.Creatable then
		error("Unable to create an Instance of type \"" .. className .. "\" (not creatable)", 3)
	end
	nextId += 1
	M.instanceCount += 1
	local inst = setmetatable({}, InstanceMT)
	S[inst] = {
		class = className,
		props = { Name = className },
		children = {},
		parent = nil,
		attrs = {},
		signals = {},
		tags = {},
		destroyed = false,
		id = nextId,
	}
	return inst
end
M.newInstance = newInstance

local function fireChanged(inst, prop)
	local s = S[inst]
	local sig = s.signals["Prop:" .. prop]
	if sig then
		sig:Fire()
	end
	local ch = s.signals.Changed
	if ch then
		ch:Fire(prop)
	end
end

local function descendants(inst, out)
	for _, c in S[inst].children do
		table.insert(out, c)
		descendants(c, out)
	end
	return out
end
M.descendants = function(inst)
	return descendants(inst, {})
end

local function isAncestor(a, b): boolean -- is a an ancestor of b
	local cur = S[b].parent
	while cur do
		if cur == a then
			return true
		end
		cur = S[cur].parent
	end
	return false
end

local function setParent(inst, newParent)
	local s = S[inst]
	if s.destroyed then
		error("The Parent property of " .. s.props.Name .. " is locked, current parent: NULL, new parent " .. (newParent and S[newParent].props.Name or "NULL"), 3)
	end
	if newParent ~= nil and not isInstance(newParent) then
		error("Unable to assign property Parent. Instance expected, got " .. typeOf(newParent), 3)
	end
	if newParent == inst or (newParent and isAncestor(inst, newParent)) then
		error("Attempt to set " .. fullName(inst) .. " as its own parent", 3)
	end
	local old = s.parent
	if old == newParent then
		return
	end
	if old then
		local list = S[old].children
		local i = table.find(list, inst)
		if i then
			table.remove(list, i)
		end
		local sig = S[old].signals.ChildRemoved
		if sig then
			sig:Fire(inst)
		end
		local a = old
		while a do
			local dr = S[a].signals.DescendantRemoving
			if dr then
				dr:Fire(inst)
			end
			a = S[a].parent
		end
	end
	s.parent = newParent
	if newParent then
		table.insert(S[newParent].children, inst)
		local sig = S[newParent].signals.ChildAdded
		if sig then
			sig:Fire(inst)
		end
		local a = newParent
		while a do
			local da = S[a].signals.DescendantAdded
			if da then
				da:Fire(inst)
				for _, d in descendants(inst, {}) do
					da:Fire(d)
				end
			end
			a = S[a].parent
		end
	end
	local ac = s.signals.AncestryChanged
	if ac then
		ac:Fire(inst, newParent)
	end
	fireChanged(inst, "Parent")
	if M.onParented then
		M.onParented(inst, newParent)
	end
end

local function getPivot(inst)
	local s = S[inst]
	if classIsA(s.class, "BasePart") then
		return s.props.CFrame or CFrame.new()
	end
	if s.class == "Model" or classIsA(s.class, "Model") then
		local pp = s.props.PrimaryPart
		if pp then
			return (S[pp].props.CFrame or CFrame.new()) * (s.pivotOffset or CFrame.new())
		end
		if s.props.WorldPivot and s.pivotSet then
			return s.props.WorldPivot
		end
		-- bounding box center of parts
		local minV, maxV
		for _, d in descendants(inst, {}) do
			local ds = S[d]
			if classIsA(ds.class, "BasePart") then
				local p = (ds.props.CFrame or CFrame.new()).Position
				minV = if minV then minV:Min(p) else p
				maxV = if maxV then maxV:Max(p) else p
			end
		end
		if minV then
			return CFrame.new((minV + maxV) / 2)
		end
		return CFrame.new()
	end
	error("GetPivot is not a valid member of " .. s.class, 3)
end
M.getPivot = getPivot

local function pivotTo(inst, cf)
	if typeOf(cf) ~= "CFrame" then
		error("PivotTo expects a CFrame, got " .. typeOf(cf), 3)
	end
	local s = S[inst]
	if classIsA(s.class, "BasePart") then
		local old = s.props.CFrame or CFrame.new()
		local delta = cf * old:Inverse()
		s.props.CFrame = cf
		-- welded/descendant parts are not moved by BasePart:PivotTo in Roblox
		-- unless welded; we do not simulate welds here.
		local _ = delta
		fireChanged(inst, "CFrame")
		return
	end
	local current = getPivot(inst)
	local delta = cf * current:Inverse()
	for _, d in descendants(inst, {}) do
		local ds = S[d]
		if classIsA(ds.class, "BasePart") then
			-- Roblox keeps part rotations orthonormal; so do we
			ds.props.CFrame = (delta * (ds.props.CFrame or CFrame.new())):Orthonormalize()
		end
	end
	if s.props.WorldPivot and s.pivotSet then
		s.props.WorldPivot = cf
	end
end

InstanceMT.__index = function(inst, key)
	local s = S[inst]
	if key == "ClassName" then
		return s.class
	elseif key == "Parent" then
		return s.parent
	end
	local v = s.props[key]
	if v ~= nil then
		return v
	end
	if type(key) ~= "string" then
		error("invalid key type " .. typeOf(key), 2)
	end
	local member = memberInfo(s.class, key)
	if member then
		local mt = member.MemberType
		if mt == "Property" then
			if member.Deprecated and not M.allowDeprecated then
				report("warn", "deprecated property read: " .. s.class .. "." .. key)
			end
			if s.class == "Model" and key == "WorldPivot" then
				return getPivot(inst)
			end
			if key == "Position" and classIsA(s.class, "BasePart") then
				return (s.props.CFrame or CFrame.new()).Position
			end
			if key == "Orientation" and classIsA(s.class, "BasePart") then
				local x, y, z = (s.props.CFrame or CFrame.new()):ToOrientation()
				return Vector3.new(math.deg(x), math.deg(y), math.deg(z))
			end
			if key == "AbsoluteSize" or key == "AbsolutePosition" or key == "AbsoluteContentSize" or key == "TextBounds" then
				return Vector2.new(200, 40)
			end
			local d = defaultFor(s.class, key, member)
			return d
		elseif mt == "Function" then
			if member.Deprecated then
				report("warn", "deprecated method: " .. s.class .. ":" .. key)
			end
			local f = Methods[key]
			if f then
				return f
			end
			return function()
				report("warn", "unmocked method " .. s.class .. ":" .. key)
				return nil
			end
		elseif mt == "Event" then
			return getSignal(inst, key)
		elseif mt == "Callback" then
			return nil
		end
	end
	for _, c in s.children do
		if S[c].props.Name == key then
			return c
		end
	end
	error(tostring(key) .. " is not a valid member of " .. s.class .. " \"" .. fullName(inst) .. "\"", 2)
end

InstanceMT.__newindex = function(inst, key, value)
	local s = S[inst]
	if key == "Parent" then
		setParent(inst, value)
		return
	end
	if type(key) ~= "string" then
		error("invalid key", 2)
	end
	if key == "Name" then
		if type(value) ~= "string" then
			error("Unable to assign property Name. string expected, got " .. typeOf(value), 2)
		end
		s.props.Name = value
		fireChanged(inst, "Name")
		return
	end
	local member = memberInfo(s.class, key)
	if not member then
		error(tostring(key) .. " is not a valid member of " .. s.class .. " \"" .. fullName(inst) .. "\"", 2)
	end
	if member.MemberType ~= "Property" then
		error("Unable to assign " .. key .. " (not a property)", 2)
	end
	if member.ReadOnly or member.CanWrite == false then
		error("Unable to assign property " .. key .. ". Property is read only", 2)
	end
	if member.Deprecated then
		report("warn", "deprecated property write: " .. s.class .. "." .. key)
	end
	value = checkValue(s.class, key, member, value)
	if key == "Position" and classIsA(s.class, "BasePart") then
		local cf = s.props.CFrame or CFrame.new()
		s.props.CFrame = cf.Rotation + value
		fireChanged(inst, "CFrame")
		fireChanged(inst, "Position")
		return
	elseif key == "Orientation" and classIsA(s.class, "BasePart") then
		local cf = s.props.CFrame or CFrame.new()
		s.props.CFrame = CFrame.new(cf.Position) * CFrame.fromOrientation(math.rad(value.X), math.rad(value.Y), math.rad(value.Z))
		fireChanged(inst, "CFrame")
		return
	elseif key == "PrimaryPart" and value ~= nil then
		if not isAncestor(inst, value) then
			error("PrimaryPart must be a descendant of the Model", 2)
		end
		s.props.PrimaryPart = value
		s.pivotOffset = CFrame.new()
		fireChanged(inst, key)
		return
	elseif key == "WorldPivot" then
		s.pivotSet = true
	end
	if key == "Size" and classIsA(s.class, "BasePart") then
		if value.X < 0 or value.Y < 0 or value.Z < 0 then
			error("negative part size", 2)
		end
		if value.X > 2048 or value.Y > 2048 or value.Z > 2048 then
			report("warn", "part larger than 2048 studs gets clamped: " .. fullName(inst))
		end
	end
	if key == "CFrame" and classIsA(s.class, "BasePart") then
		value = value:Orthonormalize()
	end
	s.props[key] = value
	fireChanged(inst, key)
end

InstanceMT.__tostring = function(inst)
	return S[inst].props.Name
end

local function checkSelf(inst, method)
	if not isInstance(inst) then
		error("Expected ':' not '.' calling member function " .. method, 3)
	end
	return S[inst]
end

---------------------------------------------------------------------------
-- Methods
---------------------------------------------------------------------------
function Methods.IsA(inst, className)
	local s = checkSelf(inst, "IsA")
	return classIsA(s.class, className)
end

function Methods.GetChildren(inst)
	return table.clone(checkSelf(inst, "GetChildren").children)
end

function Methods.GetDescendants(inst)
	checkSelf(inst, "GetDescendants")
	return descendants(inst, {})
end

function Methods.FindFirstChild(inst, name, recursive)
	local s = checkSelf(inst, "FindFirstChild")
	for _, c in s.children do
		if S[c].props.Name == name then
			return c
		end
	end
	if recursive then
		for _, c in s.children do
			local f = Methods.FindFirstChild(c, name, true)
			if f then
				return f
			end
		end
	end
	return nil
end

function Methods.FindFirstDescendant(inst, name)
	return Methods.FindFirstChild(inst, name, true)
end

function Methods.FindFirstChildOfClass(inst, className)
	local s = checkSelf(inst, "FindFirstChildOfClass")
	for _, c in s.children do
		if S[c].class == className then
			return c
		end
	end
	return nil
end

function Methods.FindFirstChildWhichIsA(inst, className, recursive)
	local s = checkSelf(inst, "FindFirstChildWhichIsA")
	for _, c in s.children do
		if classIsA(S[c].class, className) then
			return c
		end
	end
	if recursive then
		for _, c in s.children do
			local f = Methods.FindFirstChildWhichIsA(c, className, true)
			if f then
				return f
			end
		end
	end
	return nil
end

function Methods.FindFirstAncestor(inst, name)
	local cur = checkSelf(inst, "FindFirstAncestor").parent
	while cur do
		if S[cur].props.Name == name then
			return cur
		end
		cur = S[cur].parent
	end
	return nil
end

function Methods.FindFirstAncestorOfClass(inst, className)
	local cur = checkSelf(inst, "FindFirstAncestorOfClass").parent
	while cur do
		if S[cur].class == className then
			return cur
		end
		cur = S[cur].parent
	end
	return nil
end

function Methods.FindFirstAncestorWhichIsA(inst, className)
	local cur = checkSelf(inst, "FindFirstAncestorWhichIsA").parent
	while cur do
		if classIsA(S[cur].class, className) then
			return cur
		end
		cur = S[cur].parent
	end
	return nil
end

function Methods.WaitForChild(inst, name, timeout)
	checkSelf(inst, "WaitForChild")
	assert(type(name) == "string", "WaitForChild expects a string name")
	local found = Methods.FindFirstChild(inst, name)
	if found then
		return found
	end
	local waited = 0
	local warned = false
	while true do
		task.wait(0.05)
		waited += 0.05
		found = Methods.FindFirstChild(inst, name)
		if found then
			return found
		end
		if timeout and waited >= timeout then
			return nil
		end
		if not timeout and waited >= 5 and not warned then
			warned = true
			report("error", "Infinite yield possible on '" .. fullName(inst) .. ":WaitForChild(\"" .. name .. "\")'")
		end
	end
end

function Methods.IsDescendantOf(inst, other)
	checkSelf(inst, "IsDescendantOf")
	if other == nil then
		return false
	end
	return isAncestor(other, inst)
end

function Methods.IsAncestorOf(inst, other)
	checkSelf(inst, "IsAncestorOf")
	return isAncestor(inst, other)
end

function Methods.GetFullName(inst)
	checkSelf(inst, "GetFullName")
	return fullName(inst)
end

local function destroy(inst)
	local s = S[inst]
	if s.destroyed then
		return
	end
	for _, c in table.clone(s.children) do
		destroy(c)
	end
	if s.parent then
		setParent(inst, nil)
	end
	s.destroyed = true
	local d = s.signals.Destroying
	if d then
		d:Fire()
	end
	for _, sig in s.signals do
		sig:DisconnectAll()
	end
end
M.destroy = destroy

function Methods.Destroy(inst)
	checkSelf(inst, "Destroy")
	destroy(inst)
end

function Methods.ClearAllChildren(inst)
	local s = checkSelf(inst, "ClearAllChildren")
	for _, c in table.clone(s.children) do
		destroy(c)
	end
end

local function clone(inst)
	local s = S[inst]
	if s.props.Archivable == false then
		return nil
	end
	local c = newInstance(s.class, true)
	local cs = S[c]
	for k, v in s.props do
		cs.props[k] = v
	end
	cs.props.PrimaryPart = nil
	for k, v in s.attrs do
		cs.attrs[k] = v
	end
	for k in s.tags do
		cs.tags[k] = true
	end
	cs.pivotSet = s.pivotSet
	cs.pivotOffset = s.pivotOffset
	local map = { [inst] = c }
	for _, child in s.children do
		local cc = clone(child)
		if cc then
			map[child] = cc
			S[cc].parent = c
			table.insert(cs.children, cc)
		end
	end
	if s.props.PrimaryPart then
		-- remap primary part to the cloned descendant
		for _, d in descendants(inst, {}) do
			if d == s.props.PrimaryPart then
				local path = {}
				local cur = d
				while cur ~= inst do
					table.insert(path, 1, table.find(S[S[cur].parent].children, cur))
					cur = S[cur].parent
				end
				local target = c
				for _, idx in path do
					target = S[target].children[idx]
				end
				cs.props.PrimaryPart = target
			end
		end
	end
	return c
end

function Methods.Clone(inst)
	checkSelf(inst, "Clone")
	return clone(inst)
end

local validAttrTypes = {
	["nil"] = true,
	boolean = true,
	number = true,
	string = true,
	Vector3 = true,
	Vector2 = true,
	CFrame = true,
	Color3 = true,
	UDim = true,
	UDim2 = true,
	NumberRange = true,
	NumberSequence = true,
	ColorSequence = true,
	Rect = true,
	BrickColor = true,
	EnumItem = true,
	Font = true,
}

function Methods.SetAttribute(inst, name, value)
	local s = checkSelf(inst, "SetAttribute")
	if type(name) ~= "string" or #name == 0 or #name > 100 or not name:match("^[%w_]+$") or name:sub(1, 3) == "RBX" then
		error("SetAttribute: invalid attribute name '" .. tostring(name) .. "'", 2)
	end
	local t = typeOf(value)
	if not validAttrTypes[t] then
		error("SetAttribute: " .. t .. " is not a supported attribute type (" .. name .. ")", 2)
	end
	if t == "string" and #value > 200000 then
		report("warn", "very large string attribute " .. name)
	end
	local old = s.attrs[name]
	s.attrs[name] = value
	if old ~= value then
		local sig = s.signals["Attr:" .. name]
		if sig then
			sig:Fire()
		end
		local ac = s.signals.AttributeChanged
		if ac then
			ac:Fire(name)
		end
	end
end

function Methods.GetAttribute(inst, name)
	return checkSelf(inst, "GetAttribute").attrs[name]
end

function Methods.GetAttributes(inst)
	return table.clone(checkSelf(inst, "GetAttributes").attrs)
end

function Methods.GetAttributeChangedSignal(inst, name)
	checkSelf(inst, "GetAttributeChangedSignal")
	return getSignal(inst, "Attr:" .. name)
end

function Methods.GetPropertyChangedSignal(inst, prop)
	local s = checkSelf(inst, "GetPropertyChangedSignal")
	if prop ~= "Parent" and prop ~= "Name" and not memberInfo(s.class, prop) then
		error(tostring(prop) .. " is not a valid property name.", 2)
	end
	return getSignal(inst, "Prop:" .. prop)
end

function Methods.AddTag(inst, tag)
	checkSelf(inst, "AddTag").tags[tag] = true
end
function Methods.RemoveTag(inst, tag)
	checkSelf(inst, "RemoveTag").tags[tag] = nil
end
function Methods.HasTag(inst, tag)
	return checkSelf(inst, "HasTag").tags[tag] == true
end
function Methods.GetTags(inst)
	local out = {}
	for t in checkSelf(inst, "GetTags").tags do
		table.insert(out, t)
	end
	return out
end

function Methods.GetPivot(inst)
	checkSelf(inst, "GetPivot")
	return getPivot(inst)
end

function Methods.PivotTo(inst, cf)
	checkSelf(inst, "PivotTo")
	pivotTo(inst, cf)
end

function Methods.SetPrimaryPartCFrame(inst, cf)
	pivotTo(inst, cf)
end

function Methods.GetBoundingBox(inst)
	checkSelf(inst, "GetBoundingBox")
	local minV, maxV
	for _, d in descendants(inst, {}) do
		local ds = S[d]
		if classIsA(ds.class, "BasePart") then
			local cf = ds.props.CFrame or CFrame.new()
			local size = ds.props.Size or Vector3.new(4, 1, 2)
			local h = size / 2
			for _, sx in { -1, 1 } do
				for _, sy in { -1, 1 } do
					for _, sz in { -1, 1 } do
						local p = cf * Vector3.new(h.X * sx, h.Y * sy, h.Z * sz)
						minV = if minV then minV:Min(p) else p
						maxV = if maxV then maxV:Max(p) else p
					end
				end
			end
		end
	end
	if not minV then
		return CFrame.new(), Vector3.zero
	end
	return CFrame.new((minV + maxV) / 2), maxV - minV
end

function Methods.GetExtentsSize(inst)
	local _, size = Methods.GetBoundingBox(inst)
	return size
end

function Methods.MoveTo(inst, pos)
	local s = checkSelf(inst, "MoveTo")
	if s.class == "Humanoid" then
		local sig = s.signals.MoveToFinished
		task.delay(1, function()
			if sig then
				sig:Fire(true)
			end
		end)
		return
	end
	local cf = getPivot(inst)
	pivotTo(inst, cf.Rotation + pos)
end

function Methods.ScaleTo(inst, scale)
	checkSelf(inst, "ScaleTo")
	assert(type(scale) == "number" and scale > 0, "ScaleTo expects a positive number")
end

function Methods.GetScale()
	return 1
end

function Methods.GetMass(inst)
	local s = checkSelf(inst, "GetMass")
	local size = s.props.Size or Vector3.new(4, 1, 2)
	return size.X * size.Y * size.Z * 0.7
end

function Methods.SetNetworkOwner(inst, owner)
	local s = checkSelf(inst, "SetNetworkOwner")
	if s.props.Anchored then
		error("Network Ownership API cannot be called on Anchored parts or parts welded to Anchored parts.", 2)
	end
	if not Methods.IsDescendantOf(inst, workspace) then
		error("Network Ownership API can only be called on descendants of Workspace", 2)
	end
	if owner ~= nil and not Methods.IsA(owner, "Player") then
		error("SetNetworkOwner expects a Player or nil", 2)
	end
end
function Methods.SetNetworkOwnershipAuto() end
function Methods.GetNetworkOwner()
	return nil
end
function Methods.CanSetNetworkOwner(inst)
	return not S[inst].props.Anchored
end
function Methods.ApplyImpulse() end
function Methods.ApplyAngularImpulse() end
function Methods.GetTouchingParts()
	return {}
end
function Methods.GetConnectedParts()
	return {}
end
function Methods.BreakJoints() end

-- Humanoid
function Methods.ChangeState(inst, state)
	local s = checkSelf(inst, "ChangeState")
	s.humanoidState = state
	local sig = s.signals.StateChanged
	if sig then
		sig:Fire(state, state)
	end
end
function Methods.GetState(inst)
	return checkSelf(inst, "GetState").humanoidState or Enum.HumanoidStateType.Running
end
function Methods.SetStateEnabled(inst, state, enabled)
	local s = checkSelf(inst, "SetStateEnabled")
	assert(typeOf(state) == "EnumItem" and state.EnumType == Enum.HumanoidStateType, "SetStateEnabled expects a HumanoidStateType")
	assert(type(enabled) == "boolean", "SetStateEnabled expects a boolean")
	s.disabledStates = s.disabledStates or {}
	s.disabledStates[state] = not enabled
end
function Methods.GetStateEnabled(inst, state)
	local s = checkSelf(inst, "GetStateEnabled")
	return not (s.disabledStates and s.disabledStates[state])
end
function Methods.TakeDamage(inst, amount)
	local s = checkSelf(inst, "TakeDamage")
	s.props.Health = math.max(0, (s.props.Health or 100) - amount)
end
function Methods.AddAccessory(inst, acc)
	checkSelf(inst, "AddAccessory")
	assert(M.isInstance(acc) and Methods.IsA(acc, "Accoutrement"), "AddAccessory expects an Accessory")
	local handle = Methods.FindFirstChild(acc, "Handle")
	assert(handle and Methods.FindFirstChildWhichIsA(handle, "Attachment"), "Accessory needs a Handle with an Attachment")
	local char = S[inst].parent
	if char then
		acc.Parent = char
	end
end
function Methods.UnequipTools() end
function Methods.EquipTool(inst, tool)
	checkSelf(inst, "EquipTool")
	local char = S[inst].parent
	if char then
		tool.Parent = char
	end
end
function Methods.GetPlayingAnimationTracks()
	return {}
end
local function animTrack()
	local track = {
		Length = 1,
		IsPlaying = false,
		Looped = false,
		Speed = 1,
		Stopped = Signal.new("Stopped"),
	}
	function track.Play(self)
		self.IsPlaying = true
	end
	function track.Stop(self)
		self.IsPlaying = false
		self.Stopped:Fire()
	end
	function track.AdjustSpeed() end
	function track.Destroy() end
	return track
end
function Methods.LoadAnimation(inst, anim)
	checkSelf(inst, "LoadAnimation")
	assert(isInstance(anim) and Methods.IsA(anim, "Animation"), "LoadAnimation expects an Animation")
	return animTrack()
end

-- Sound / effects
function Methods.Play(inst)
	checkSelf(inst, "Play")
	local s = S[inst]
	if s.class == "Tween" then
		return M.playTween(inst)
	end
	s.props.Playing = true
end
function Methods.Stop(inst)
	checkSelf(inst, "Stop")
	S[inst].props.Playing = false
end
function Methods.Pause(inst)
	checkSelf(inst, "Pause")
end
function Methods.Resume(inst)
	checkSelf(inst, "Resume")
end
function Methods.Cancel(inst)
	local s = checkSelf(inst, "Cancel")
	s.tweenCancelled = true
end
function Methods.Emit(inst, count)
	checkSelf(inst, "Emit")
	assert(count == nil or type(count) == "number", "Emit expects a number")
end
function Methods.Clear(inst)
	checkSelf(inst, "Clear")
end

-- Remotes
local function checkRemoteArgs(args, n)
	local function visit(v, depth)
		local t = typeOf(v)
		if t == "function" or t == "thread" then
			error("Remote arguments cannot contain " .. t .. "s", 4)
		end
		if t == "table" then
			if depth > 20 then
				error("Remote argument nesting too deep", 4)
			end
			local hasNum, hasStr = false, false
			for k, val in v do
				if type(k) == "number" then
					hasNum = true
				elseif type(k) == "string" then
					hasStr = true
				else
					error("Remote table keys must be strings or numbers", 4)
				end
				visit(val, depth + 1)
			end
			if hasNum and hasStr then
				report("warn", "remote table mixes array and dictionary keys (data will be lost)")
			end
		end
	end
	for i = 1, n do
		visit(args[i], 0)
	end
end
local function deepCopy(v)
	if type(v) == "table" and getmetatable(v) == nil then
		local out = {}
		for k, val in v do
			out[k] = deepCopy(val)
		end
		return out
	end
	return v
end
function Methods.FireServer(inst, ...)
	checkSelf(inst, "FireServer")
	local args = table.pack(...)
	checkRemoteArgs(args, args.n)
	local copy = deepCopy(args)
	task.defer(function()
		getSignal(inst, "OnServerEvent"):Fire(M.localPlayer, table.unpack(copy, 1, args.n))
	end)
end
function Methods.FireClient(inst, player, ...)
	checkSelf(inst, "FireClient")
	if not isInstance(player) or not Methods.IsA(player, "Player") then
		error("FireClient: player argument must be a Player", 2)
	end
	local args = table.pack(...)
	checkRemoteArgs(args, args.n)
	local copy = deepCopy(args)
	if player == M.localPlayer then
		task.defer(function()
			getSignal(inst, "OnClientEvent"):Fire(table.unpack(copy, 1, args.n))
		end)
	end
end
function Methods.FireAllClients(inst, ...)
	checkSelf(inst, "FireAllClients")
	local args = table.pack(...)
	checkRemoteArgs(args, args.n)
	local copy = deepCopy(args)
	task.defer(function()
		getSignal(inst, "OnClientEvent"):Fire(table.unpack(copy, 1, args.n))
	end)
end
function Methods.Fire(inst, ...)
	checkSelf(inst, "Fire")
	getSignal(inst, "Event"):Fire(...)
end

-- Debris / misc services
function Methods.AddItem(_, inst, life)
	task.delay(life or 10, function()
		destroy(inst)
	end)
end

---------------------------------------------------------------------------
-- Instance global
---------------------------------------------------------------------------
_G.Instance = {
	new = function(className, parent)
		if type(className) ~= "string" then
			error("Instance.new expects a class name string", 2)
		end
		local inst = newInstance(className)
		if parent ~= nil then
			report("warn", "Instance.new with parent argument is slower: " .. className)
			setParent(inst, parent)
		end
		return inst
	end,
	fromExisting = function(inst)
		return clone(inst)
	end,
}

return M
