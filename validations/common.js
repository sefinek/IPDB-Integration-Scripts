exports.rules = [
	{ key: 'IP_ASSIGNMENT', type: String, oneOf: ['static', 'dynamic'] },
	{ key: 'IPv6_SUPPORT', type: Boolean },
	{ key: 'EXTENDED_LOGS', type: Boolean },
	{ key: 'CACHE_FILE', type: String, nonEmpty: true },

	{ key: 'DISCORD_WEBHOOK_ENABLED', type: Boolean },
	{ key: 'DISCORD_WEBHOOK_URL', type: String, required: false },
];

exports.deprecated = {
	AUTO_UPDATE_ENABLED: 'Automatic updates have been removed. You will be notified when a new version is available.',
	AUTO_UPDATE_SCHEDULE: 'Automatic updates have been removed. You will be notified when a new version is available.',
};

exports.services = {
	sniffcat: { apiKey: 'SNIFFCAT_API_KEY', minCooldown: 20 * 60 * 1000 },
	abuseipdb: { apiKey: 'ABUSEIPDB_API_KEY', minCooldown: 15 * 60 * 1000 },
};
