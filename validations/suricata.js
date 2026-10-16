module.exports = [
	{ key: 'SURICATA_EVE_FILE', type: String, nonEmpty: true },
	{ key: 'SURICATA_CONFIG_FILE', type: String, nonEmpty: true, default: '/etc/suricata/suricata.yaml' },
	{ key: 'HOME_NET', type: Array, default: [] },
	{ key: 'MIN_ALERT_SEVERITY', type: Number, min: 1, max: 3 },
	{ key: 'ALLOWED_VERDICT_ACTIONS', type: Array, nonEmpty: true, oneOf: ['alert', 'pass', 'drop'], default: ['alert', 'drop'] },
	{ key: 'USE_BUILT_IN_IGNORED_SIGNATURES', type: Boolean },
	{ key: 'IGNORED_SIGNATURES', type: Array },
];
