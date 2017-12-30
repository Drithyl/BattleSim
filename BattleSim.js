
//Dependencies
const Discord = require('discord.js');
const fs = require('fs');
const mail = require('mail.js');
const config = require("../BattleSim/config.json");
const modConfig = require("../BattleSim/modConfig.json");
const settings = require("../BattleSim/inputSettings.json");
const rw = require("../BattleSim/reader_writer.js");

//The Bot
const bot = new Discord.Client();

var owner;
var myGuild;
var instances = {};
var unitList = {};

var checks =
{
	"commanders": validateCommanders,
	"units": validateUnits,
	"newArmy": validateNewArmy
};

//Will switch to true when the on.ready event first triggers so that certain bits of code don't get re-executed when the bot reconnects and goes through on.ready again
var wasInitialized = false;
var didNotReconnect = false;

//Stuff starts to happen after the 'ready' event is sent, so code is put here. Kinda like a constructor or main function.
bot.on("ready", () =>
{
	rw.log("I am ready!");
	didNotReconnect = false;
	owner = bot.users.get(config.ownerID);
	myGuild = bot.guilds.get(config.myGuildID);

	if (owner == null)
	{
		rw.log("Something went wrong; cannot find the owner of the guild.");
		return;
	}

	if (myGuild == null)
	{
		rw.log("Something went wrong; cannot find myGuild.");
		return;
	}

	owner.send("I am ready!");

	if (wasInitialized == false)
	{
		initialize();
	}
});

//On messages sent to channels
bot.on('message', message =>
{
	//Convert them all to uppercase to ignore capitals or lowercases
	var input = message.content;
	var username = message.author.username;
	var member = myGuild.members.get(message.author.id);

	if (message.author.bot === true)
	{
		return;
	}

	if (member == null)
	{
		rw.log("Could not find the GuildMember object of user " + username + ". His input was '" + input + "' in channel " + message.channel.name + ".");
	}

	if (/^\%SIM$/i.test(input))
	{
		if (member == null)
		{
			message.reply("Sorry, you do not have enough permissions to host a game. Somehow you do not show up as a member of this Guild.");
			return;
		}

		if (instances[username] != null)
		{
			message.reply("You already have a Simulator Assistant instance running. To cancel it, type `%cancel`.");
			return;
		}

		message.reply(startInstance(message.author));
	}

	else if (instances[username] != null)
	{
		if (/^\%CANCEL$/i.test(input))
		{
			delete instances[username];
			message.reply("The Simulator Assistant has been cancelled. You can start anew anytime by using the `%sim` command.");
			return;
		}

		else 	//this must be input for the assisted hosting, so validate it
		{
			message.author.send(validateInput(message.content, member));
		}
	}
});

function initialize()
{
	unitList = parseNames();
}

function startInstance(userObj)
{
	var username = userObj.username;
	instances[username] = {user: userObj, keys: settings.keys.slice(), currKey: "", armiesList: [{}], currArmy: 0};
	instances[username].currKey = instances[username].keys.shift();
	return config.startMessage + settings.cues[instances[username].currKey];
}

function validateInput(input, member)
{
	var result;
	var username = member.user.username;
	var currKey = instances[username].currKey;

	if (instances[username] == null)
	{
		return "Something went wrong. Cannot find your Assisted Hosting instance. Please type `%cancel` and start again.";
	}

	result = checks[currKey](input, username);

	if (result.success === true)
	{
		rw.log("Input '" + input + "' from user " + username + " validated.");

		if (!instances[username].keys.length)
		{
			var mod;
			var spells = [];
			var spellNbr = instances[username].armiesList.length;

			for (var i = 0; i < spellNbr; i++)
			{
				spells.push(createSpell("Summon Army " + (i+1), instances[username].armiesList[i]));
			}

			fs.writeFileSync(modConfig.name.toLowerCase() + ".dm", createMod(spells));
			member.user.send({files: [{attachment: modConfig.name.toLowerCase() + ".dm", name: modConfig.name.toLowerCase() + ".dm"}]});
			return config.modMessage;
		}

		else
		{
			instances[username].currKey = instances[username].keys.shift();
			rw.log("Sending next cue: " + settings.cues[instances[username].currKey]);
			return settings.cues[instances[username].currKey];
		}
	}

	else
	{
		rw.log("Input '" + input + "' from user " + username + " was not correct.");
		return result.data;
	}
}

