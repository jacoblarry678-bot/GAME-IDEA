-- Roblox datatype emulation for the headless test harness (not shipped in
-- the game). Implements the parts of Vector3, CFrame, Color3, UDim2, etc.
-- the game uses, with the same semantics as Roblox.

local M = {}
_G.__mock = M

local rawtype = type
local function typeOf(v: any): string
	local mt = getmetatable(v)
	if rawtype(mt) == "table" then
		local t = rawget(mt, "__type")
		if t then
			return t
		end
	end
	return rawtype(v)
end
_G.typeof = typeOf
M.typeof = typeOf

local function argError(fn, i, expected, got)
	error(string.format("invalid argument #%d to '%s' (%s expected, got %s)", i, fn, expected, typeOf(got)), 3)
end

local function frozen(name: string)
	return function(_, k)
		error(string.format("%s cannot be assigned to (%s is read-only)", tostring(k), name), 2)
	end
end

---------------------------------------------------------------------------
-- Vector3
---------------------------------------------------------------------------
local V3 = {}
local V3mt = { __type = "Vector3" }
local newV3

function V3mt.__index(v, k)
	if k == "Magnitude" then
		return math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
	elseif k == "Unit" then
		local m = math.sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z)
		if m == 0 then
			return newV3(0 / 0, 0 / 0, 0 / 0)
		end
		return newV3(v.X / m, v.Y / m, v.Z / m)
	elseif k == "x" then
		return v.X
	elseif k == "y" then
		return v.Y
	elseif k == "z" then
		return v.Z
	end
	local f = V3[k]
	if f then
		return f
	end
	error(tostring(k) .. " is not a valid member of Vector3", 2)
end
V3mt.__newindex = frozen("Vector3")

newV3 = function(x, y, z)
	return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0 }, V3mt)
end
M.newV3 = newV3

local function isV3(v)
	return getmetatable(v) == V3mt
end

function V3mt.__add(a, b)
	if not isV3(a) or not isV3(b) then
		error("attempt to perform arithmetic (add) on " .. typeOf(a) .. " and " .. typeOf(b), 2)
	end
	return newV3(a.X + b.X, a.Y + b.Y, a.Z + b.Z)
end
function V3mt.__sub(a, b)
	if not isV3(a) or not isV3(b) then
		error("attempt to perform arithmetic (sub) on " .. typeOf(a) .. " and " .. typeOf(b), 2)
	end
	return newV3(a.X - b.X, a.Y - b.Y, a.Z - b.Z)
