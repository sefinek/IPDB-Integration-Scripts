const axios = require('axios');
const { version, authorAndName } = require('../repo.js');
const { SERVER_ID, DISCORD_WEBHOOKS_ENABLED, DISCORD_WEBHOOKS_URL, DISCORD_WEBHOOK_USERNAME } = require('../../config.js').MAIN;
const username = DISCORD_WEBHOOK_USERNAME === 'SERVER_ID' ? SERVER_ID : DISCORD_WEBHOOK_USERNAME || null;

module.exports = async (msg, hex) => {
	if (!msg || !DISCORD_WEBHOOKS_ENABLED || !DISCORD_WEBHOOKS_URL) return;

	const config = {
		method: 'POST',
		url: DISCORD_WEBHOOKS_URL,
		headers: { 'Content-Type': 'application/json' },
		data: {
			username,
			embeds: [{
				description: msg
					.replace(/\p{Emoji_Presentation}/gu, '')
					.replace(/(\b\w+=)/g, '**$1**')
					.replace(/'/g, '`')
					.trim(),
				color: hex ?? 0x008FD1,
				footer: {
					text: `${SERVER_ID ? `${SERVER_ID} • ` : ''}${authorAndName} [v${version}]`,
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