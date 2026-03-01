module.exports = [
	{ key: 'RUN_ON_START', type: Boolean },
	{ key: 'CLOUDFLARE_ZONE_IDS', type: Array, nonEmpty: true },
	{ key: 'CLOUDFLARE_API_KEY', type: String, nonEmpty: true },
	{ key: 'REPORT_SCHEDULE', type: String, nonEmpty: true },
	{ key: 'MAX_URL_LENGTH', type: Number, min: 100 },
	{ key: 'SUCCESS_COOLDOWN', type: Number, min: 0 },
	{ key: 'CLOUDFLARE_TIME_RANGE', type: Number, min: 1 },
	{ key: 'CLOUDFLARE_EVENTS_LIMIT', type: Number, min: 1, max: 10000 },
	{ key: 'ALLOWED_SOURCES', type: Array, nonEmpty: true },
];
