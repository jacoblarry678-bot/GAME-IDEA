-- Park clock shared by server and clients.
--
-- During park hours one real second is one park minute, so a posted
-- "25 min" wait really is about 25 seconds of play. The quiet night hours
-- run four times faster so players are not stuck in the dark for long.
--
-- Everything is derived from workspace:GetServerTimeNow(), which Roblox keeps
-- in sync between the server and every client, plus an epoch the server
-- publishes once at startup (an attribute on ReplicatedStorage.BentonState).

local Clock = {}

Clock.DAY_START = 8 * 60 -- 8:00 AM, minutes after midnight
Clock.DAY_END = 23 * 60 -- 11:00 PM
Clock.NIGHT_SPEED = 4 -- park minutes per real second at night
Clock.OPEN = 9 * 60
Clock.CLOSE = 22 * 60

local DAY_SECONDS = Clock.DAY_END - Clock.DAY_START -- 900 real seconds
local NIGHT_MINUTES = 24 * 60 - DAY_SECONDS -- 540 park minutes
local NIGHT_SECONDS = NIGHT_MINUTES / Clock.NIGHT_SPEED -- 135 real seconds
Clock.CYCLE_SECONDS = DAY_SECONDS + NIGHT_SECONDS

local epoch: number? = nil

function Clock.setEpoch(value: number)
	epoch = value
end

local function getEpoch(): number
	if epoch then
		return epoch
	end
	local state = game:GetService("ReplicatedStorage"):FindFirstChild("BentonState")
	local value = state and state:GetAttribute("ClockEpoch")
	if type(value) == "number" then
		epoch = value
		return value
	end
	return 0
end

function Clock.now(): number
	return workspace:GetServerTimeNow()
end

-- Park minutes after midnight (0 - 1440) for a given server time.
function Clock.minutesAt(serverTime: number): number
	local u = (serverTime - getEpoch()) % Clock.CYCLE_SECONDS
	if u < DAY_SECONDS then
		return Clock.DAY_START + u
	end
	return (Clock.DAY_END + (u - DAY_SECONDS) * Clock.NIGHT_SPEED) % 1440
end

function Clock.minutes(): number
	return Clock.minutesAt(Clock.now())
end

-- Real seconds from `serverTime` until the park clock next reads `minute`.
function Clock.secondsUntil(minute: number, serverTime: number?): number
	local t = serverTime or Clock.now()
	local u = (t - getEpoch()) % Clock.CYCLE_SECONDS
	local target: number
	if minute >= Clock.DAY_START and minute < Clock.DAY_END then
		target = minute - Clock.DAY_START
	else
		local m = minute
		if m < Clock.DAY_START then
			m += 1440
		end
		target = DAY_SECONDS + (m - Clock.DAY_END) / Clock.NIGHT_SPEED
	end
	local d = target - u
	if d < 0 then
		d += Clock.CYCLE_SECONDS
	end
	return d
end

function Clock.format(minute: number): string
	local m = math.floor(minute) % 1440
	local h = m // 60
	local mm = m % 60
	local suffix = if h >= 12 then "PM" else "AM"
	local h12 = h % 12
	if h12 == 0 then
		h12 = 12
	end
	return string.format("%d:%02d %s", h12, mm, suffix)
end

function Clock.isOpen(minute: number): boolean
	return minute >= Clock.OPEN and minute < Clock.CLOSE
end

-- How busy the park is (0 - 1.15) at a given park minute. Shapes the
-- simulated crowd: a morning rush, a packed afternoon, a calmer evening.
function Clock.crowd(minute: number): number
	local h = minute / 60
	if h < 8 or h >= 23 then
		return 0.08
	end
	local base
	if h < 9 then
		base = 0.15 + (h - 8) * 0.25
	elseif h < 12 then
		base = 0.4 + (h - 9) / 3 * 0.55
	elseif h < 17 then
		base = 0.95 + math.sin((h - 12) / 5 * math.pi) * 0.2
	elseif h < 21 then
		base = 0.95 - (h - 17) / 4 * 0.35
	else
		base = 0.6 - (h - 21) / 2 * 0.45
	end
	return base
end

-- Sun position for Lighting.ClockTime (hours).
function Clock.clockTime(minute: number): number
	return minute / 60
end

return Clock
