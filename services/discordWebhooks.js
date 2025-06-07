const { webhook } = require('./axios.js');
const { version, repoSlug } = require('../repo.js');
const { SERVER_ID, DISCORD_WEBHOOK_ENABLED, DISCORD_WEBHOOK_URL, DISCORD_WEBHOOK_USERNAME } = require('../../config.js').MAIN;
const username = DISCORD_WEBHOOK_USERNAME === 'SERVER_ID' ? SERVER_ID : DISCORD_WEBHOOK_USERNAME || null;

module.exports = async (msg, hex) => {

	try {
		const res = await webhook.post(DISCORD_WEBHOOK_URL, {
			username,
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

		if (res.status !== 204) console.warn(`[X] Failed to deliver Discord Webhook (unexpected status code: ${res.status})`);
	} catch (err) {
		console.error('[X] Discord Webhook Error:', err.stack);
	}
};