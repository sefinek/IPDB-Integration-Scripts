const { prettyName } = require('./repo');

/**
 * @typedef {
 *   | 'DNS_COMPROMISE'
 *   | 'DNS_POISONING'
 *   | 'DDOS_ATTACK'
 *   | 'PORT_SCAN'
 *   | 'MASS_SCANNER'
 *   | 'EXPLOITED_HOST'
 *   | 'MALWARE_HOSTING'
 *   | 'CNC_BEACONING'
 *   | 'CRYPTOJACKING'
 *   | 'PHISHING'
 *   | 'HACKING'
 *   | 'SQL_INJECTION'
 *   | 'COMMAND_INJECTION'
 *   | 'SPAM_ACTIVITY'
 *   | 'BAD_WEB_BOT'
 *   | 'PATH_TRAVERSAL'
 *   | 'BRUTE_FORCE'
 *   | 'SSH'
 *   | 'FTP'
 *   | 'EMAIL'
 *   | 'HTTP'
 *   | 'RDP'
 *   | 'TELNET'
 *   | 'SMB'
 *   | 'MONGODB'
 *   | 'REDIS'
 *   | 'OTHER_ABUSE'
 *   | 'FRAUD_ORDERS'
 *   | 'PING_OF_DEATH'
 *   | 'FRAUD_VOIP'
 *   | 'OPEN_PROXY'
 *   | 'WEB_SPAM'
 *   | 'EMAIL_SPAM'
 *   | 'BLOG_SPAM'
 *   | 'VPN_IP'
 *   | 'SPOOFING'
 *   | 'WEB_APP_ATTACK'
 *   | 'IOT_TARGETED'
 * } Flag
 */

/** @type {Record<Flag, Flag>} */
const FLAGS = Object.freeze({
	DNS_COMPROMISE: 'DNS_COMPROMISE',
	DNS_POISONING: 'DNS_POISONING',
	DDOS_ATTACK: 'DDOS_ATTACK',
	PORT_SCAN: 'PORT_SCAN',
	MASS_SCANNER: 'MASS_SCANNER',
	EXPLOITED_HOST: 'EXPLOITED_HOST',
	MALWARE_HOSTING: 'MALWARE_HOSTING',
	CNC_BEACONING: 'CNC_BEACONING',
	CRYPTOJACKING: 'CRYPTOJACKING',
	PHISHING: 'PHISHING',
	HACKING: 'HACKING',
	SQL_INJECTION: 'SQL_INJECTION',
	COMMAND_INJECTION: 'COMMAND_INJECTION',
	SPAM_ACTIVITY: 'SPAM_ACTIVITY',
	BAD_WEB_BOT: 'BAD_WEB_BOT',
	PATH_TRAVERSAL: 'PATH_TRAVERSAL',
	BRUTE_FORCE: 'BRUTE_FORCE',
	SSH: 'SSH',
	FTP: 'FTP',
	EMAIL: 'EMAIL',
	HTTP: 'HTTP',
	RDP: 'RDP',
	TELNET: 'TELNET',
	SMB: 'SMB',
	MONGODB: 'MONGODB',
	REDIS: 'REDIS',
	OTHER_ABUSE: 'OTHER_ABUSE',
	FRAUD_ORDERS: 'FRAUD_ORDERS',
	PING_OF_DEATH: 'PING_OF_DEATH',
	FRAUD_VOIP: 'FRAUD_VOIP',
	OPEN_PROXY: 'OPEN_PROXY',
	WEB_SPAM: 'WEB_SPAM',
	EMAIL_SPAM: 'EMAIL_SPAM',
	BLOG_SPAM: 'BLOG_SPAM',
	VPN_IP: 'VPN_IP',
	SPOOFING: 'SPOOFING',
	WEB_APP_ATTACK: 'WEB_APP_ATTACK',
	IOT_TARGETED: 'IOT_TARGETED',
});

const MAPPINGS = Object.freeze({
	SniffCat: new Map([
		['DNS_COMPROMISE', 1],
		['DNS_POISONING', 2],
		['DDOS_ATTACK', 3],
		['PORT_SCAN', 4],
		['MASS_SCANNER', 5],
		['EXPLOITED_HOST', 6],
		['MALWARE_HOSTING', 7],
		['CNC_BEACONING', 8],
		['CRYPTOJACKING', 9],
		['PHISHING', 10],
		['HACKING', 11],
		['SQL_INJECTION', 12],
		['COMMAND_INJECTION', 13],
		['SPAM_ACTIVITY', 14],
		['BAD_WEB_BOT', 15],
		['PATH_TRAVERSAL', 16],
		['BRUTE_FORCE', 17],
		['SSH', 18],
		['FTP', 19],
		['EMAIL', 20],
		['HTTP', 21],
		['RDP', 22],
		['TELNET', 23],
		['SMB', 24],
		['MONGODB', 25],
		['REDIS', 26],
		['OTHER_ABUSE', 27],
	]),
	AbuseIPDB: new Map([
		['DNS_COMPROMISE', 1],
		['DNS_POISONING', 2],
		['FRAUD_ORDERS', 3],
		['DDOS_ATTACK', 4],
		['FTP', 5],
		['PING_OF_DEATH', 6],
		['PHISHING', 7],
		['FRAUD_VOIP', 8],
		['OPEN_PROXY', 9],
		['WEB_SPAM', 10],
		['EMAIL_SPAM', 11],
		['BLOG_SPAM', 12],
		['VPN_IP', 13],
		['PORT_SCAN', 14],
		['HACKING', 15],
		['SQL_INJECTION', 16],
		['SPOOFING', 17],
		['BRUTE_FORCE', 18],
		['BAD_WEB_BOT', 19],
		['EXPLOITED_HOST', 20],
		['WEB_APP_ATTACK', 21],
		['SSH', 22],
		['IOT_TARGETED', 23],
	]),
});

const createFlagSet = () => {
	const flags = new Set();

	const list = () => Array.from(flags);

	const toIDs = (integration = prettyName) => {
		const map = MAPPINGS[integration];
		if (!map) return [];
		return list().map(f => map.get(f)).filter(id => typeof id === 'number');
	};

	const toString = (integration = prettyName) => toIDs(integration).join(',');

	const api = {
		add: /** @param {...Flag} items */ (...items) => {
			for (const item of items) {
				if (Object.prototype.hasOwnProperty.call(FLAGS, item)) flags.add(item);
			}
			return api;
		},
		list,
		toIDs,
		toString,
	};

	return api;
};

module.exports = {
	/** @type {Record<Flag, Flag>} */
	FLAGS,
	createFlagSet,
};