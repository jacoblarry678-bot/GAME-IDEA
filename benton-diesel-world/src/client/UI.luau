-- Tiny UI toolkit + the Benton App look (navy panels, orange accents).

local SoundPlayer = require(script.Parent.SoundPlayer)

local UI = {}

UI.Colors = {
	Navy = Color3.fromRGB(18, 26, 44),
	Panel = Color3.fromRGB(26, 36, 60),
	Card = Color3.fromRGB(36, 48, 78),
	CardHover = Color3.fromRGB(48, 62, 98),
	Orange = Color3.fromRGB(255, 140, 26),
	Gold = Color3.fromRGB(240, 196, 64),
	Cream = Color3.fromRGB(250, 243, 224),
	Muted = Color3.fromRGB(160, 172, 196),
	Green = Color3.fromRGB(90, 220, 110),
	Yellow = Color3.fromRGB(250, 210, 60),
	Red = Color3.fromRGB(240, 70, 60),
	Blue = Color3.fromRGB(60, 140, 240),
}

UI.Fonts = {
	Black = Font.fromEnum(Enum.Font.GothamBlack),
	Bold = Font.fromEnum(Enum.Font.GothamBold),
	Medium = Font.fromEnum(Enum.Font.GothamMedium),
	Regular = Font.fromEnum(Enum.Font.Gotham),
}

-- Create an instance, set properties, and parent children.
function UI.make(className: string, props: { [string]: any }?, children: { Instance }?): any
	local inst = Instance.new(className :: any) :: any
	if props then
		local parent = nil
		for k, v in props do
			if k == "Parent" then
				parent = v
			else
				inst[k] = v
			end
		end
		if children then
			for _, c in children do
				c.Parent = inst
			end
		end
		if parent then
			inst.Parent = parent
		end
	elseif children then
		for _, c in children do
			c.Parent = inst
		end
	end
	return inst
end

function UI.corner(radius: number?): UICorner
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 10)
	return c
end

function UI.stroke(color: Color3?, thickness: number?, transparency: number?): UIStroke
	local s = Instance.new("UIStroke")
	s.Color = color or Color3.new(1, 1, 1)
	s.Thickness = thickness or 1
	s.Transparency = transparency or 0.75
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	return s
end

function UI.padding(all: number, top: number?): UIPadding
	local p = Instance.new("UIPadding")
	p.PaddingLeft = UDim.new(0, all)
	p.PaddingRight = UDim.new(0, all)
	p.PaddingTop = UDim.new(0, top or all)
	p.PaddingBottom = UDim.new(0, top or all)
	return p
end

function UI.list(padding: number?, horizontal: boolean?, align: Enum.HorizontalAlignment?): UIListLayout
	local l = Instance.new("UIListLayout")
	l.Padding = UDim.new(0, padding or 6)
	l.SortOrder = Enum.SortOrder.LayoutOrder
	l.FillDirection = if horizontal then Enum.FillDirection.Horizontal else Enum.FillDirection.Vertical
	if align then
		l.HorizontalAlignment = align
	end
	if horizontal then
		l.VerticalAlignment = Enum.VerticalAlignment.Center
	end
	return l
end

function UI.label(text: string, size: number, color: Color3?, font: Font?, props: { [string]: any }?): TextLabel
	local l = UI.make("TextLabel", {
		BackgroundTransparency = 1,
		Text = text,
		TextSize = size,
		TextColor3 = color or UI.Colors.Cream,
		FontFace = font or UI.Fonts.Bold,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextWrapped = true,
		AutomaticSize = Enum.AutomaticSize.Y,
		Size = UDim2.new(1, 0, 0, size + 4),
	})
	if props then
		for k, v in props do
			(l :: any)[k] = v
		end
	end
	return l
end

function UI.button(text: string, color: Color3?, onClick: () -> (), props: { [string]: any }?): TextButton
	local b = UI.make("TextButton", {
		Text = text,
		TextSize = 15,
		TextColor3 = UI.Colors.Navy,
		FontFace = UI.Fonts.Black,
		BackgroundColor3 = color or UI.Colors.Orange,
		AutoButtonColor = true,
		Size = UDim2.new(0, 96, 0, 32),
	}, { UI.corner(8) })
	b.Activated:Connect(function()
		SoundPlayer.cue("Click", 0.35)
	end)
	if props then
		for k, v in props do
			(b :: any)[k] = v
		end
	end
	b.Activated:Connect(onClick)
	return b
end

function UI.card(props: { [string]: any }?): Frame
	local f = UI.make("Frame", {
		BackgroundColor3 = UI.Colors.Card,
		BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
	}, { UI.corner(10), UI.padding(10) })
	if props then
		for k, v in props do
			(f :: any)[k] = v
		end
	end
	return f
end

function UI.waitColor(minutes: number): Color3
	if minutes < 0 then
		return UI.Colors.Red
	elseif minutes <= 15 then
		return UI.Colors.Green
	elseif minutes <= 30 then
		return UI.Colors.Yellow
	elseif minutes <= 45 then
		return UI.Colors.Orange
	end
	return UI.Colors.Red
end

function UI.stars(n: number): string
	return string.rep("★", n) .. string.rep("☆", 5 - n)
end

return UI