function parseCommanders(data)
{
	var inputs = data.split(",");
	var commanders = [];

	for (var i = 0; i < inputs.length; i++)
	{
		var id = inputs[i].replace(/x\d+/ig, "").trim().toLowerCase();
		var nbr = +inputs[i].match(/x\d+/ig)[0].replace(/x/g, "");

		if (/\d/.test(id) === false)
		{
			id = unitList[id];
		}

		if (id == null || unitList[id] == null)
		{
			rw.log("The id " + id + " does not exist.");
			return null;
		}

		if (isNaN(+id) === true || isNaN(nbr) === true)
		{
			return null;
		}

		for (var j = 0; j < nbr; j++)
		{


			commanders.push({"id": id, "amount": 1});
		}
	}

	return commanders;
}

function parseUnits(data)
{
	var inputs = data.split(",");
	var units = [];

	for (var i = 0; i < inputs.length; i++)
	{
		var id = inputs[i].replace(/x\d+/ig, "").trim().toLowerCase();
		var nbr = +inputs[i].match(/x\d+/ig)[0].replace(/x/g, "");

		if (/\d/.test(id) === false)
		{
			id = unitList[id];
		}

		if (id == null || unitList[id] == null)
		{
			rw.log("The id " + id + " does not exist.");
			return null;
		}

		if (isNaN(+id) === true || isNaN(nbr) === true)
		{
			return null;
		}

		units.push({"id": id, "amount": nbr});
	}

	return units;
}

function validateCommanders(input, username)
{
	var result = {success: false, data: input};
	var commanders;

	if (/x\d/.test(input) === false || /\d|\w/.test(input) === false)
	{
		rw.log("Commanders' input was incorrect: " + input + ". ");
		result.data = "The input must be formated like so, any number of times: `<ID/name> x<Amount>`. For example, `5 x10, 54 x2, 87 x1`.";
		return result;
	}

	commanders = parseCommanders(input);

	if (commanders == null)
	{
		rw.log("Commanders' input resulted in incorrect units: " + input + ".");
		result.data = "The input must contain both an ID or name and a number, as well as a comma between each set, like so: `5 x10, 54 x2, 87 x1`, or so `demonbred x5, serpent lord x3`. The ID or name must also exist in the game.";
		return result;
	}

	instances[username].armiesList[instances[username].currArmy].commanders = commanders;
	result.success = true;
	return result;
}

function validateUnits(input, username)
{
	var result = {success: false, data: input};
	var units;

	if (/x\d/.test(input) === false || /\d|\w/.test(input) === false)
	{
		rw.log("Units' input was incorrect: " + input + ". ");
		result.data = "The input must be formated like so, any number of times: `<ID/name> x<Amount>`. For example, `1 x50, 18 x50`.";
		return result;
	}

	units = parseUnits(input);

	if (units == null)
	{
		rw.log("Units' input resulted in incorrect units: " + input + ".");
		result.data = "The input must contain both an ID and a number, as well as a comma between each set, like so: `1 x50, 18 x50`, or so `hoplite x5, slinger x3`. The ID or name must also exist in the game.";
		return result;
	}

	instances[username].armiesList[instances[username].currArmy].units = units;
	result.success = true;
	return result;
}

function validateNewArmy(input, username)
{
	var result = {success: false, data: input};

	if (/(yes|no)/i.test(input) === false)
	{
		rw.log("New Army input was incorrect: " + input + ". ");
		result.data = "If you would like to create another spell to summon another army for testing, type 'yes'. Otherwise, type 'no'.";
		return result;
	}

	if (/yes/i.test(input) === true)
	{
		instances[username].armiesList.push([{}]);
		instances[username].currArmy++;
		instances[username].keys = settings.keys.slice();	//restarts the key sequence
		instances[username].currKey = "";
	}

	result.success = true;
	return result;
}

