'use strict';

const { CLOUDFLARE_API_KEY, ABUSEIPDB_API_KEY, SEFIN_API_SECRET_TOKEN } = require('../config.js').MAIN;

const CLOUDFLARE = {
	headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_KEY}` },
};

const ABUSEIPDB = {
	headers: { 'Key': ABUSEIPDB_API_KEY },
};

const SEFINEK_API = {
	headers: { 'X-API-Key': SEFIN_API_SECRET_TOKEN },
};

module.exports = Object.freeze({ CLOUDFLARE, ABUSEIPDB, SEFINEK_API });