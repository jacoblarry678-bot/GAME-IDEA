-- Builds the whole park into Workspace.BentonDieselWorld.

local Kit = require(script.Parent.Kit)
local Ground = require(script.Parent.Ground)
local Plaza = require(script.Parent.Plaza)
local Venues = require(script.Parent.Venues)
local RideBuilder = require(script.Parent.RideBuilder)
local Lands = require(script.Parent.Lands)

local ParkBuilder = {}

export type Built = {
	root: Model,
	rides: { [string]: RideBuilder.RideInfo },
	venues: { [string]: Venues.VenueInfo },
	boards: { Part },
}

function ParkBuilder.build(): Built
	local old = workspace:FindFirstChild("BentonDieselWorld")
	if old then
		old:Destroy()
	end
	local baseplate = workspace:FindFirstChild("Baseplate")
	if baseplate then
		baseplate:Destroy()
	end
	local root = Instance.new("Model")
	root.Name = "BentonDieselWorld"
	-- build off-world, then parent once (much faster replication)
	Ground.build(root)
	local boards = Plaza.build(root)
	local venues = Venues.build(root)
	local rides = RideBuilder.build(root)
	Lands.build(root)
	root.Parent = workspace
	local _ = Kit
	return { root = root, rides = rides, venues = venues, boards = boards }
end

return ParkBuilder
