const { networkInterfaces } = require('node:os');
const { CronJob } = require('cron');
const { get } = require('./axios.js');
const isLocalIP = require('../utils/isLocalIP.js');
const log = require('../utils/log.js');
const { SERVER_ID, IP_REFRESH_SCHEDULE } = require('../../config.js').MAIN;

const ipAddrSet = new Set();

const fetchIPv4Address = async () => {
	try {
		const { data } = await get('https://api.sefinek.net/api/v2/ip');
		if (data?.success && data?.message) ipAddrSet.add(data.message);
	} catch ({ message }) {
		log(2, `Error fetching IPv4 address: ${message}`);
	}
};

const fetchIPv6Address = () => {
	try {
		for (const iface of Object.values(networkInterfaces()).flat()) {
			if (iface && !iface.internal && iface.address && !isLocalIP(iface.address)) ipAddrSet.add(iface.address);
		}
	} catch ({ message }) {
		log(2, `Error fetching IPv6 address: ${message}`);
	}
};

const fetchServerIPs = async () => {
	ipAddrSet.clear();
	await fetchIPv4Address();
	fetchIPv6Address();
};

(async () => {
	await fetchServerIPs();
	new CronJob(IP_REFRESH_SCHEDULE || '*/20 * * * *', fetchServerIPs, null, true, 'UTC');

	if (SERVER_ID === 'development') {
		console.debug([...ipAddrSet]);
	}
})();

module.exports = () => [...ipAddrSet];