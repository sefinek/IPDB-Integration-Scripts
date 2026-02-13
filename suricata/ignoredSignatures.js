// =====================================================================================================================
//  Global Suricata Signature Blacklist
//  Signatures listed here will NOT be reported. These are typically false positives from legitimate services.
//
//  WARNING: Do not modify this file directly!
//  To add custom signatures, use the IGNORED_SIGNATURES array in your config.js file.
//  To disable this built-in list entirely, set USE_BUILT_IN_IGNORED_SIGNATURES to false.
//
//  Last modified: 13.02.2026
// =====================================================================================================================

const { USE_BUILT_IN_IGNORED_SIGNATURES, IGNORED_SIGNATURES } = require('../../config.js').MAIN;

const GLOBAL_IGNORED = {
	// ==========================
	// Discord
	// ==========================
	2035465: 'ET INFO Observed Discord Domain (discord.gg)',
	2060503: 'ET INFO Observed Discord Domain in TLS SNI',

	// ==========================
	// Steam
	// ==========================
	2028651: 'ET GAMES Steam Client HTTP Session',

	// ==========================
	// Android Connectivity Check
	// ==========================
	2036220: 'ET INFO Android Device Connectivity Check',

	// ==========================
	// DDNS Services (Dynamic DNS)
	// ==========================
	2043238: 'ET INFO Observed DDNS Domain',
	2013743: 'ET POLICY Observed DDNS Provider Domain',

	// ==========================
	// Cloudflare Tunnel (argotunnel.com)
	// ==========================
	2047122: 'ET INFO Cloudflare Argo Tunnel Domain',

	// ==========================
	// Xiaomi
	// ==========================
	2018918: 'ET INFO possible Xiaomi phone data leakage DNS',
};

const localIgnored = new Set(IGNORED_SIGNATURES || []);

/**
 * Check if signature should be ignored
 * @param {number} sigId - Signature ID to check
 * @returns {boolean}
 */
const isIgnored = sigId => (USE_BUILT_IN_IGNORED_SIGNATURES && sigId in GLOBAL_IGNORED) || localIgnored.has(sigId);

/**
 * Get description for ignored signature
 * @param {number} sigId - Signature ID
 * @returns {string|null}
 */
const getDescription = sigId => {
	if (USE_BUILT_IN_IGNORED_SIGNATURES && sigId in GLOBAL_IGNORED) return GLOBAL_IGNORED[sigId];
	if (localIgnored.has(sigId)) return 'Local config';
	return null;
};

module.exports = { GLOBAL_IGNORED, isIgnored, getDescription };
