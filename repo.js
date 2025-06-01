const { version, author: authorMeta, repository, license } = require('../package.json');

const [, repoAuthor = '', repoName = ''] =
repository?.url?.match(/github\.com[:/]+([^/]+)\/([^/#.]+)(?:\.git)?/) || [];

const repoSlug = `${repoAuthor}/${repoName}`;
const repoUrl = `https://github.com/${repoSlug}`;

module.exports = {
	version,
	repoAuthor,
	authorMeta,
	repoName,
	repoSlug,
	repoUrl,
	license,
};