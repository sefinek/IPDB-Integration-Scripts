const { version, homepage } = require('../../package.json');

const match = homepage.match(/github\.com\/([^\\/]+)\/([^#\\/]+)/) || [];
const [, author, name] = match;
const authorAndName = `${author}/${name}`;
const repoFullUrl = homepage.split('#')[0] || '';

module.exports = { version, author, name, authorAndName, repoFullUrl };