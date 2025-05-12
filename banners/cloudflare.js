const { authorEmailWebsite } = require('../repo.js');
const gradientText = require('./gradientText.js');

module.exports = header => `\n\
     \x1b[38;2;255;160;0m   .--.       ${gradientText(header, 145, 55)}
     \x1b[38;2;255;140;0m.-(    ).     ${gradientText(authorEmailWebsite, 145, 85)}
    \x1b[38;2;255;120;0m(___.__)__)\x1b[0m
`;