end
function V3mt.__mul(a, b)
	if rawtype(a) == "number" then
		return newV3(a * b.X, a * b.Y, a * b.Z)
	elseif rawtype(b) == "number" then
		return newV3(a.X * b, a.Y * b, a.Z * b)
	elseif isV3(a) and isV3(b) then
		return newV3(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
	end
	error("attempt to perform arithmetic (mul) on " .. typeOf(a) .. " and " .. typeOf(b), 2)
end
function V3mt.__div(a, b)
	if rawtype(b) == "number" then
		return newV3(a.X / b, a.Y / b, a.Z / b)
	elseif isV3(a) and isV3(b) then
		return newV3(a.X / b.X, a.Y / b.Y, a.Z / b.Z)
	end
	error("attempt to perform arithmetic (div) on " .. typeOf(a) .. " and " .. typeOf(b), 2)
end
function V3mt.__idiv(a, b)
	return newV3(a.X // b, a.Y // b, a.Z // b)
end
function V3mt.__unm(a)
	return newV3(-a.X, -a.Y, -a.Z)
end
function V3mt.__eq(a, b)
	return a.X == b.X and a.Y == b.Y and a.Z == b.Z
end
function V3mt.__tostring(v)
	return string.format("%g, %g, %g", v.X, v.Y, v.Z)
end

function V3.Dot(a, b)
	return a.X * b.X + a.Y * b.Y + a.Z * b.Z
end
function V3.Cross(a, b)
	return newV3(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X)
end
function V3.Lerp(a, b, t)
	if not isV3(b) then
		argError("Lerp", 1, "Vector3", b)
	end
	return newV3(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t, a.Z + (b.Z - a.Z) * t)
end
function V3.FuzzyEq(a, b, eps)
	eps = eps or 1e-5
	return math.abs(a.X - b.X) <= eps and math.abs(a.Y - b.Y) <= eps and math.abs(a.Z - b.Z) <= eps
end
function V3.Abs(a)
	return newV3(math.abs(a.X), math.abs(a.Y), math.abs(a.Z))
end
function V3.Floor(a)
	return newV3(math.floor(a.X), math.floor(a.Y), math.floor(a.Z))
end
function V3.Ceil(a)
	return newV3(math.ceil(a.X), math.ceil(a.Y), math.ceil(a.Z))
end
function V3.Sign(a)
	return newV3(math.sign(a.X), math.sign(a.Y), math.sign(a.Z))
end
function V3.Max(a, b)
	return newV3(math.max(a.X, b.X), math.max(a.Y, b.Y), math.max(a.Z, b.Z))
end
function V3.Min(a, b)
	return newV3(math.min(a.X, b.X), math.min(a.Y, b.Y), math.min(a.Z, b.Z))
end
function V3.Angle(a, b)
	local d = V3.Dot(a, b) / (a.Magnitude * b.Magnitude)
	return math.acos(math.clamp(d, -1, 1))
end

_G.Vector3 = {
	new = function(x, y, z)
		for i, v in { x or 0, y or 0, z or 0 } do
			if rawtype(v) ~= "number" then
				argError("Vector3.new", i, "number", v)
			end
		end
		return newV3(x, y, z)
	end,
	zero = newV3(0, 0, 0),
	one = newV3(1, 1, 1),
	xAxis = newV3(1, 0, 0),
	yAxis = newV3(0, 1, 0),
	zAxis = newV3(0, 0, 1),
	FromNormalId = function()
		return newV3(0, 1, 0)
	end,
}

---------------------------------------------------------------------------
-- Vector2
---------------------------------------------------------------------------
local V2 = {}
local V2mt = { __type = "Vector2" }
local function newV2(x, y)
	return setmetatable({ X = x or 0, Y = y or 0 }, V2mt)
end
function V2mt.__index(v, k)
	if k == "Magnitude" then
		return math.sqrt(v.X * v.X + v.Y * v.Y)
	elseif k == "Unit" then
		local m = math.sqrt(v.X * v.X + v.Y * v.Y)
		return newV2(v.X / m, v.Y / m)
	end
	local f = V2[k]
	if f then
		return f
	end
	error(tostring(k) .. " is not a valid member of Vector2", 2)
end
V2mt.__newindex = frozen("Vector2")
V2mt.__add = function(a, b)
	return newV2(a.X + b.X, a.Y + b.Y)
end
V2mt.__sub = function(a, b)
	return newV2(a.X - b.X, a.Y - b.Y)
end
V2mt.__mul = function(a, b)
	if rawtype(a) == "number" then
		return newV2(a * b.X, a * b.Y)
	elseif rawtype(b) == "number" then
		return newV2(a.X * b, a.Y * b)
	end
	return newV2(a.X * b.X, a.Y * b.Y)
end
V2mt.__div = function(a, b)
	if rawtype(b) == "number" then
		return newV2(a.X / b, a.Y / b)
	end
	return newV2(a.X / b.X, a.Y / b.Y)
end
V2mt.__unm = function(a)
	return newV2(-a.X, -a.Y)
end
V2mt.__eq = function(a, b)
	return a.X == b.X and a.Y == b.Y
end
V2mt.__tostring = function(v)
	return string.format("%g, %g", v.X, v.Y)
end
function V2.Dot(a, b)
	return a.X * b.X + a.Y * b.Y
end
function V2.Lerp(a, b, t)
	return newV2(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t)
end
_G.Vector2 = {
	new = function(x, y)
		return newV2(x, y)
	end,
	zero = newV2(0, 0),
	one = newV2(1, 1),
	xAxis = newV2(1, 0),
	yAxis = newV2(0, 1),
}

---------------------------------------------------------------------------
-- CFrame (position + 3x3 rotation, rows r[1..9])
---------------------------------------------------------------------------
local CF = {}
local CFmt = { __type = "CFrame" }
local function newCF(x, y, z, r)
	return setmetatable({ x = x, y = y, z = z, r = r }, CFmt)
end
local IDR = { 1, 0, 0, 0, 1, 0, 0, 0, 1 }
local function isCF(v)
	return getmetatable(v) == CFmt
end

local function mulR(a, b)
	return {
		a[1] * b[1] + a[2] * b[4] + a[3] * b[7],
		a[1] * b[2] + a[2] * b[5] + a[3] * b[8],
		a[1] * b[3] + a[2] * b[6] + a[3] * b[9],
		a[4] * b[1] + a[5] * b[4] + a[6] * b[7],
		a[4] * b[2] + a[5] * b[5] + a[6] * b[8],
		a[4] * b[3] + a[5] * b[6] + a[6] * b[9],
		a[7] * b[1] + a[8] * b[4] + a[9] * b[7],
		a[7] * b[2] + a[8] * b[5] + a[9] * b[8],
		a[7] * b[3] + a[8] * b[6] + a[9] * b[9],
	}
end
local function transposeR(a)
	return { a[1], a[4], a[7], a[2], a[5], a[8], a[3], a[6], a[9] }
end
local function rx(a)
	local c, s = math.cos(a), math.sin(a)
	return { 1, 0, 0, 0, c, -s, 0, s, c }
end
local function ry(a)
	local c, s = math.cos(a), math.sin(a)
	return { c, 0, s, 0, 1, 0, -s, 0, c }
end
local function rz(a)
	local c, s = math.cos(a), math.sin(a)
	return { c, -s, 0, s, c, 0, 0, 0, 1 }
end

local function fromQuat(qx, qy, qz, qw)
	local m = math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw)
	qx, qy, qz, qw = qx / m, qy / m, qz / m, qw / m
	return {
		1 - 2 * (qy * qy + qz * qz),
		2 * (qx * qy - qz * qw),
		2 * (qx * qz + qy * qw),
		2 * (qx * qy + qz * qw),
		1 - 2 * (qx * qx + qz * qz),
		2 * (qy * qz - qx * qw),
		2 * (qx * qz - qy * qw),
		2 * (qy * qz + qx * qw),
		1 - 2 * (qx * qx + qy * qy),
	}
end
local function toQuat(r)
	local trace = r[1] + r[5] + r[9]
	local qx, qy, qz, qw
	if trace > 0 then
		local s = math.sqrt(1 + trace) * 2
		qw = 0.25 * s
		qx = (r[8] - r[6]) / s
		qy = (r[3] - r[7]) / s
		qz = (r[4] - r[2]) / s
	elseif r[1] > r[5] and r[1] > r[9] then
		local s = math.sqrt(1 + r[1] - r[5] - r[9]) * 2
		qw = (r[8] - r[6]) / s
		qx = 0.25 * s
		qy = (r[2] + r[4]) / s
		qz = (r[3] + r[7]) / s
	elseif r[5] > r[9] then
		local s = math.sqrt(1 + r[5] - r[1] - r[9]) * 2
		qw = (r[3] - r[7]) / s
		qx = (r[2] + r[4]) / s
		qy = 0.25 * s
		qz = (r[6] + r[8]) / s
	else
		local s = math.sqrt(1 + r[9] - r[1] - r[5]) * 2
		qw = (r[4] - r[2]) / s
		qx = (r[3] + r[7]) / s
		qy = (r[6] + r[8]) / s
		qz = 0.25 * s
	end
	return qx, qy, qz, qw
end

function CFmt.__index(cf, k)
	local r = cf.r
	if k == "Position" or k == "p" then
		return newV3(cf.x, cf.y, cf.z)
	elseif k == "X" then
		return cf.x
	elseif k == "Y" then
		return cf.y
	elseif k == "Z" then
		return cf.z
	elseif k == "LookVector" then
		return newV3(-r[3], -r[6], -r[9])
	elseif k == "RightVector" or k == "XVector" then
		return newV3(r[1], r[4], r[7])
	elseif k == "UpVector" or k == "YVector" then
		return newV3(r[2], r[5], r[8])
	elseif k == "ZVector" then
		return newV3(r[3], r[6], r[9])
	elseif k == "Rotation" then
		return newCF(0, 0, 0, r)
	end
	local f = CF[k]
	if f then
		return f
	end
	error(tostring(k) .. " is not a valid member of CFrame", 2)
end
CFmt.__newindex = frozen("CFrame")
function CFmt.__mul(a, b)
	if not isCF(a) then
		error("attempt to perform arithmetic (mul) on " .. typeOf(a) .. " and " .. typeOf(b), 2)
	end
	if isCF(b) then
		local r = a.r
		return newCF(
			r[1] * b.x + r[2] * b.y + r[3] * b.z + a.x,
			r[4] * b.x + r[5] * b.y + r[6] * b.z + a.y,
			r[7] * b.x + r[8] * b.y + r[9] * b.z + a.z,
			mulR(a.r, b.r)
		)
	elseif isV3(b) then
		local r = a.r
		return newV3(
			r[1] * b.X + r[2] * b.Y + r[3] * b.Z + a.x,
			r[4] * b.X + r[5] * b.Y + r[6] * b.Z + a.y,
			r[7] * b.X + r[8] * b.Y + r[9] * b.Z + a.z
		)
	end
	error("attempt to perform arithmetic (mul) on CFrame and " .. typeOf(b), 2)
end
function CFmt.__add(a, b)
	if not isCF(a) or not isV3(b) then
		error("attempt to perform arithmetic (add) on " .. typeOf(a) .. " and " .. typeOf(b), 2)
	end
	return newCF(a.x + b.X, a.y + b.Y, a.z + b.Z, a.r)
end
function CFmt.__sub(a, b)
	if not isCF(a) or not isV3(b) then
		error("attempt to perform arithmetic (sub) on " .. typeOf(a) .. " and " .. typeOf(b), 2)
	end
	return newCF(a.x - b.X, a.y - b.Y, a.z - b.Z, a.r)
end
function CFmt.__eq(a, b)
	if a.x ~= b.x or a.y ~= b.y or a.z ~= b.z then
		return false
	end
	for i = 1, 9 do
		if a.r[i] ~= b.r[i] then
			return false
		end
	end
	return true
end
function CFmt.__tostring(cf)
	local r = cf.r
	return string.format("%g, %g, %g, %g, %g, %g, %g, %g, %g, %g, %g, %g", cf.x, cf.y, cf.z, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9])
