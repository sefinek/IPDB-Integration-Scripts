const { networkInterfaces } = require('node:os');
const https = require('node:https');
const { CronJob } = require('cron');
const { axiosSefinek } = require('./axios.js');
const isSpecialPurposeIP = require('../isSpecialPurposeIP.js');
const logger = require('../logger.js');
const { IP_ASSIGNMENT, IP_REFRESH_SCHEDULE, IPv6_SUPPORT } = require('../../config.js').MAIN;

const ipAddresses = new Set();
let ipv6ErrorCount = 0, ipv6ErrorLogged = false;
let isRefreshing = false;

const fetchLocalIPs = () => {
	for (const ifaceList of Object.values(networkInterfaces())) {
		for (const iface of ifaceList) {
			const addr = iface?.address;
			if (addr && !iface.internal && !isSpecialPurposeIP(addr)) ipAddresses.add(addr);
		}
	}
};

const fetchIPAddress = async (family, attempt = 1) => {
	if (family === 0) return fetchLocalIPs();
	if (family === 6 && (!IPv6_SUPPORT || ipv6ErrorLogged)) return;

	try {
		const { data } = await axiosSefinek.get('https://api.sefinek.net/api/v2/ip', {
			httpsAgent: new https.Agent({ family }),
		});

		if (data?.success && data?.message) {
			ipAddresses.add(data.message);

			if (family === 6 && ipv6ErrorCount > 0) {
				logger.success(`IPv6 is now working. It succeeded after ${ipv6ErrorCount} failed attempts.`);
				ipv6ErrorCount = 0;
				ipv6ErrorLogged = false;
			}
		} else {
			logger.warn(`Unexpected API response: success=${data?.success}, message=${data?.message}`);
		}
	} catch (err) {
		logger.error(`Failed to fetch IPv${family} address (attempt ${attempt}): ${err.message}`);

		if (family === 6) {
			ipv6ErrorCount++;

			if (ipv6ErrorCount >= 6 && !ipv6ErrorLogged) {
				ipv6ErrorLogged = true;
				logger.warn('IPv6 address could not be retrieved after multiple attempts. Disabling further checks.');
			} else if (attempt < 6) {
				await new Promise(resolve => setTimeout(resolve, 4000));
				await fetchIPAddress(6, attempt + 1);
			}
		}
	}
};

const refreshServerIPs = async () => {
	if (isRefreshing) {
		logger.info('IP refresh already in progress, skipping...');
		return;
	}

	isRefreshing = true;
	logger.info('Trying to fetch your IPv4 and IPv6 address from api.sefinek.net...');

	try {
		await Promise.all([fetchIPAddress(0), fetchIPAddress(4), fetchIPAddress(6)]);
	} catch (err) {
		logger.error(`Failed to refresh IP addresses: ${err.message}`);
	} finally {
		isRefreshing = false;
	}
};

(async () => {
	if (IP_ASSIGNMENT === 'dynamic') new CronJob(IP_REFRESH_SCHEDULE || '0 */6 * * *', refreshServerIPs, null, true);
})();

module.exports = Object.freeze({
	refreshServerIPs,
	getServerIPs: () => [...ipAddresses],
});
