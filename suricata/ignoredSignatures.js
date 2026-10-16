// =====================================================================================================================
//  Global Suricata Signature Blacklist
//  Signatures listed here will NOT be reported. These are typically false positives from legitimate services.
//
//  WARNING: Do not modify this file directly!
//  To add custom signatures, use the IGNORED_SIGNATURES array in your config.js file.
//  To disable this built-in list entirely, set USE_BUILT_IN_IGNORED_SIGNATURES to false.
//
//  Last modified: 16.10.2026
// =====================================================================================================================

const logger = require('../logger.js');
const { USE_BUILT_IN_IGNORED_SIGNATURES, IGNORED_SIGNATURES } = require('../../config.js').MAIN;

const GLOBAL_IGNORED = {
	// ==========================
	// Discord
	// ==========================
	2035463: 'ET INFO Observed Discord Domain (discord .com in TLS SNI)',
	2035464: 'ET INFO Observed Discord Domain (discordapp .com in TLS SNI)',
	2035465: 'ET INFO Observed Discord Domain in DNS Lookup (discord .com)',
	2035466: 'ET INFO Observed Discord Domain in DNS Lookup (discordapp .com)',
	2060502: 'ET INFO Discord Chat Service Domain in DNS Lookup (gateway .discord .gg)',
	2060503: 'ET INFO Discord Chat Service Domain in DNS Lookup (discord .com)',
	2060504: 'ET INFO Observed Discord Service Domain (gateway .discord .gg) in TLS SNI',
	2060505: 'ET INFO Observed Discord Service Domain (discord .com) in TLS SNI',

	// ==========================
	// Steam
	// ==========================
	2028651: 'ET USER_AGENTS Steam HTTP Client User-Agent',

	// ==========================
	// Android Connectivity Check
	// ==========================
	2036220: 'ET INFO Android Device Connectivity Check',

	// ==========================
	// DDNS Services (Dynamic DNS)
	// ==========================
	2013743: 'ET DYN_DNS DYNAMIC_DNS Query to a Suspicious no-ip Domain',
	2043238: 'ET DYN_DNS External IP Lookup Domain in DNS Query (checkip .dyndns .org)',

	// ==========================
	// Cloudflare Tunnel (argotunnel.com)
	// ==========================
	2047122: 'ET INFO DNS Query to Cloudflare Tunneling Domain (argotunnel .com)',

	// ==========================
	// Xiaomi
	// ==========================
	2018918: 'ET INFO possible Xiaomi phone data leakage DNS',

	// ==========================
	// Decoder events
	// ==========================
	2200121: 'SURICATA Ethertype unknown',
};

// Accepts numbers and numeric strings, e.g. 2018918 or '2018918'
const parseLocalIgnored = (list = []) => {
	const ids = new Set(), invalid = [];
	for (const value of list) {
		const id = typeof value === 'string' && (/^\d+$/).test(value.trim()) ? Number(value) : value;
		if (Number.isSafeInteger(id) && id > 0) ids.add(id);
		else invalid.push(value);
	}

	if (invalid.length) logger.warn(`Invalid signature ID${invalid.length > 1 ? 's' : ''} in IGNORED_SIGNATURES, skipping: ${invalid.map(String).join(', ')}`);
	return ids;
};

const localIgnored = parseLocalIgnored(IGNORED_SIGNATURES);

/**
 * Get the reason why a signature is ignored
 * @param {number} sigId - Signature ID
 * @returns {string|null} Description of the built-in entry, 'Local config', or null if the signature is not ignored
 */
const getDescription = sigId => {
	if (USE_BUILT_IN_IGNORED_SIGNATURES && Object.hasOwn(GLOBAL_IGNORED, sigId)) return GLOBAL_IGNORED[sigId];
	if (localIgnored.has(sigId)) return 'Local config';
	return null;
};

/**
 * Check if signature should be ignored
 * @param {number} sigId - Signature ID to check
 * @returns {boolean}
 */
const isIgnored = sigId => getDescription(sigId) !== null;

module.exports = { GLOBAL_IGNORED, isIgnored, getDescription };
