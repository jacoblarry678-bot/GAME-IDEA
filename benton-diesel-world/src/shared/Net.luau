-- RemoteEvents shared by the server and clients, plus the replicated state
-- folder (ReplicatedStorage.BentonState) that holds ride and show status.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Net = {}

Net.Names = {
	"Notify", -- server -> client: toast { text, kind, amount? }
	"Profile", -- server -> client: full profile snapshot
	"OpenVenue", -- server -> client: venue id (shop / restaurant prompt)
	"Action", -- client -> server: { type = "...", ... }
}

-- Server: create the remotes and state folders.
function Net.setup(): Folder
	local remotes = ReplicatedStorage:FindFirstChild("BentonRemotes")
	if not remotes then
		local f = Instance.new("Folder")
		f.Name = "BentonRemotes"
		f.Parent = ReplicatedStorage
		remotes = f
	end
	for _, name in Net.Names do
		if not (remotes :: Folder):FindFirstChild(name) then
			local r = Instance.new("RemoteEvent")
			r.Name = name
			r.Parent = remotes
		end
	end
	local state = ReplicatedStorage:FindFirstChild("BentonState")
	if not state then
		local f = Instance.new("Folder")
		f.Name = "BentonState"
		f.Parent = ReplicatedStorage
		state = f
	end
	for _, name in { "Rides", "Shows" } do
		if not (state :: Folder):FindFirstChild(name) then
			local f = Instance.new("Folder")
			f.Name = name
			f.Parent = state
		end
	end
	return state :: Folder
end

function Net.remote(name: string): RemoteEvent
	local remotes = ReplicatedStorage:WaitForChild("BentonRemotes")
	return remotes:WaitForChild(name) :: RemoteEvent
end

function Net.state(): Folder
	return ReplicatedStorage:WaitForChild("BentonState") :: Folder
end

return Net
