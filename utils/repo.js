const { version, homepage } = require('../../package.json');

const match = homepage.match(/github\.com\/([^\\/]+)\/([^#\\/]+)/) || [];
const [, repoAuthor, repoName] = match;
const repoFull = `${repoAuthor}/${repoName}`;
const repoURL = homepage.split('#')[0] || '';

module.exports = { version, repoAuthor, repoName, repoFull, repoURL };