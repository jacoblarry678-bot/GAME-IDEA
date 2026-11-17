-- Runs the show schedule. When a show starts the server publishes its start
-- time in ReplicatedStorage.BentonState.Shows.<ShowId>; every client plays
-- the show locally in sync (see ShowPlayer). Guests watching from the
-- viewing area earn Benton Bucks.

local Players = game:GetService("Players")

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Config = require(Shared.Config)
local Clock = require(Shared.Clock)
local Net = require(Shared.Net)

local PlayerData = require(script.Parent.PlayerData)

local ShowService = {}

local function watchers(show: Config.Show): { Player }
	local out = {}
	for _, player in Players:GetPlayers() do
		local c = player.Character
		local root = c and c:FindFirstChild("HumanoidRootPart") :: BasePart?
		if root then
			local d = (root.Position - show.viewing) * Vector3.new(1, 0, 1)
			if d.Magnitude <= show.viewRadius then
				table.insert(out, player)
			end
		end
	end
	return out
end

local function run(show: Config.Show, folder: Folder)
	local start = Clock.now()
	folder:SetAttribute("Start", start)
	folder:SetAttribute("Running", true)
	for _, player in Players:GetPlayers() do
		PlayerData.notify(player, string.format("%s is starting now at %s!", show.name, show.venue), "show")
	end
	local watched: { [Player]: boolean } = {}
	-- check who is watching a few times during the show
	for _, part in { 0.35, 0.35, 0.3 } do
		task.wait(show.duration * part)
		for _, p in watchers(show) do
			watched[p] = true
		end
	end
	folder:SetAttribute("Running", false)
	for player in watched do
		if player.Parent then
			PlayerData.bumpStat(player, "Shows")
			PlayerData.addBucks(player, Config.Economy.ShowReward, "Bravo! Thanks for watching " .. show.name .. ".")
		end
	end
end

-- Start a show right away (used by the Studio test hook in init).
function ShowService.startNow(showId: string)
	local show = Config.ShowById[showId]
	local f = Net.state():WaitForChild("Shows"):FindFirstChild(showId) :: Folder?
	if show and f and not f:GetAttribute("Running") then
		task.spawn(run, show, f)
	end
end

function ShowService.start()
	local folder = Net.state():WaitForChild("Shows")
	local played: { [string]: boolean } = {}
	for _, show in Config.Shows do
		local f = folder:FindFirstChild(show.id) :: Folder?
		if not f then
			local nf = Instance.new("Folder")
			nf.Name = show.id
			nf.Parent = folder
			f = nf
		end
		(f :: Folder):SetAttribute("Start", 0);
		(f :: Folder):SetAttribute("Running", false);
		(f :: Folder):SetAttribute("Duration", show.duration)
	end
	task.spawn(function()
		while true do
			local now = Clock.now()
			local minute = Clock.minutes()
			local cycle = math.floor((now - (Net.state():GetAttribute("ClockEpoch") :: number? or 0)) / Clock.CYCLE_SECONDS)
			for _, show in Config.Shows do
				for _, t in show.times do
					local key = show.id .. ":" .. cycle .. ":" .. t
					if not played[key] and minute >= t and minute < t + 2 then
						played[key] = true
						local f = folder:FindFirstChild(show.id) :: Folder
						if not f:GetAttribute("Running") then
							task.spawn(run, show, f)
						end
					end
				end
			end
			task.wait(0.5)
		end
	end)
end

return ShowService
