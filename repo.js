const { version, author: authorMeta, repository, license } = require('../package.json');

const githubRepoRegex = /github\.com[:/]+([^/]+)\/([^/#.]+)(?:\.git)?/;
const [, author = '', name = ''] = repository?.url?.match(githubRepoRegex) || [];

const slug = `${author}/${name}`;
const url = `https://github.com/${slug}`;

const nameMappings = {
	sniffcat: 'SniffCat',
	abuseipdb: 'AbuseIPDB',
	spamverify: 'SpamVerify',
};

const getPrettyName = repo => {
	const repoLower = repo.toLowerCase();
	return Object.entries(nameMappings)
		.reduce((best, [key, value]) =>
			repoLower.includes(key.toLowerCase()) && key.length > best.key.length
				? { key, value }
				: best,
		{ key: '', value: repo }).value;
};

module.exports = Object.freeze({
	version,
	repoAuthor: author,
	authorMeta,
	repoName: name,
	prettyName: getPrettyName(name),
	repoSlug: slug,
	repoUrl: url,
	license,
});