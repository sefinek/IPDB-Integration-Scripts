const ipaddr = require('ipaddr.js');

// ipaddr.parse() also accepts legacy IPv4 forms such as '1.2.3', '134744072' or '0x08080808', so strict validators are used first
const isStrictIP = value => ipaddr.IPv4.isValidFourPartDecimal(value) || (ipaddr.IPv6.isValid(value) && !value.includes('%'));

module.exports = value => {
	if (typeof value !== 'string') return null;

	const ip = value.trim();
	return isStrictIP(ip) ? ipaddr.process(ip).toString() : null;
};