end

function CF.Inverse(cf)
	local t = transposeR(cf.r)
	return newCF(
		-(t[1] * cf.x + t[2] * cf.y + t[3] * cf.z),
		-(t[4] * cf.x + t[5] * cf.y + t[6] * cf.z),
		-(t[7] * cf.x + t[8] * cf.y + t[9] * cf.z),
		t
	)
end
function CF.ToWorldSpace(a, b)
	return a * b
end
function CF.ToObjectSpace(a, b)
	return CF.Inverse(a) * b
end
function CF.PointToWorldSpace(a, v)
	return a * v
end
function CF.PointToObjectSpace(a, v)
	return CF.Inverse(a) * v
end
function CF.VectorToWorldSpace(a, v)
	local r = a.r
	return newV3(r[1] * v.X + r[2] * v.Y + r[3] * v.Z, r[4] * v.X + r[5] * v.Y + r[6] * v.Z, r[7] * v.X + r[8] * v.Y + r[9] * v.Z)
end
function CF.VectorToObjectSpace(a, v)
	local r = a.r
	return newV3(r[1] * v.X + r[4] * v.Y + r[7] * v.Z, r[2] * v.X + r[5] * v.Y + r[8] * v.Z, r[3] * v.X + r[6] * v.Y + r[9] * v.Z)
