const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { version, repoName, repoUrl } = require('../repo.js');
const { SERVER_ID, EXTENDED_LOGS, SNIFFCAT_API_KEY, ABUSEIPDB_API_KEY, SEFIN_API_SECRET_TOKEN, CLOUDFLARE_API_KEY } = require('../../config.js').MAIN;

// Lazy-load logger
let logger;
const getLogger = () => logger || (logger = require('../logger.js'));

const DEFAULT_HEADERS = {
	'User-Agent': `Mozilla/5.0 (compatible; ${repoName}/${version}; +${repoUrl})`,
	'Accept': 'application/json',
	'Cache-Control': 'no-cache',
	'Connection': 'keep-alive',
};

const HEADERS = {
	json: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json' },
	multipart: { ...DEFAULT_HEADERS, 'Content-Type': 'multipart/form-data' },
};

const SERVICE_HEADERS = {
	sniffcat: { ...HEADERS.json, 'X-Secret-Token': SNIFFCAT_API_KEY },
	abuseipdb: { ...HEADERS.json, Key: ABUSEIPDB_API_KEY },
	sefinek: { ...DEFAULT_HEADERS, 'X-API-Key': SEFIN_API_SECRET_TOKEN },
	cloudflare: { ...HEADERS.json, Authorization: `Bearer ${CLOUDFLARE_API_KEY}` },
};

const BASE_URLS = {
	sniffcat: 'https://api.sniffcat.com/api/v1',
	abuseipdb: 'https://api.abuseipdb.com/api/v2',
};

const resolveServiceConfig = str => {
	const lower = str.toLowerCase();
	for (const [key, baseURL] of Object.entries(BASE_URLS)) {
		if (lower.includes(key)) return { baseURL, headers: SERVICE_HEADERS[key], serviceKey: key };
	}
	return null;
};

const serviceConfig = resolveServiceConfig(repoName);
if (!serviceConfig) {
	getLogger().log(`No matching baseURL found for repoName '${repoName}', expected one of: ${Object.keys(BASE_URLS).join(', ')}`, 3, true);
	process.exit(1);
}

if (
	(serviceConfig.serviceKey === 'sniffcat' && !SNIFFCAT_API_KEY) ||
	(serviceConfig.serviceKey === 'abuseipdb' && !ABUSEIPDB_API_KEY)
) {
	throw new Error(`Missing API key for service '${serviceConfig.serviceKey}'. Please set the appropriate API key in config.js.`);
}

if (SERVER_ID === 'development' && EXTENDED_LOGS && process.argv.length <= 2) {
	getLogger().log(`Base URL: ${serviceConfig.baseURL}`);
	getLogger().log(JSON.stringify(serviceConfig.headers));
}

// Resolve headers for bulk (multipart + token)
const resolveBulkHeaders = serviceKey => {
	if (!serviceKey || !SERVICE_HEADERS[serviceKey]) return HEADERS.multipart;
	return { ...SERVICE_HEADERS[serviceKey], 'Content-Type': 'multipart/form-data' };
};

// Axios instances
const axiosGeneric = axios.create({ timeout: 20000, headers: DEFAULT_HEADERS });
const axiosService = axios.create({ baseURL: serviceConfig.baseURL, timeout: 25000, headers: serviceConfig.headers });
const axiosBulk = axios.create({ baseURL: serviceConfig.baseURL, timeout: 60000, headers: resolveBulkHeaders(serviceConfig.serviceKey) });
const axiosSefinek = axios.create({ timeout: 25000, headers: SERVICE_HEADERS.sefinek });
const axiosWebhook = axios.create({ timeout: 15000, headers: DEFAULT_HEADERS });
const axiosCloudflare = axios.create({ baseURL: 'https://api.cloudflare.com/client/v4', timeout: 25000, headers: SERVICE_HEADERS.cloudflare });

// Retry options
const retryOptions = {
	retries: 3,
	retryDelay: count => count * 7000,
	retryCondition: err =>
		['ECONNABORTED', 'ENOTFOUND'].includes(err.code) ||
		err.response?.status >= 500,
	onRetry: (count, err, config) => {
		const status = err.response?.status
			? `Status ${err.response.status}`
			: err.code || err.message || 'Unknown error';
		getLogger().log(`${status} - retry #${count} for ${config.url}`, 2);
	},
};

// Apply retry to all
[
	axiosGeneric,
	axiosService,
	axiosBulk,
	axiosSefinek,
	axiosWebhook,
	axiosCloudflare,
].forEach(instance => axiosRetry(instance, retryOptions));

module.exports = Object.freeze({
	axiosGeneric, // Generic client without baseURL
	axiosService, // Main client for SniffCat, AbuseIPDB
	axiosBulk, // Bulk client with multipart/form-data (CSV upload) for SniffCat and AbuseIPDB
	axiosSefinek, // Client for Sefinek API
	axiosWebhook, // Client for Discord webhooks
	axiosCloudflare, // Client for Cloudflare API
	HEADERS, // Predefined headers for all services
});