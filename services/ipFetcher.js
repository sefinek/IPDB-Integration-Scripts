const { networkInterfaces } = require('node:os');
const https = require('node:https');
const { CronJob } = require('cron');
const { get } = require('./axios.js');
const isLocalIP = require('../isLocalIP.js');
const log = require('../log.js');
const { IP_REFRESH_SCHEDULE, IPv6_SUPPORT } = require('../../config.js').MAIN;

const ipAddresses = new Set();
let ipv6ErrorCount = 0, ipv6ErrorLogged = false;

const fetchIPAddress = async family => {
	if (family === 6 && (!IPv6_SUPPORT || ipv6ErrorLogged)) return;

	try {
		const { data } = await get('https://api.sefinek.net/api/v2/ip', {
			httpsAgent: new https.Agent({ family }),
		});

		if (data?.success && data?.message) {
			ipAddresses.add(data.message);

			if (family === 6 && ipv6ErrorCount > 0) {
				log(`IPv6 is now working. It succeeded after ${ipv6ErrorCount} failed attempts.`, 1);
				ipv6ErrorCount = 0;
			}
		} else {
			log(`Unexpected API response: success=${data?.success}, message=${data?.message}`, 2);
		}
	} catch (err) {
		log(`Failed to fetch IPv${family} address: ${err.message}`, 3);

		if (family === 6) {
			ipv6ErrorCount++;

			if (ipv6ErrorCount >= 6 && !ipv6ErrorLogged) {
				ipv6ErrorLogged = true;
				log('IPv6 address could not be retrieved after multiple attempts. Disabling further checks.', 2);
			} else {
				await new Promise(resolve => setTimeout(resolve, 4000));
				await fetchIPAddress(6);
			}
		}
	}
};

const fetchLocalIPs = () => {
	for (const iface of Object.values(networkInterfaces()).flat()) {
		const addr = iface?.address;
		if (addr && !iface.internal && !isLocalIP(addr)) ipAddresses.add(addr);
	}
};

const refreshServerIPs = async () => {
	await Promise.all([fetchIPAddress(4), fetchIPAddress(6)]);
	fetchLocalIPs();
};

(async () => {
	new CronJob(IP_REFRESH_SCHEDULE || '0 */6 * * *', refreshServerIPs, null, true);
})();

module.exports = {
	refreshServerIPs,
	getServerIPs: () => [...ipAddresses],
};