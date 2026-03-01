const axios = require('axios');
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
const axiosService = axios.create({ baseURL: serviceConfig.baseURL, timeout: 30000, headers: serviceConfig.headers });
const axiosBulk = axios.create({ baseURL: serviceConfig.baseURL, timeout: 55000, headers: resolveBulkHeaders(serviceConfig.serviceKey) });
const axiosSefinek = axios.create({ timeout: 35000, headers: SERVICE_HEADERS.sefinek });
const axiosWebhook = axios.create({ timeout: 15000, headers: DEFAULT_HEADERS });
const axiosCloudflare = axios.create({ baseURL: 'https://api.cloudflare.com/client/v4', timeout: 30000, headers: SERVICE_HEADERS.cloudflare });

// Retry interceptor
const MAX_RETRIES = 3;
const RETRY_DELAY = count => count * 7000;
const RETRYABLE_CODES = new Set(['ECONNABORTED', 'ENOTFOUND', 'ETIMEDOUT']);
const isRetryable = err =>
	RETRYABLE_CODES.has(err.code) ||
	err.response?.status >= 500;
const hasStream = config => config.data && typeof config.data.pipe === 'function';

const applyRetry = instance => {
	instance.interceptors.response.use(null, async err => {
		const config = err.config;
		if (!config) throw err;

		config.__retryCount ??= 0;
		if (config.__retryCount >= MAX_RETRIES || !isRetryable(err) || hasStream(config)) throw err;

		config.__retryCount++;
		const status = err.response?.status
			? `Status ${err.response.status}`
			: err.code || err.message || 'Unknown error';
		getLogger().log(`${status} - retry #${config.__retryCount} for ${config.url}`, 2);

		await new Promise(resolve => setTimeout(resolve, RETRY_DELAY(config.__retryCount)));
		return instance(config);
	});
};

[axiosGeneric, axiosService, axiosBulk, axiosSefinek, axiosWebhook, axiosCloudflare].forEach(applyRetry);

module.exports = Object.freeze({
	axiosGeneric, // Generic client without baseURL
	axiosService, // Main client for SniffCat, AbuseIPDB
	axiosBulk, // Bulk client with multipart/form-data (CSV upload) for SniffCat and AbuseIPDB
	axiosSefinek, // Client for Sefinek API
	axiosWebhook, // Client for Discord webhooks
	axiosCloudflare, // Client for Cloudflare API
	HEADERS, // Predefined headers for all services
});