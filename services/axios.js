'use strict';

const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { version, repoName, repoUrl } = require('../repo.js');
const logger = require('../logger.js');
const { SERVER_ID, SNIFFCAT_API_KEY, ABUSEIPDB_API_KEY, SPAMVERIFY_API_KEY, SEFIN_API_SECRET_TOKEN, CLOUDFLARE_API_KEY } = require('../../config.js').MAIN;

const USER_AGENT = `Mozilla/5.0 (compatible; ${repoName}/${version}; +${repoUrl})`;
const DEFAULT_HEADERS = {
	'User-Agent': USER_AGENT,
	'Accept': 'application/json',
	'Cache-Control': 'no-cache',
	'Connection': 'keep-alive',
};

const HEADERS = {
	sniffcat: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json', 'X-Secret-Token': SNIFFCAT_API_KEY },
	abuseipdb: { ...DEFAULT_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', 'Key': ABUSEIPDB_API_KEY },
	spamverify: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json', 'Api-Key': SPAMVERIFY_API_KEY },
	sefinek: { ...DEFAULT_HEADERS, 'X-API-Key': SEFIN_API_SECRET_TOKEN },
	cloudflare: { ...DEFAULT_HEADERS, 'Content-Type': 'application/json', 'Authorization': `Bearer ${CLOUDFLARE_API_KEY}` },
};

const BASE_URLS = {
	sniffcat: 'https://api.sniffcat.com/api/v1',
	abuseipdb: 'https://api.abuseipdb.com/api/v2',
	spamverify: 'https://api.spamverify.com/v1/ip',
};

const matchedKey = Object.keys(BASE_URLS).find(key => repoName.toLowerCase().includes(key));
const resolvedHeaders = HEADERS[matchedKey] || DEFAULT_HEADERS;
const resolvedBaseURL = BASE_URLS[matchedKey];
if (!resolvedBaseURL) {
	logger.log(`No matching baseURL found for repoName '${repoName}', expected one of: ${Object.keys(BASE_URLS).join(', ')}`, 3, true);
	process.exit(1);
} else if (SERVER_ID === 'development') {
	logger.log(`Base URL: ${resolvedBaseURL}`);
	logger.log(JSON.stringify(resolvedHeaders));
}

// Axios instances
const axiosGeneric = axios.create({ timeout: 20000, headers: DEFAULT_HEADERS });
const axiosService = axios.create({ baseURL: resolvedBaseURL, timeout: 25000, headers: resolvedHeaders });
const axiosBulk = axios.create({ baseURL: resolvedBaseURL, timeout: 60000, headers: { ...resolvedHeaders, 'Content-Type': 'multipart/form-data' } });
const axiosSefinek = axios.create({ timeout: 25000, headers: HEADERS.sefinek });
const axiosWebhook = axios.create({ timeout: 15000, headers: DEFAULT_HEADERS });
const axiosCloudflare = axios.create({ baseURL: 'https://api.cloudflare.com/client/v4', timeout: 25000, headers: HEADERS.cloudflare });

// Axios retry
const retryOptions = {
	retries: 3,
	retryDelay: count => count * 7000,
	retryCondition: err =>
		err.code === 'ECONNABORTED' ||
		err.code === 'ENOTFOUND' ||
		(err.response && err.response.status >= 500),
	onRetry: (count, err, config) => {
		const status = err.response?.status
			? `Status ${err.response.status}`
			: err.code || err.message || 'Unknown error';
		logger.log(`${status} - retry #${count} for ${config.url}`, 2);
	},
};

axiosRetry(axiosGeneric, retryOptions);
axiosRetry(axiosService, retryOptions);
axiosRetry(axiosBulk, retryOptions);
axiosRetry(axiosSefinek, retryOptions);
axiosRetry(axiosWebhook, retryOptions);
axiosRetry(axiosCloudflare, retryOptions);

module.exports = Object.freeze({
	axiosGeneric, // Generic client without baseURL
	axiosService, // Main client for SniffCat, AbuseIPDB, SpamVerify
	axiosBulk, // Bulk client with multipart/form-data (CSV upload) for SniffCat and AbuseIPDB
	axiosSefinek, // Client for Sefinek API
	axiosWebhook, // Client for Discord webhooks
	axiosCloudflare, // Client for Cloudflare API
	HEADERS, // Predefined headers for all services
});