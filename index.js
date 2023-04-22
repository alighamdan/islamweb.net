const articleClass = require('./classes/article/article');
const article = require('./classes/article/index');

const consultClass = require('./classes/consult/consult');
const consult = require('./classes/consult/index');

const fatwaClass = require('./classes/fatwa/fatwa');
const fatwa = require('./classes/fatwa/index');

const libraryClass = require('./classes/library/library');
const library = require('./classes/library/index');

const surah = require('./utils/db/surah.json');
const apps = require('./utils/db/apps.json');

module.exports = {
    article, articleClass,
    consult, consultClass,
    fatwa, fatwaClass,
    library, libraryClass,
    surah, apps
};