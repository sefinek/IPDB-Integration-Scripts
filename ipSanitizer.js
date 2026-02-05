const { getServerIPs } = require('./services/ipFetcher.js');

let ipPattern = null;

const buildPattern = () => {
	const ips = getServerIPs();
	if (!ips.length) return null;

	const escaped = ips.map(i => i.replace(/[.:\\[\](){}^$*+?|]/g, '\\$&'));
	return new RegExp(escaped.join('|'), 'g');
};

module.exports = str => {
	if (ipPattern === null) ipPattern = buildPattern() || false;
	return ipPattern ? str.replace(ipPattern, '[SOME-IP]') : str;
};