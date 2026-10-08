-- Benton Diesel World - client entry point.
-- Starts the Benton App UI, ride animation, queue lines, shows, ambience
-- and guidance once the server has built the park.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("BentonShared")
local Net = require(Shared.Net)
local Clock = require(Shared.Clock)

local App = require(script.App)
local Guide = require(script.Guide)
local RideAnimator = require(script.RideAnimator)
local ShowPlayer = require(script.ShowPlayer)
local Ambience = require(script.Ambience)
local QueueView = require(script.QueueView)
local SoundPlayer = require(script.SoundPlayer)

local state = Net.state()
while not state:GetAttribute("ParkReady") do
	state:GetAttributeChangedSignal("ParkReady"):Wait()
end
local epoch = state:GetAttribute("ClockEpoch")
if type(epoch) == "number" then
	Clock.setEpoch(epoch)
end

local root = workspace:WaitForChild("BentonDieselWorld")

local function safe(name: string, fn: () -> ())
	local ok, err = pcall(fn)
	if not ok then
		warn("[BentonDieselWorld] " .. name .. " failed to start: " .. tostring(err))
	end
end

safe("App", App.start)
safe("Guide", Guide.start)
safe("Ambience", function()
	Ambience.start(root)
end)
safe("Shows", ShowPlayer.start)
task.spawn(function()
	safe("Sounds", function()
		SoundPlayer.start(root)
	end)
end)
task.spawn(function()
	safe("Queues", QueueView.start)
end)
task.spawn(function()
	safe("Rides", function()
		RideAnimator.start(root)
	end)
end)