end
function CF.GetComponents(cf)
	local r = cf.r
	return cf.x, cf.y, cf.z, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9]
end
CF.components = CF.GetComponents
function CF.Lerp(a, b, t)
	if not isCF(b) then
		argError("Lerp", 1, "CFrame", b)
	end
	local ax, ay, az, aw = toQuat(a.r)
	local bx, by, bz, bw = toQuat(b.r)
	local d = ax * bx + ay * by + az * bz + aw * bw
	if d < 0 then
		bx, by, bz, bw, d = -bx, -by, -bz, -bw, -d
	end
	local qx, qy, qz, qw
	if d > 0.9995 then
		qx, qy, qz, qw = ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, aw + (bw - aw) * t
	else
		local th = math.acos(d)
		local s = math.sin(th)
		local wa, wb = math.sin((1 - t) * th) / s, math.sin(t * th) / s
		qx, qy, qz, qw = ax * wa + bx * wb, ay * wa + by * wb, az * wa + bz * wb, aw * wa + bw * wb
	end
	return newCF(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, fromQuat(qx, qy, qz, qw))
end
function CF.ToEulerAnglesXYZ(cf)
	local r = cf.r
	local y = math.asin(math.clamp(r[3], -1, 1))
	local x = math.atan2(-r[6], r[9])
	local z = math.atan2(-r[2], r[1])
	return x, y, z
end
function CF.ToEulerAnglesYXZ(cf)
	local r = cf.r
	local x = math.asin(math.clamp(-r[6], -1, 1))
	local y = math.atan2(r[3], r[9])
	local z = math.atan2(r[4], r[5])
	return x, y, z
end
CF.ToOrientation = CF.ToEulerAnglesYXZ
function CF.ToAxisAngle(cf)
	local qx, qy, qz, qw = toQuat(cf.r)
	local angle = 2 * math.acos(math.clamp(qw, -1, 1))
	local s = math.sqrt(1 - qw * qw)
	if s < 1e-6 then
		return newV3(1, 0, 0), 0
	end
	return newV3(qx / s, qy / s, qz / s), angle
