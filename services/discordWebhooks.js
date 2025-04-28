const axios = require('axios');
const { version, repoFull } = require('../utils/repo.js');
const { SERVER_ID, DISCORD_WEBHOOKS_ENABLED, DISCORD_WEBHOOKS_URL, DISCORD_WEBHOOK_USERNAME } = require('../../config.js').MAIN;
const username = DISCORD_WEBHOOK_USERNAME === 'SERVER_ID' ? SERVER_ID : DISCORD_WEBHOOK_USERNAME || null;

module.exports = async (msg, color) => {
	if (!msg || !DISCORD_WEBHOOKS_ENABLED || !DISCORD_WEBHOOKS_URL) return;

	const description = msg instanceof Error ? msg.stack : msg;

	const config = {
		method: 'POST',
		url: DISCORD_WEBHOOKS_URL,
		headers: { 'Content-Type': 'application/json' },
		data: {
			username,
			embeds: [{
				description: description
					.replace(/\p{Emoji_Presentation}/gu, '')
					.replace(/(\b\w+=)/g, '**$1**')
					.replace(/'/g, '`')
					.trim(),
				color: color ?? 0x008FD1,
				footer: {
					text: `${SERVER_ID ? `${SERVER_ID} • ` : ''}${repoFull} [v${version}]`,
				},
				timestamp: new Date().toISOString(),
			}],
		},
	};

	try {
		const res = await axios(config);
		if (res.status !== 204) console.warn(`[X] Failed to deliver Discord Webhook (unexpected status code: ${res.status})`);
	} catch (err) {
		console.error('[X] Discord Webhook Error:', err.message);
	}
};