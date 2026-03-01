exports.rules = [
	{ key: 'IP_ASSIGNMENT', type: String, oneOf: ['static', 'dynamic'] },
	{ key: 'IPv6_SUPPORT', type: Boolean },
	{ key: 'EXTENDED_LOGS', type: Boolean },
	{ key: 'CACHE_FILE', type: String, nonEmpty: true },

	{ key: 'AUTO_UPDATE_ENABLED', type: Boolean },
	{ key: 'AUTO_UPDATE_SCHEDULE', type: String, required: false },

	{ key: 'DISCORD_WEBHOOK_ENABLED', type: Boolean },
	{ key: 'DISCORD_WEBHOOK_URL', type: String, required: false },
];

exports.services = {
	sniffcat: { apiKey: 'SNIFFCAT_API_KEY', minCooldown: 20 * 60 * 1000 },
	abuseipdb: { apiKey: 'ABUSEIPDB_API_KEY', minCooldown: 15 * 60 * 1000 },
};
