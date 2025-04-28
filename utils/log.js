const { SERVER_ID } = require('../../config.js').MAIN;
const sendWebhook = require('../services/discordWebhooks.js');

const LEVELS = {
	0: { method: 'info', label: '[i]', color: '\x1b[36m', hex: 0x00CED1 }, // Cyan
	1: { method: 'log', label: '[✓]', color: '\x1b[32m', hex: 0x59D267 }, // Green
	2: { method: 'warn', label: '[!]', color: '\x1b[33m', hex: 0xFFD700 }, // Yellow
	3: { method: 'error', label: '[X]', color: '\x1b[31m', hex: 0xFF0F31 }, // Red
};
const RESET = '\x1b[0m';
const IS_DEV = SERVER_ID === 'development';

module.exports = (msg, type = 0, discord = false) => {
	if (typeof msg === 'string' && (msg.includes('Ignoring local IP address') || msg.includes('Ignoring own IP address'))) type = 0;

	const { method, label, color, hex } = LEVELS[type] || LEVELS[0];
	const output = IS_DEV ? `${color}${label} ${msg}${RESET}` : `${label} ${msg}`;
	console[method](output);

	if (discord || type > 1) sendWebhook(msg, hex).catch(console.error);
};