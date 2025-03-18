const { networkInterfaces } = require('node:os');
const { CronJob } = require('cron');
const { get } = require('./axios.js');
const isLocalIP = require('../utils/isLocalIP.js');
const log = require('../utils/log.js');
const { SERVER_ID, IP_REFRESH_SCHEDULE } = require('../../config.js').MAIN;

const ipAddresses = new Set();

const fetchPublicIPv4 = async () => {
	try {
		const { data } = await get('https://api.sefinek.net/api/v2/ip');
		if (data?.success && data?.message) ipAddresses.add(data.message);
	} catch ({ message }) {
		log(2, `Błąd pobierania adresu IPv4: ${message}`);
	}
};

const fetchAvailableIPv6 = () => {
	try {
		for (const iface of Object.values(networkInterfaces()).flat()) {
			if (iface && !iface.internal && iface.address && !isLocalIP(iface.address)) {
				ipAddresses.add(iface.address);
			}
		}
	} catch ({ message }) {
		log(2, `Błąd pobierania adresu IPv6: ${message}`);
	}
};

const refreshServerIPs = async () => {
	ipAddresses.clear();
	await fetchPublicIPv4();
	fetchAvailableIPv6();
};

(async () => {
	new CronJob(IP_REFRESH_SCHEDULE || '*/20 * * * *', refreshServerIPs, null, true, 'UTC');
	// if (SERVER_ID === 'development') console.debug([...ipAddresses]);
})();

module.exports = { refreshServerIPs, getServerIPs: () => [...ipAddresses] };