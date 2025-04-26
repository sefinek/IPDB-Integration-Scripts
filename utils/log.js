const { SERVER_ID } = require('../../config.js').MAIN;
const sendWebhook = require('../services/discordWebhooks.js');

const LEVELS = {
	0: { method: 'info', label: '[i]', color: '\x1b[36m' }, // Cyan
	1: { method: 'log', label: '[✓]', color: '\x1b[32m' }, // Green
	2: { method: 'warn', label: '[!]', color: '\x1b[33m' }, // Yellow
	3: { method: 'error', label: '[X]', color: '\x1b[31m' }, // Red
};

const RESET = '\x1b[0m';
const isDev = SERVER_ID === 'development';

module.exports = (msg, type = 0, discord = false) => {
	const { method, label, color } = LEVELS[type] || LEVELS[0];
	const output = isDev ? `${color}${label} ${msg}${RESET}` : `${label} ${msg}`;
	console[method](output);

	if (discord || type > 1) sendWebhook(type, msg).catch(console.error);
};