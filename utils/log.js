const sendWebhook = require('../services/discordWebhooks.js');

const levels = {
	0: { method: 'log', label: '[INFO]' },
	1: { method: 'warn', label: '[WARN]' },
	2: { method: 'error', label: '[FAIL]' },
};

module.exports = (level, msg, discord = 0) => {
	const { method, label } = levels[level] || { method: 'log', label: '[N/A]' };
	console[method](`${label} ${msg}`);

	if (discord) sendWebhook(level, msg).catch(console.error);
};