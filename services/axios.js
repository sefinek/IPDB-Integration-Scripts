const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { version, name, repoFullUrl } = require('../repo.js');
const log = require('../log.js');

const baseURLs = {
	'spamverify': 'https://api.spamverify.com/v1/ip',
	'abuseipdb': 'https://api.abuseipdb.com/api/v2',
};

const lowerName = name.toLowerCase();
const matchedKey = Object.keys(baseURLs).find(key => lowerName.includes(key));
const baseURL = baseURLs[matchedKey];
if (!baseURL) {
	log(`No matching baseURL found for name "${name}", expected one of: ${Object.keys(baseURLs).join(', ')}`, 3, true);
	process.exit(1);
} else {
	log(`Base URL matched for "${matchedKey}": ${baseURL}`, 1);
}

const api = axios.create({
	baseURL,
	timeout: 30000,
	headers: {
		'User-Agent': `Mozilla/5.0 (compatible; ${name}/${version}; +${repoFullUrl})`,
		'Accept': 'application/json',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	},
});

axiosRetry(api, {
	retries: 3,
	retryDelay: retryCount => retryCount * 7000,
	retryCondition: error => {
		return error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || (error.response && error.response.status >= 500);
	},
	onRetry: (retryCount, err, requestConfig) => {
		const status = err.response?.status ? `Status ${err.response.status}` : (err.code || err.message || 'Unknown error');
		log(`${status} - retry #${retryCount} for ${requestConfig.url}`, 2);
	},
});

module.exports = api;