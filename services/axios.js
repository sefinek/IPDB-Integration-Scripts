const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { version, name, repoFullUrl } = require('../repo.js');
const logger = require('../logger.js');

const baseURLs = {
	'netcatdb': 'https://api.netcatdb.com/api/v1', // TODO
	'abuseipdb': 'https://api.abuseipdb.com/api/v2',
	'spamverify': 'https://api.spamverify.com/v1/ip',
};

const matchedKey = Object.keys(baseURLs).find(key => name.toLowerCase().includes(key));
const baseURL = baseURLs[matchedKey];
if (!baseURL) {
	logger.log(`No matching baseURL found for name '${name}', expected one of: ${Object.keys(baseURLs).join(', ')}`, 3, true);
	process.exit(1);
}

const api = axios.create({
	baseURL,
	timeout: 50000,
	headers: {
		'User-Agent': `Mozilla/5.0 (compatible; ${name}/${version}; +${repoFullUrl})`,
		'Accept': 'application/json',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	},
});

const webhooks = axios.create({
	timeout: 20000,
	headers: {
		'User-Agent': `Mozilla/5.0 (compatible; ${name}/${version}; +${repoFullUrl})`,
		'Accept': 'application/json',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	},
});

const retry = {
	retries: 3,
	retryDelay: retryCount => retryCount * 7000,
	retryCondition: error => {
		return error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || (error.response && error.response.status >= 500);
	},
	onRetry: (retryCount, err, requestConfig) => {
		const status = err.response?.status ? `Status ${err.response.status}` : (err.code || err.message || 'Unknown error');
		logger.log(`${status} - retry #${retryCount} for ${requestConfig.url}`, 2);
	},
};

axiosRetry(api, retry);
axiosRetry(webhooks, retry);

module.exports = { axios: api, webhooks };