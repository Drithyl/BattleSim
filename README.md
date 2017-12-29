# BattleSim
A Discord bot that creates a custom Dominions 5 mod file with spells to summon provided armies for easy battle testing.

USE:

A user of the guild can PM the bot with the command %sim. This will start the assistant.

It will first ask for the ids and amounts of commanders for the first army. The format is "ID xAmount, ID2 xAmount, ID3 xAmount", etc. Example: "5 x10, 54 x2, 87 x1".

It will then ask for the ids and amounts of units for the first army. The format is the same as above. If commander ids are used, these will be summoned as units.

Finally, it will ask whether a new army is required. If yes, the prompt will start again. If not, it will send the user the mod file, who will then have to move it to Dominions 5's mod path (usually located at C:/Users/Username/AppData/Roaming/Dominions5/mods).


DIRECTORY STRUCTURE

Node.js has to be installed one directory upwards from where all the files sit. This can of course be changed by altering the path of all the 'require' statements in each of the .js files. The root path of those statements is the MrClockwork.js file.
