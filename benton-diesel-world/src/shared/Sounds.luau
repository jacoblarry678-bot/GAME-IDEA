--!strict
-- Sounds for the Roblox version.
--
-- Roblox plays audio from asset ids. The rbxasset:// sounds below ship with
-- every Roblox client, so they always work. The empty slots are for music
-- and ride sounds: paste the id of an audio asset you own, or a public one
-- from the Creator Store (Audio), as "rbxassetid://123456" and it plays in
-- that spot. Empty slots stay silent. (The browser edition synthesizes all
-- of its own music and sounds and doesn't use this file.)

local Sounds = {}

-- Background music for each land; crossfades as you walk between lands.
Sounds.Music = {
	Plaza = "", -- a sunny Main Street rag
	Diesel = "", -- garage blues / rock
	Haulers = "", -- playful toy-box tune
	Backwoods = "", -- bluegrass banjo
	Studios = "", -- big-band swing
	Velocity = "", -- synthwave / racing
	Family = "", -- gentle lakeside waltz
} :: { [string]: string }
Sounds.MusicVolume = 0.3

-- Music played at the show venue while each show runs.
Sounds.Shows = {
	BigDreams = "",
	StuntSpectacular = "",
	BigRigParade = "",
	BentonNights = "",
} :: { [string]: string }

-- Looped on the lead vehicle while a ride runs, by ride kind.
Sounds.Rides = {
	coaster = "",
	flume = "",
	train = "",
	tram = "",
	trucks = "",
	karts = "",
	droptower = "",
	carousel = "", -- band organ music
	spinner = "",
	pendulum = "",
} :: { [string]: string }

-- Riders screaming on big drops.
Sounds.Screams = ""

-- Short cues (built into the Roblox client).
Sounds.Cues = {
	Click = "rbxasset://sounds/clickfast.wav",
	Info = "rbxasset://sounds/electronicpingshort.wav",
	Reward = "rbxasset://sounds/electronicpingshort.wav",
	Warn = "rbxasset://sounds/clickfast.wav",
	Splash = "rbxasset://sounds/impact_water.mp3",
	Launch = "rbxasset://sounds/Rocket whoosh 01.wav",
	Whoosh = "rbxasset://sounds/swoosh.wav",
} :: { [string]: string }

return Sounds
