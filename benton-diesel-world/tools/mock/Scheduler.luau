-- Virtual-time task scheduler, signals and the `task` library for the
-- headless test harness.

local M = _G.__mock

M.now = 0 -- virtual seconds since the harness started
M.errors = {}
M.warnings = {}

local function report(kind: string, msg: string)
	if kind == "error" then
		table.insert(M.errors, msg)
	else
		table.insert(M.warnings, msg)
	end
	__hostlog(kind, msg)
end
M.report = report

-- Threads waiting on time: { thread, wake, args }
local sleeping = {}
local deferred = {}

local function resume(co: thread, ...: any)
	local ok, err = coroutine.resume(co, ...)
	if not ok then
		report("error", tostring(err) .. "\n" .. debug.traceback(co))
	end
end
M.resume = resume

local function spawnFn(fn, ...)
	local co
	if type(fn) == "thread" then
		co = fn
	else
		assert(type(fn) == "function", "task.spawn expects a function or thread")
		co = coroutine.create(fn)
	end
	resume(co, ...)
	return co
end
M.spawn = spawnFn

local cancelled = setmetatable({}, { __mode = "k" })

_G.task = {
	spawn = spawnFn,
	defer = function(fn, ...)
		local co = if type(fn) == "thread" then fn else coroutine.create(fn)
		table.insert(deferred, { co, table.pack(...) })
		return co
	end,
	delay = function(t, fn, ...)
		assert(type(t) == "number", "task.delay: duration must be a number")
		local co = if type(fn) == "thread" then fn else coroutine.create(fn)
		table.insert(sleeping, { co = co, wake = M.now + t, args = table.pack(...), plain = true })
		return co
	end,
	wait = function(t)
		t = t or 0
		local co = coroutine.running()
		local start = M.now
		table.insert(sleeping, { co = co, wake = M.now + math.max(t, 1 / 60), args = nil, start = start })
		return coroutine.yield()
	end,
	cancel = function(co)
		cancelled[co] = true
	end,
	synchronize = function() end,
	desynchronize = function() end,
}

function M.flushDeferred()
	local guard = 0
	while #deferred > 0 do
		guard += 1
		if guard > 10000 then
			report("error", "deferred thread storm")
			break
		end
		local item = table.remove(deferred, 1)
		if not cancelled[item[1]] and coroutine.status(item[1]) == "suspended" then
			resume(item[1], table.unpack(item[2], 1, item[2].n))
		end
	end
end

-- Advance virtual time by dt, waking sleepers in order.
function M.advance(dt: number)
	local target = M.now + dt
	while true do
		local nextI, nextT = nil, math.huge
		for i, s in sleeping do
			if s.wake < nextT then
				nextI, nextT = i, s.wake
			end
		end
		if not nextI or nextT > target then
			break
		end
		local s = table.remove(sleeping, nextI)
		M.now = math.max(M.now, s.wake)
		if not cancelled[s.co] and coroutine.status(s.co) == "suspended" then
			if s.plain then
				resume(s.co, table.unpack(s.args, 1, s.args.n))
			else
				resume(s.co, M.now - s.start)
			end
		end
		M.flushDeferred()
	end
	M.now = target
	M.flushDeferred()
end

function M.sleepingCount(): number
	return #sleeping
end

---------------------------------------------------------------------------
-- Signals
---------------------------------------------------------------------------
local Signal = {}
Signal.__index = Signal
Signal.__type = "RBXScriptSignal"
M.Signal = Signal

local Connection = {}
Connection.__index = Connection
Connection.__type = "RBXScriptConnection"

function Signal.new(name: string?)
	return setmetatable({ _handlers = {}, _waiting = {}, _name = name or "Signal" }, Signal)
end

function Signal.Connect(self, fn)
	assert(getmetatable(self) == Signal, "Expected ':' not '.' calling member function Connect")
	assert(type(fn) == "function", "Attempt to connect failed: Passed value is not a function")
	local conn = setmetatable({ Connected = true, _fn = fn, _signal = self }, Connection)
	table.insert(self._handlers, conn)
	return conn
end

function Signal.Once(self, fn)
	local conn
	conn = self:Connect(function(...)
		conn:Disconnect()
		fn(...)
	end)
	return conn
end

function Signal.ConnectParallel(self, fn)
	return self:Connect(fn)
end

function Signal.Wait(self)
	local co = coroutine.running()
	table.insert(self._waiting, co)
	return coroutine.yield()
end

function Signal.Fire(self, ...)
	for _, conn in table.clone(self._handlers) do
		if conn.Connected then
			local co = coroutine.create(conn._fn)
			resume(co, ...)
		end
	end
	local waiting = self._waiting
	self._waiting = {}
	for _, co in waiting do
		if coroutine.status(co) == "suspended" then
			resume(co, ...)
		end
	end
end

function Signal.DisconnectAll(self)
	for _, conn in self._handlers do
		conn.Connected = false
	end
	self._handlers = {}
end

function Connection.Disconnect(self)
	self.Connected = false
	local list = self._signal._handlers
	local i = table.find(list, self)
	if i then
		table.remove(list, i)
	end
end
Connection.disconnect = Connection.Disconnect

-- Deprecated globals some code might still call.
_G.wait = task.wait
_G.spawn = function(fn)
	task.defer(fn)
end
_G.delay = task.delay
_G.tick = function()
	return 1700000000 + M.now
end
_G.time = function()
	return M.now
end
_G.elapsedTime = _G.time
_G.warn = function(...)
	local parts = {}
	for i = 1, select("#", ...) do
		table.insert(parts, tostring((select(i, ...))))
	end
	__hostlog("warn", table.concat(parts, " "))
end
_G.print = function(...)
	local parts = {}
	for i = 1, select("#", ...) do
		table.insert(parts, tostring((select(i, ...))))
	end
	__hostlog("print", table.concat(parts, " "))
end

return M
