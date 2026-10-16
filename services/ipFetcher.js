const { networkInterfaces } = require('node:os');
const https = require('node:https');
const { CronJob } = require('cron');
const { axiosSefinek } = require('./axios.js');
const isSpecialPurposeIP = require('../ip/isSpecialPurposeIP.js');
const normalizeIP = require('../ip/normalizeIP.js');
const logger = require('../core/logger.js');
const { IP_ASSIGNMENT, IP_REFRESH_SCHEDULE, IPv6_SUPPORT } = require('../../config.js').MAIN;

const IP_API_URL = 'https://api.sefinek.net/api/v2/ip';
const ATTEMPTS = { 4: 1, 6: 6 };
const RETRY_DELAY = 4000;

// Last successfully fetched public IP per family. Kept on failure, so a temporary outage never disables self-protection.
const publicIPs = new Map();
let serverIPs = [];
let refreshing = null;

const fetchLocalIPs = () => {
	const ips = [];
	for (const iface of Object.values(networkInterfaces()).flat()) {
		const ip = normalizeIP(iface.address);
		if (ip && !iface.internal && !isSpecialPurposeIP(ip).is) ips.push(ip);
	}

	return ips;
};

const fetchPublicIP = async family => {
	let lastError;
	for (let attempt = 1; attempt <= ATTEMPTS[family]; attempt++) {
		if (attempt > 1) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));

		try {
			const { data } = await axiosSefinek.get(IP_API_URL, { httpsAgent: new https.Agent({ family }) });
			const ip = normalizeIP(data?.message);
			if (!data?.success || !ip || isSpecialPurposeIP(ip).is || (ip.includes(':') ? 6 : 4) !== family) {
				throw new Error(`Unexpected API response: success=${data?.success}, message=${data?.message}`);
			}

			publicIPs.set(family, ip);
			return;
		} catch (err) {
			lastError = err;
		}
	}

	const lastKnown = publicIPs.get(family);
	logger.error(`Failed to fetch IPv${family} address after ${ATTEMPTS[family]} attempt(s): ${lastError.message}${lastKnown ? `. Keeping the last known address: ${lastKnown}` : ''}`);
};

const refreshServerIPs = () => {
	refreshing ??= (async () => {
		logger.info(`Trying to fetch your public IP address${IPv6_SUPPORT ? 'es' : ''} from api.sefinek.net...`);
		await Promise.all([fetchPublicIP(4), IPv6_SUPPORT && fetchPublicIP(6)]);

		serverIPs = [...new Set([...fetchLocalIPs(), ...publicIPs.values()])];
	})().finally(() => {
		refreshing = null;
	});

	return refreshing;
};

if (IP_ASSIGNMENT === 'dynamic') new CronJob(IP_REFRESH_SCHEDULE || '0 */6 * * *', refreshServerIPs, null, true);

module.exports = Object.freeze({
	refreshServerIPs,

	// Normalized addresses (see normalizeIP)
	getServerIPs: () => serverIPs,
});
