const { refreshServerIPs, getServerIPs } = require('../services/ipFetcher.js');

(async () => {
	await refreshServerIPs();
	console.log(getServerIPs());
})();