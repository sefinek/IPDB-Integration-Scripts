const { SERVER_ID } = require('../config.js').MAIN;

const LEVELS = {
	0: { method: 'log', label: '[i]', color: '\x1b[38;5;38m', hex: 0x00AEEF },
	1: { method: 'log', label: '[✓]', color: '\x1b[38;5;77m', hex: 0x3CB371 },
	2: { method: 'warn', label: '[!]', color: '\x1b[38;5;208m', hex: 0xFF8C00 },
	3: { method: 'error', label: '[X]', color: '\x1b[38;5;160m', hex: 0xD32F2F },
};

const RESET = '\x1b[0m';
const isDev = SERVER_ID === 'development';

class Logger {
	static print(msg, level) {
		const { method, label, color } = LEVELS[level] || LEVELS[0];
		console[method](isDev ? `${color}${label} ${msg}${RESET}` : `${label} ${msg}`);
	}

	static async webhook(msg, level) {
		const { hex } = LEVELS[level] || LEVELS[0];
		await require('./services/discordWebhooks.js')(msg, hex);
	}

	static log(msg, level = 0, forceDiscord = false) {
		this.print(msg, level);
		if (forceDiscord || level >= 2) void this.webhook(msg, level);
	}
}

module.exports = Logger;
