const { repoName } = require('../core/repo.js');

// Differences between the report APIs, so an integration's index.js stays the same for AbuseIPDB and SniffCat
const ADAPTERS = Object.freeze({
	abuseipdb: Object.freeze({
		name: 'AbuseIPDB',
		supportsBulk: true,
		getScore: body => body?.data?.abuseConfidenceScore,
		formatError: err => (err.response?.data?.errors ? JSON.stringify(err.response.data.errors) : err.message),
		// 429 is also returned for short bursts, only the daily quota means waiting for the reset
		isDailyLimit: err => err.response?.status === 429 && JSON.stringify(err.response?.data ?? {}).includes('Daily rate limit'),
	}),
	sniffcat: Object.freeze({
		name: 'SniffCat',
		// SniffCat accepts bulk uploads only from the website (logged-in session), not through the API
		supportsBulk: false,
		getScore: body => body?.abuseConfidenceScore,
		formatError: err => err.response?.data?.message ?? err.message,
		// "You have reached the report limit (N) for your role." The other 429 ("You can only report this IP once every N minutes") is per IP.
		isDailyLimit: err => err.response?.status === 429 && (/report limit/i).test(err.response?.data?.message ?? ''),
	}),
});

const resolve = name => {
	const lower = name.toLowerCase();
	const key = Object.keys(ADAPTERS).find(service => lower.includes(service));
	if (!key) throw new Error(`No report API adapter for '${name}', expected the repository name to contain one of: ${Object.keys(ADAPTERS).join(', ')}`);
	return ADAPTERS[key];
};

module.exports = { ...resolve(repoName), ADAPTERS, resolve };
