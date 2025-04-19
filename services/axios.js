const axios = require('axios');
const { version, repoName, repoURL } = require('../utils/repo.js');
const MAX_RETRIES = 3;

const api = axios.create({
	timeout: 30000,
	headers: {
		'User-Agent': `Mozilla/5.0 (compatible; ${repoName}/${version}; +${repoURL})`,
		'Accept': 'application/json',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	},
});

api.interceptors.response.use(null, async err => {
	const config = err.config;
	if (!config) return Promise.reject(err);

	config.__retryCount = config.__retryCount || 0;
	if (config.__retryCount >= MAX_RETRIES || !(err.code === 'ECONNABORTED' || (err.response && err.response.status >= 500))) {
		return Promise.reject(err);
	}

	config.__retryCount++;
	const delay = 25000 * config.__retryCount;
	await new Promise(res => setTimeout(res, delay));

	return api(config);
});

module.exports = api;