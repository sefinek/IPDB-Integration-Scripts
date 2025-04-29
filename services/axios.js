const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { version, name, repoFullUrl } = require('../repo.js');
const log = require('../log.js');

const api = axios.create({
	baseURL: 'https://api.abuseipdb.com/api/v2',
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