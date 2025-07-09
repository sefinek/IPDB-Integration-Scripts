'use strict';

const { SNIFFCAT_API_KEY, ABUSEIPDB_API_KEY, SEFIN_API_SECRET_TOKEN, CLOUDFLARE_API_KEY } = require('../config.js').MAIN;

const SNIFFCAT = {
	headers: { 'X-Secret-Token': SNIFFCAT_API_KEY },
};

const ABUSEIPDB = {
	headers: { 'Key': ABUSEIPDB_API_KEY },
};

const SEFINEK_API = {
	headers: { 'X-API-Key': SEFIN_API_SECRET_TOKEN },
};

const CLOUDFLARE = {
	headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_KEY}` },
};

module.exports = Object.freeze({ SNIFFCAT, ABUSEIPDB, SEFINEK_API, CLOUDFLARE });