end
function CF.Orthonormalize(cf)
	local r = cf.r
	local x = newV3(r[1], r[4], r[7])
	local y = newV3(r[2], r[5], r[8])
	if x.Magnitude < 1e-9 or y.Magnitude < 1e-9 then
		return newCF(cf.x, cf.y, cf.z, IDR)
	end
	x = x.Unit
	y = (y - x * V3.Dot(x, y)).Unit
	local z = V3.Cross(x, y)
	return newCF(cf.x, cf.y, cf.z, { x.X, y.X, z.X, x.Y, y.Y, z.Y, x.Z, y.Z, z.Z })
end
function CF.FuzzyEq(a, b, eps)
	eps = eps or 1e-5
	if math.abs(a.x - b.x) > eps or math.abs(a.y - b.y) > eps or math.abs(a.z - b.z) > eps then
		return false
	end
	for i = 1, 9 do
		if math.abs(a.r[i] - b.r[i]) > eps then
			return false
		end
	end
	return true
end

local function fromColumns(pos, vx, vy, vz)
	return newCF(pos.X, pos.Y, pos.Z, { vx.X, vy.X, vz.X, vx.Y, vy.Y, vz.Y, vx.Z, vy.Z, vz.Z })
end

local function checkNumber(fn, i, v)
	if rawtype(v) ~= "number" then
		argError(fn, i, "number", v)
	end
	if v ~= v then
		error(fn .. ": argument #" .. i .. " is NaN", 3)
	end
end

local function lookAt(at, target, up)
	up = up or newV3(0, 1, 0)
	local look = target - at
	if look.Magnitude < 1e-9 then
		return newCF(at.X, at.Y, at.Z, IDR)
	end
	look = look.Unit
	local right = V3.Cross(look, up)
	if right.Magnitude < 1e-6 then
		right = V3.Cross(look, newV3(0, 0, 1))
		if right.Magnitude < 1e-6 then
			right = V3.Cross(look, newV3(1, 0, 0))
		end
	end
	right = right.Unit
	local up2 = V3.Cross(right, look)
	return fromColumns(at, right, up2, -look)
end

_G.CFrame = {
	new = function(...)
		local n = select("#", ...)
		local a = { ... }
		if n == 0 then
			return newCF(0, 0, 0, IDR)
		elseif n == 1 then
			if not isV3(a[1]) then
				argError("CFrame.new", 1, "Vector3", a[1])
			end
			return newCF(a[1].X, a[1].Y, a[1].Z, IDR)
		elseif n == 2 then
			if not isV3(a[1]) or not isV3(a[2]) then
				argError("CFrame.new", 2, "Vector3", a[2])
			end
			return lookAt(a[1], a[2])
		elseif n == 3 then
			for i = 1, 3 do
				checkNumber("CFrame.new", i, a[i])
			end
			return newCF(a[1], a[2], a[3], IDR)
		elseif n == 7 then
			for i = 1, 7 do
				checkNumber("CFrame.new", i, a[i])
			end
			return newCF(a[1], a[2], a[3], fromQuat(a[4], a[5], a[6], a[7]))
		elseif n == 12 then
			for i = 1, 12 do
				checkNumber("CFrame.new", i, a[i])
			end
			return newCF(a[1], a[2], a[3], { a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12] })
		end
		error("Invalid number of arguments: " .. n, 2)
	end,
	lookAt = function(at, target, up)
		if not isV3(at) or not isV3(target) then
			argError("CFrame.lookAt", 1, "Vector3", at)
		end
		return lookAt(at, target, up)
	end,
	lookAlong = function(at, dir, up)
		return lookAt(at, at + dir, up)
	end,
	Angles = function(x, y, z)
		checkNumber("CFrame.Angles", 1, x)
		checkNumber("CFrame.Angles", 2, y)
		checkNumber("CFrame.Angles", 3, z)
		return newCF(0, 0, 0, mulR(mulR(rx(x), ry(y)), rz(z)))
	end,
	fromEulerAnglesXYZ = function(x, y, z)
		return newCF(0, 0, 0, mulR(mulR(rx(x), ry(y)), rz(z)))
	end,
	fromEulerAnglesYXZ = function(x, y, z)
		return newCF(0, 0, 0, mulR(mulR(ry(y), rx(x)), rz(z)))
	end,
	fromOrientation = function(x, y, z)
		return newCF(0, 0, 0, mulR(mulR(ry(y), rx(x)), rz(z)))
	end,
	fromAxisAngle = function(axis, angle)
		local u = axis.Unit
		local s = math.sin(angle / 2)
		return newCF(0, 0, 0, fromQuat(u.X * s, u.Y * s, u.Z * s, math.cos(angle / 2)))
	end,
	fromMatrix = function(pos, vx, vy, vz)
		if not isV3(pos) or not isV3(vx) or not isV3(vy) then
			argError("CFrame.fromMatrix", 1, "Vector3", pos)
		end
		vz = vz or V3.Cross(vx, vy).Unit
		return fromColumns(pos, vx, vy, vz)
	end,
	identity = newCF(0, 0, 0, IDR),
}

