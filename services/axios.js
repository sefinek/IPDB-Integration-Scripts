const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { version, name, repoFullUrl } = require('../repo.js');
const logger = require('../logger.js');

const USER_AGENT = `Mozilla/5.0 (compatible; ${name}/${version}; +${repoFullUrl})`;
const COMMON_HEADERS = {
	'User-Agent': USER_AGENT,
	'Accept': 'application/json',
	'Cache-Control': 'no-cache',
	'Connection': 'keep-alive',
};
const BASE_URLS = {
	sniffcat: 'https://sefinek.net', // TODO
	abuseipdb: 'https://api.abuseipdb.com/api/v2',
	spamverify: 'https://api.spamverify.com/v1/ip',
};

const matchedKey = Object.keys(BASE_URLS).find(key => name.toLowerCase().includes(key));
const resolvedBaseURL = BASE_URLS[matchedKey];
if (!resolvedBaseURL) {
	logger.log(`No matching baseURL found for name '${name}', expected one of: ${Object.keys(BASE_URLS).join(', ')}`, 3, true);
	process.exit(1);
}

const api = axios.create({ baseURL: resolvedBaseURL, timeout: 50000, headers: COMMON_HEADERS });
const webhooks = axios.create({ timeout: 20000, headers: COMMON_HEADERS });

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
axiosRetry(webhooks, retryOptions);

module.exports = { axios: api, webhooks };