function createMod(spells)
{
	var modStr = '#modname ' + modConfig.name + '\n';
	modStr += '#description ' + modConfig.description + '\n';
	modStr += '#version ' + modConfig.version + '\n';
	modStr += '#domversion ' + modConfig.domversion + '\n\n\n----------\n\n';
	//modStr += '#icon ' + modConfig.iconPath + '\n\n\n';

	for (var i = 0; i < spells.length; i++)
	{
		modStr += spells[i];
	}

	return modStr;
}

function createSpell(name, army)
{
	var spellSize = army.commanders.length + army.units.length;
	var jointArmy = army.commanders.concat(army.units);
	var modStr = '#newspell\n#name "' + name + '"\n#end\n\n';

	for (var i = 1; i < spellSize; i++)
	{
		modStr += '#newspell\n#name "' + name + ' Spell Effect ' + i + '"\n#end\n\n';
	}

	modStr += '#selectspell "' + name + '"\n#school 0\n#path 0 ' + modConfig.mainSpellPath + '\n#pathlevel 0 1\n#fatiguecost 10\n#researchlevel 0\n';
	modStr += '#effect 10021\n';
	modStr += '#damage ' + jointArmy[0].id + '\n';
	modStr += '#nreff ' + jointArmy[0].amount + '\n';
	modStr += '#descr "' + modConfig.spellDescription + '"\n';

	if (spellSize > 1)
	{
		modStr += '#nextspell "' + name + ' Spell Effect 1' + '"\n';
	}

	modStr += '#end\n\n';

	for (i = 1; i < jointArmy.length; i++)
	{
		modStr += '\n\n#selectspell "' + name + ' Spell Effect ' + (i) + '"\n#path 0 8\n#pathlevel 0 1\n#fatiguecost 10\n#researchlevel 0\n';

		if (i < army.commanders.length)
		{
			modStr += '#effect 10021\n';
		}

		else modStr += '#effect 10001\n';

		modStr += '#damage ' + jointArmy[i].id + '\n';
		modStr += '#nreff ' + jointArmy[i].amount + '\n';
		modStr += '#descr "' + modConfig.spellDescription + '"\n';

		if (i < jointArmy.length - 1)
		{
			modStr += '#nextspell "' + name + ' Spell Effect ' + (i+1) + '"\n';
		}

		modStr += '#end\n\n';
	}

	return modStr;
}

function parseNames()
{
	if (fs.existsSync("units.txt") === false)
	{
		rw.log("Missing the units.txt file that contains the IDs and names necessary for input validation.");
		return null;
	}

	var data = fs.readFileSync("units.txt", "utf8");
	var lines = data.split("\n");
	var obj = {};

	for (var i = 0; i < lines.length; i++)
	{
		var name = lines[i].replace(/\d/g, "").trim().toLowerCase();
		var id = lines[i].replace(/\D/g, "").trim();
		obj[id] = name;
		obj[name] = id;
	}

	return obj;
}

function reconnect(token)
{
	if (didNotReconnect == true)
	{
		bot.login(token);
		rw.log("Manual attempt to reconnect...");
	}
}

//Login to the server, always goes at the end of the document, don't ask me why
bot.login(config.token);

bot.on("disconnect", () =>
{
	didNotReconnect = true;
	rw.log("I have been disconnected!");
	setTimeout (reconnect.bind(null, config.token), reconnectInterval);

	if (owner)
	{
		owner.send("I have been disconnected!");
	}
});

bot.on("reconnecting", () =>
{
	rw.log("Trying to reconnect...");

	if (owner)
	{
		//owner.send("Trying to reconnect...");
	}
});

bot.on("debug", info =>
{
	//rw.log("DEBUG: " + info);
});

bot.on("warn", warning =>
{
	rw.log("WARN: " + warning);
});

bot.on("error", () =>
{
	rw.log("An error occurred. This is from the 'on.error' event.");

	if (owner)
	{
		owner.send("Something went wrong! I am dying D':");
	}
});

//This simple piece of code catches those pesky unhelpful errors and gives you the line number that caused it!
process.on("unhandledRejection", err =>
{
  rw.log("Uncaught Promise Error: \n" + err.stack);

	if (owner)
	{
		owner.send("Uncaught Promise Error: \n" + err.stack);
	}
});