---------------------------------------------------------------------------
-- Color3
---------------------------------------------------------------------------
local C3 = {}
local C3mt = { __type = "Color3" }
local function newC3(r, g, b)
	return setmetatable({ R = r, G = g, B = b }, C3mt)
end
C3mt.__index = function(_, k)
	local f = C3[k]
	if f then
		return f
	end
	error(tostring(k) .. " is not a valid member of Color3", 2)
end
C3mt.__newindex = frozen("Color3")
C3mt.__eq = function(a, b)
	return a.R == b.R and a.G == b.G and a.B == b.B
end
C3mt.__tostring = function(c)
	return string.format("%g, %g, %g", c.R, c.G, c.B)
end
function C3.Lerp(a, b, t)
	return newC3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t)
end
function C3.ToHSV(c)
	local r, g, b = c.R, c.G, c.B
	local mx, mn = math.max(r, g, b), math.min(r, g, b)
	local h, s, v = 0, 0, mx
	local d = mx - mn
	if mx > 0 then
		s = d / mx
	end
	if d > 0 then
		if mx == r then
			h = (g - b) / d % 6
		elseif mx == g then
			h = (b - r) / d + 2
		else
			h = (r - g) / d + 4
		end
		h /= 6
	end
	return h, s, v
end
function C3.ToHex(c)
	return string.format("%02X%02X%02X", math.floor(c.R * 255 + 0.5), math.floor(c.G * 255 + 0.5), math.floor(c.B * 255 + 0.5))
end
local function hsv(h, s, v)
	h = (h % 1) * 6
	local i = math.floor(h)
	local f = h - i
	local p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
	if i == 0 then
		return newC3(v, t, p)
	elseif i == 1 then
		return newC3(q, v, p)
	elseif i == 2 then
		return newC3(p, v, t)
	elseif i == 3 then
		return newC3(p, q, v)
	elseif i == 4 then
		return newC3(t, p, v)
	end
	return newC3(v, p, q)
end
_G.Color3 = {
	new = function(r, g, b)
		return newC3(r or 0, g or 0, b or 0)
	end,
	fromRGB = function(r, g, b)
		for i, v in { r, g, b } do
			checkNumber("Color3.fromRGB", i, v)
		end
		return newC3(r / 255, g / 255, b / 255)
	end,
	fromHSV = function(h, s, v)
		return hsv(h, s, v)
	end,
	fromHex = function(hex)
		hex = hex:gsub("#", "")
		return newC3(tonumber(hex:sub(1, 2), 16) / 255, tonumber(hex:sub(3, 4), 16) / 255, tonumber(hex:sub(5, 6), 16) / 255)
	end,
	toHSV = function(c)
		return C3.ToHSV(c)
	end,
}

---------------------------------------------------------------------------
-- UDim / UDim2
---------------------------------------------------------------------------
local UDmt = { __type = "UDim" }
UDmt.__index = function(_, k)
	error(tostring(k) .. " is not a valid member of UDim", 2)
end
local function newUD(s, o)
	return setmetatable({ Scale = s or 0, Offset = o or 0 }, UDmt)
end
UDmt.__add = function(a, b)
	return newUD(a.Scale + b.Scale, a.Offset + b.Offset)
end
UDmt.__sub = function(a, b)
	return newUD(a.Scale - b.Scale, a.Offset - b.Offset)
end
UDmt.__eq = function(a, b)
	return a.Scale == b.Scale and a.Offset == b.Offset
end
_G.UDim = {
	new = function(s, o)
		return newUD(s, o)
	end,
}
local UD2 = {}
local UD2mt = { __type = "UDim2" }
local function newUD2(xs, xo, ys, yo)
	for i, v in { xs or 0, xo or 0, ys or 0, yo or 0 } do
		checkNumber("UDim2.new", i, v)
	end
	local u = setmetatable({ X = newUD(xs, xo), Y = newUD(ys, yo) }, UD2mt)
	return u
end
UD2mt.__index = function(u, k)
	if k == "Width" then
		return rawget(u, "X")
	elseif k == "Height" then
		return rawget(u, "Y")
	end
	local f = UD2[k]
	if f then
		return f
	end
	error(tostring(k) .. " is not a valid member of UDim2", 2)
end
UD2mt.__add = function(a, b)
	return newUD2(a.X.Scale + b.X.Scale, a.X.Offset + b.X.Offset, a.Y.Scale + b.Y.Scale, a.Y.Offset + b.Y.Offset)
