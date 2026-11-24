-- "Guide me" navigation: a glowing beam from the player to a destination
-- plus a floating marker with the distance.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Guide = {}

local player = Players.LocalPlayer
local target: Vector3? = nil
local targetName = ""
local marker: Part? = nil
local beam: Beam? = nil
local fromAttachment: Attachment? = nil
local distanceLabel: TextLabel? = nil
local onArrive: ((string) -> ())? = nil

function Guide.onArrive(fn: (string) -> ())
	onArrive = fn
end

function Guide.clear()
	target = nil
	if marker then
		marker:Destroy()
		marker = nil
	end
	if fromAttachment then
		fromAttachment:Destroy()
		fromAttachment = nil
	end
	beam = nil
	distanceLabel = nil
end

local function attachToCharacter()
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root or not marker then
		return
	end
	if fromAttachment then
		fromAttachment:Destroy()
	end
	local a0 = Instance.new("Attachment")
	a0.Name = "GuideFrom"
	a0.Position = Vector3.new(0, -1.5, 0)
	a0.Parent = root
	fromAttachment = a0
	local m = marker :: Part
	local b = m:FindFirstChildOfClass("Beam")
	if b then
		b.Attachment0 = a0
	end
end

function Guide.set(position: Vector3, name: string)
	Guide.clear()
	target = position
	targetName = name
	local m = Instance.new("Part")
	m.Name = "BentonGuideMarker"
	m.Anchored = true
	m.CanCollide = false
	m.CanQuery = false
	m.CanTouch = false
	m.Transparency = 1
	m.Size = Vector3.new(1, 1, 1)
	m.CFrame = CFrame.new(position + Vector3.new(0, 1, 0))
	m.Parent = workspace
	marker = m
	local a1 = Instance.new("Attachment")
	a1.Parent = m
	local b = Instance.new("Beam")
	b.Attachment1 = a1
	b.Width0 = 1.2
	b.Width1 = 1.2
	b.FaceCamera = true
	b.LightEmission = 1
	b.LightInfluence = 0
	b.Color = ColorSequence.new(Color3.fromRGB(255, 160, 40), Color3.fromRGB(255, 230, 120))
	b.Transparency = NumberSequence.new(0.2, 0.5)
	b.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	b.TextureMode = Enum.TextureMode.Wrap
	b.TextureLength = 4
	b.TextureSpeed = 2
	b.Segments = 20
	b.CurveSize0 = 0
	b.CurveSize1 = 0
	b.Parent = m
	beam = b
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(220, 56)
	gui.StudsOffset = Vector3.new(0, 8, 0)
	gui.AlwaysOnTop = true
	gui.LightInfluence = 0
	gui.Parent = m
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.TextScaled = true
	label.TextColor3 = Color3.fromRGB(255, 220, 120)
	label.FontFace = Font.fromEnum(Enum.Font.GothamBlack)
	label.Text = name
	label.Parent = gui
	local stroke = Instance.new("UIStroke")
	stroke.Thickness = 2
	stroke.Parent = label
	distanceLabel = label
	attachToCharacter()
end

function Guide.current(): (Vector3?, string)
	return target, targetName
end

function Guide.start()
	player.CharacterAdded:Connect(function()
		task.wait(0.5)
		if target then
			attachToCharacter()
		end
	end)
	RunService.Heartbeat:Connect(function()
		if not target then
			return
		end
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not root then
			return
		end
		local d = ((root.Position - target) * Vector3.new(1, 0, 1)).Magnitude
		if distanceLabel then
			distanceLabel.Text = string.format("%s\n%d studs", targetName, math.floor(d))
		end
		if d < 16 then
			local name = targetName
			Guide.clear()
			if onArrive then
				onArrive(name)
			end
		end
	end)
	local _ = beam
end

return Guide
