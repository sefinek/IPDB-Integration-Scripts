const { reset, IS_PM2 } = require('./banners/utils/helper.js');

const LEVELS = {
	0: { method: 'log', label: '[i]', color: '\x1b[38;5;38m', hex: 0x00AEEF },
	1: { method: 'log', label: '[✓]', color: '\x1b[38;5;77m', hex: 0x3CB371 },
	2: { method: 'warn', label: '[!]', color: '\x1b[38;5;208m', hex: 0xFF8C00 },
	3: { method: 'error', label: '[X]', color: '\x1b[38;5;160m', hex: 0xD32F2F },
};

let discordWebhooks;

class Logger {
	static print(msg, level) {
		const { method, label, color: lvlColor } = LEVELS[level] || LEVELS[0];
		console[method](IS_PM2 ? `${label} ${msg}` : `${lvlColor}${label} ${msg}${reset}`);
	}

	static async webhook(msg, level, pingUser = false) {
		const { hex } = LEVELS[level] || LEVELS[0];
		if (!discordWebhooks) discordWebhooks = require('./services/discordWebhooks.js');
		await discordWebhooks(msg, hex, pingUser);
	}

	static log(msg, level = 0, forceDiscord = false) {
		this.print(msg, level);
		if (forceDiscord || level >= 2) void this.webhook(msg, level);
	}
}

module.exports = Logger;