end
UD2mt.__sub = function(a, b)
	return newUD2(a.X.Scale - b.X.Scale, a.X.Offset - b.X.Offset, a.Y.Scale - b.Y.Scale, a.Y.Offset - b.Y.Offset)
end
UD2mt.__unm = function(a)
	return newUD2(-a.X.Scale, -a.X.Offset, -a.Y.Scale, -a.Y.Offset)
end
UD2mt.__eq = function(a, b)
	return a.X == b.X and a.Y == b.Y
end
function UD2.Lerp(a, b, t)
	return newUD2(
		a.X.Scale + (b.X.Scale - a.X.Scale) * t,
		a.X.Offset + (b.X.Offset - a.X.Offset) * t,
		a.Y.Scale + (b.Y.Scale - a.Y.Scale) * t,
		a.Y.Offset + (b.Y.Offset - a.Y.Offset) * t
	)
end
_G.UDim2 = {
	new = function(xs, xo, ys, yo)
		if getmetatable(xs) == UDmt then
			return newUD2(xs.Scale, xs.Offset, xo.Scale, xo.Offset)
		end
		return newUD2(xs or 0, xo or 0, ys or 0, yo or 0)
	end,
	fromScale = function(x, y)
		return newUD2(x, 0, y, 0)
	end,
	fromOffset = function(x, y)
		return newUD2(0, x, 0, y)
	end,
}

---------------------------------------------------------------------------
-- Sequences, ranges, misc
---------------------------------------------------------------------------
local function simple(typeName, fields)
	local mt = { __type = typeName }
	mt.__index = function(_, k)
		error(tostring(k) .. " is not a valid member of " .. typeName, 2)
	end
	mt.__newindex = frozen(typeName)
	return function(values)
		local t = {}
		for i, f in fields do
			t[f] = values[i]
		end
		return setmetatable(t, mt)
	end
end

