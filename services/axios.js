const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { version, repoName, repoUrl } = require('../repo.js');
const logger = require('../logger.js');

const USER_AGENT = `Mozilla/5.0 (compatible; ${repoName}/${version}; +${repoUrl})`;
const DEFAULT_HEADERS = {
	'User-Agent': USER_AGENT,
	'Accept': 'application/json',
	'Cache-Control': 'no-cache',
	'Connection': 'keep-alive',
};

const HEADERS_BULK_REPORT = {
	...DEFAULT_HEADERS,
	'Content-Type': 'application/json',
};

const BASE_URLS = {
	sniffcat: 'https://api.sniffcat.com/api/v1',
	abuseipdb: 'https://api.abuseipdb.com/api/v2',
	spamverify: 'https://api.spamverify.com/v1/ip',
};

const matchedKey = Object.keys(BASE_URLS).find(key => repoName.toLowerCase().includes(key));
const resolvedBaseURL = BASE_URLS[matchedKey];
if (!resolvedBaseURL) {
	logger.log(`No matching baseURL found for repoName '${repoName}', expected one of: ${Object.keys(BASE_URLS).join(', ')}`, 3, true);
	process.exit(1);
}

const api = axios.create({ baseURL: resolvedBaseURL, timeout: 45000, headers: DEFAULT_HEADERS });
const bulk = axios.create({ baseURL: resolvedBaseURL, timeout: 60000, headers: HEADERS_BULK_REPORT });
const sefinek = axios.create({ timeout: 30000, headers: DEFAULT_HEADERS });
const webhook = axios.create({ timeout: 15000, headers: DEFAULT_HEADERS });

const retryOptions = {
	retries: 3,
	retryDelay: count => count * 7000,
	retryCondition: err => err.code === 'ECONNABORTED' || err.code === 'ENOTFOUND' || (err.response && err.response.status >= 500),
	onRetry: (count, err, config) => {
		const status = err.response?.status ? `Status ${err.response.status}` : err.code || err.message || 'Unknown error';
		logger.log(`${status} - retry #${count} for ${config.url}`, 2);
	},
};

axiosRetry(api, retryOptions);
axiosRetry(bulk, retryOptions);
axiosRetry(sefinek, retryOptions);
axiosRetry(webhook, retryOptions);

module.exports = { axios: api, bulk, sefinek, webhook };