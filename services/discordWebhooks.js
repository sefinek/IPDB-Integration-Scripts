const { axiosWebhook } = require('./axios.js');
const { version, repoSlug } = require('../repo.js');
const logger = require('../logger.js');
const { SERVER_ID, DISCORD_WEBHOOK_ENABLED, DISCORD_WEBHOOK_URL, DISCORD_WEBHOOK_USERNAME, DISCORD_USER_ID } = require('../../config.js').MAIN;
const username = DISCORD_WEBHOOK_USERNAME === 'SERVER_ID' ? SERVER_ID : DISCORD_WEBHOOK_USERNAME || null;

module.exports = async (msg, hex, pingUser = false) => {
	if (!msg || !DISCORD_WEBHOOK_ENABLED || !DISCORD_WEBHOOK_URL || SERVER_ID === 'development') return;

	try {
		const res = await axiosWebhook.post(DISCORD_WEBHOOK_URL, {
			username,
			content: (pingUser && DISCORD_USER_ID) ? `<@${DISCORD_USER_ID}>` : undefined,
			embeds: [{
				description: msg
					.replace(/(\b\w+=)/g, '**$1**')
					.replace(/'/g, '`')
					.trim(),
				color: hex ?? 0x008FD1,
				footer: {
					text: `${SERVER_ID ? `${SERVER_ID} • ` : ''}${repoSlug} [v${version}]`,
				},
				timestamp: new Date().toISOString(),
			}],
		});

		if (res.status !== 204) {
			logger.log(`Failed to deliver Discord Webhook (unexpected status code: ${res.status})`, 2);
		}
	} catch (err) {
		logger.log(`Discord Webhook Error: ${err.message}`, 3);
	}
};