local makeNSK = simple("NumberSequenceKeypoint", { "Time", "Value", "Envelope" })
_G.NumberSequenceKeypoint = {
	new = function(t, v, e)
		return makeNSK({ t, v, e or 0 })
	end,
}
local makeNS = simple("NumberSequence", { "Keypoints" })
_G.NumberSequence = {
	new = function(a, b)
		if rawtype(a) == "number" then
			return makeNS({ { makeNSK({ 0, a, 0 }), makeNSK({ 1, b or a, 0 }) } })
		end
		assert(rawtype(a) == "table" and #a >= 2, "NumberSequence.new: needs at least two keypoints")
		for _, kp in a do
			assert(typeOf(kp) == "NumberSequenceKeypoint", "NumberSequence.new: expected keypoints")
		end
		assert(a[1].Time == 0 and a[#a].Time == 1, "NumberSequence: keypoints must start at 0 and end at 1")
		return makeNS({ a })
	end,
}
local makeCSK = simple("ColorSequenceKeypoint", { "Time", "Value" })
_G.ColorSequenceKeypoint = {
	new = function(t, v)
		assert(typeOf(v) == "Color3", "ColorSequenceKeypoint.new expects a Color3")
		return makeCSK({ t, v })
	end,
}
local makeCS = simple("ColorSequence", { "Keypoints" })
_G.ColorSequence = {
	new = function(a, b)
		if typeOf(a) == "Color3" then
			return makeCS({ { makeCSK({ 0, a }), makeCSK({ 1, b or a }) } })
		end
		assert(rawtype(a) == "table" and #a >= 2, "ColorSequence.new: needs at least two keypoints")
		assert(a[1].Time == 0 and a[#a].Time == 1, "ColorSequence: keypoints must start at 0 and end at 1")
		return makeCS({ a })
	end,
}
local makeNR = simple("NumberRange", { "Min", "Max" })
_G.NumberRange = {
	new = function(a, b)
		checkNumber("NumberRange.new", 1, a)
		return makeNR({ a, b or a })
	end,
}
local makeRect = simple("Rect", { "Min", "Max" })
_G.Rect = {
	new = function(a, b, c, d)
		if rawtype(a) == "number" then
			return makeRect({ newV2(a, b), newV2(c, d) })
		end
		return makeRect({ a, b })
	end,
}
local makeTI = simple("TweenInfo", { "Time", "EasingStyle", "EasingDirection", "RepeatCount", "Reverses", "DelayTime" })
_G.TweenInfo = {
	new = function(time, style, dir, rep, rev, delay)
		if style ~= nil then
			assert(typeOf(style) == "EnumItem" and style.EnumType == Enum.EasingStyle, "TweenInfo.new: bad EasingStyle")
		end
		if dir ~= nil then
			assert(typeOf(dir) == "EnumItem" and dir.EnumType == Enum.EasingDirection, "TweenInfo.new: bad EasingDirection")
		end
		return makeTI({ time or 1, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out, rep or 0, rev or false, delay or 0 })
	end,
}
local makePP = simple("PhysicalProperties", { "Density", "Friction", "Elasticity", "FrictionWeight", "ElasticityWeight" })
_G.PhysicalProperties = {
	new = function(d, f, e, fw, ew)
		return makePP({ d, f or 0.3, e or 0.5, fw or 1, ew or 1 })
	end,
}
local makeFont = simple("Font", { "Family", "Weight", "Style", "Bold" })
_G.Font = {
	new = function(family, weight, style)
		return makeFont({ family, weight or Enum.FontWeight.Regular, style or Enum.FontStyle.Normal, false })
	end,
	fromEnum = function(e)
		return makeFont({ "rbxasset://fonts/families/" .. e.Name .. ".json", Enum.FontWeight.Regular, Enum.FontStyle.Normal, false })
	end,
	fromName = function(name, weight, style)
		return makeFont({ "rbxasset://fonts/families/" .. name .. ".json", weight or Enum.FontWeight.Regular, style or Enum.FontStyle.Normal, false })
	end,
}
local makeRay = simple("Ray", { "Origin", "Direction" })
_G.Ray = {
	new = function(o, d)
		return makeRay({ o, d })
	end,
}

local BCmt = { __type = "BrickColor" }
BCmt.__index = function(_, k)
	error(tostring(k) .. " is not a valid member of BrickColor", 2)
end
_G.BrickColor = {
	new = function(name)
		return setmetatable({ Name = tostring(name), Color = newC3(0.5, 0.5, 0.5), Number = 1 }, BCmt)
	end,
	random = function()
		return setmetatable({ Name = "Random", Color = newC3(0.5, 0.5, 0.5), Number = 1 }, BCmt)
	end,
}

-- RaycastParams / OverlapParams: plain property bags
local function bag(typeName, defaults)
	return {
		new = function()
			local t = table.clone(defaults)
			return setmetatable(t, {
				__type = typeName,
				__index = function(_, k)
					error(tostring(k) .. " is not a valid member of " .. typeName, 2)
				end,
			})
		end,
	}
end
_G.RaycastParams = bag("RaycastParams", { FilterDescendantsInstances = {}, IgnoreWater = false, CollisionGroup = "Default", RespectCanCollide = false })
_G.OverlapParams = bag("OverlapParams", { FilterDescendantsInstances = {}, MaxParts = 0, CollisionGroup = "Default", RespectCanCollide = false })

---------------------------------------------------------------------------
-- Random
---------------------------------------------------------------------------
local Rnd = {}
local Rndmt = { __type = "Random", __index = Rnd }
local function step(r)
	-- xorshift32
	local x = r.s
	x = bit32.bxor(x, bit32.lshift(x, 13))
	x = bit32.bxor(x, bit32.rshift(x, 17))
	x = bit32.bxor(x, bit32.lshift(x, 5))
	r.s = x
	return x / 4294967296
end
function Rnd.NextNumber(r, a, b)
	a = a or 0
	b = b or 1
	return a + (b - a) * step(r)
end
function Rnd.NextInteger(r, a, b)
	assert(rawtype(a) == "number" and rawtype(b) == "number", "NextInteger expects two numbers")
	return a + math.floor((b - a + 1) * step(r))
end
function Rnd.NextUnitVector(r)
	local z = Rnd.NextNumber(r, -1, 1)
	local a = Rnd.NextNumber(r, 0, math.pi * 2)
	local s = math.sqrt(1 - z * z)
	return newV3(s * math.cos(a), s * math.sin(a), z)
end
function Rnd.Shuffle(r, t)
	for i = #t, 2, -1 do
		local j = Rnd.NextInteger(r, 1, i)
		t[i], t[j] = t[j], t[i]
	end
end
function Rnd.Clone(r)
	return setmetatable({ s = r.s }, Rndmt)
end
_G.Random = {
	new = function(seed)
		local s = math.floor(math.abs(seed or 12345)) % 4294967295
		if s == 0 then
			s = 2463534242
		end
		return setmetatable({ s = s }, Rndmt)
	end,
}

-- DateTime (minimal)
_G.DateTime = {
	now = function()
		return setmetatable({ UnixTimestamp = os.time(), UnixTimestampMillis = os.time() * 1000 }, { __type = "DateTime" })
	end,
}

return M
