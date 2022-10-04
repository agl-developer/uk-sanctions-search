const fs = require('fs');
const readline = require('readline');
const fetch = require('node-fetch')
const csvParse = require('csv-parse');

const { Processor } = require('./lib/processor.js');
const { Compare } = require('./lib/compare.js');
const { NameCombinator } = require('./lib/name_combinator.js');

const self = module.exports = {
    /**
     * The full url to the European External Action Service sanctions list.
     */
    url: 'https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.csv',

    /**
     * Default configuration options.
     */
    opts: {
        force: false,
        path: '/tmp',
        csv: 'uk-sanctions-list.csv',
        parsed_json: 'uk-sanctions-list.json',
        version_json: 'uk-sanctions-list.version.json',
        debug: false,
        fuzzy_threshold: 0.6,
        fetch
    },

    oldDbInfo: { 'Publish Date': null, 'Record Count' : null },
    dbInfo: null,
    oldDb: null,
    db: null,

    /**
     * Load the configuration options.
     *
     * @param opts
     */
    config: (opts) => {
        self.opts = Object.assign(self.opts, opts);
    },

    /**
     * Initialize the library, setting config options and downloading and extracting the content.
     *
     * @param opts
     * @return {PromiseLike<T | never>}
     */
    init: async (opts = self.opts) => {
        self.config(opts);

        self.processor = new Processor();
        self.comparer = new Compare(self.opts.debug, self.opts.fuzzy_threshold);
        self.combinator = new NameCombinator(self.opts.debug);

        if (self.opts.debug) {
            console.log('[uk-sanctions-search][init] Initializing.', { opts });
        }

        /*
        // check for our cached file and return early if not expired
        const filepath = self._getSanctionsParsedJsonFilepath();
        if (!self._isFileExpired(filepath)) {
            self.loadSanctionsJson();
            self.loadSanctionsVersion();
            return;
        }
        */

        // ensure we force a re-download of the file as it has expired
        // self.opts.force = true;

        const sanctionsParsedPath = self._getSanctionsParsedJsonFilepath();
        const sanctionsVersionPath = self._getSanctionsVersionFilepath();

        // retrieve our prior db version
        if (self._doesFileExist(sanctionsParsedPath)) {
            self.loadSanctionsJson(true);
            self.loadSanctionsVersion(true);
        }

        const path = await self.fetch();
        const result = await self.mapCsvToJson(path);

        self.dbInfo = result[0];
        self.db = result[1];

        // TODO: Compare versions and if it has changed, determine the delta
        // so that we can use it as a much smaller search subset to avoid excessive work.
        // If it has not changed, we break early as there's nothing new to search against.

        if (self.opts.debug) {
            console.log('[uk-sanctions-search][init] Mapping completed, saving files.', {
                sanctionsParsedPath,
                sanctionsVersionPath,
                dbInfo: self.dbInfo
            });
        }

        fs.writeFileSync(sanctionsParsedPath, JSON.stringify(self.db, null, 2), 'utf8');
        fs.writeFileSync(sanctionsVersionPath, JSON.stringify(self.dbInfo, null, 2), 'utf8');
    },

    /**
     * Loads the cached copy of our processed sanctions list.
     * Presumes existence check has already occurred.
     */
    loadSanctionsJson: () => {
        const filepath = self._getSanctionsParsedJsonFilepath();
        self.db = self._loadJsonFile(filepath);
    },

    /**
     * Loads the cached copy of our currently processed sacntions list's version and record count.
     * @return {*}
     */
    loadSanctionsVersion: () => {
        const filepath = self._getSanctionsVersionFilepath();
        self.dbInfo = self._loadJsonFile(filepath);
    },

    /**
     * Fetches and downloads the CSV sanctions list.
     * @param url
     * @return {any}
     */
    fetch: (url = self.url) => {
        if (self.opts.debug) {
            console.log('[uk-sanctions-search][fetch] Initialized.', { url });
        }

        // if a matching local file exists and we're not force downloading, return it early
        const filepath = self._getSanctionsListFilepath();
        if (fs.existsSync(filepath)) {
            if (self.opts.force) {
                if (self.opts.debug) {
                    console.log('[uk-sanctions-search][fetch] Matching file found, but force download flagged.', { filepath, force: self.opts.force });
                }
            } else {
                if (self.opts.debug) {
                    console.log('[uk-sanctions-search][fetch] Matching file found.', { filepath, force: self.opts.force });
                }

                return Promise.resolve(filepath);
            }
        } else {
            if (self.opts.debug) {
                console.log('[uk-sanctions-search][fetch] File not found. Fetching remotely.', { filepath, url, force: self.opts.force });
            }
        }

        if (self.opts.debug) {
            console.log('[uk-sanctions-search][fetch] Triggering download.', { filepath, url, force: self.opts.force });
        }

        // perform download via node-fetch module
        return self.opts.fetch(url).then((res) => {
            return new Promise((resolve, reject) => {
                const dest = fs.createWriteStream(filepath);

                res.body.pipe(dest, {end: true});
                res.body.on('finish', () => {
                    if (self.opts.debug) {
                        console.log('[uk-sanctions-search][fetch] File downloaded.', {
                            url,
                            filepath,
                            force: self.opts.force
                        });
                    }

                    resolve(filepath)
                });

                dest.on('error', (error) => {
                    if (self.opts.debug) {
                        console.error('[uk-sanctions-search][fetch] Error on download.', {url, filepath, error});
                    }

                    reject('Error on download.');
                });
            });
        }).catch((error) => {
            if (self.opts.debug) {
                console.error('[uk-sanctions-search][fetch] Error caught.', { url, error });
            }

            return Promise.reject(`Failed to retrieve url ${url}`);
        });
    },

    /**
     * Given a path to our EU sanctions data, process it into an object and locally store/cache it for future
     * reuse.
     *
     * @param csvPath
     * @return {Promise<any>}
     */
    mapCsvToJson: async (csvPath) => {
        if (self.opts.debug) {
            console.log('[uk-sanctions-search][mapCsvToJson] Initialized.', { csvPath });
        }

        // read database file line by line
        const lineReader = readline.createInterface({
            input: fs.createReadStream(csvPath)
        });

        return await new Promise((resolve, reject) => {
            let lineIdx = 0;
            let headers = [];
            let dbInfo = {};
            let sanctionRecords = {};
            const parser = csvParse.parse({
                delimiter: ',',
                relaxQuotes: true,
                trim: true
            });
            const records = [];
            parser.on('readable', () => {
                let record;
                while ((record = parser.read()) !== null) {
                    let idx = -1;
                    const groupId = record[35];
                    const csvLineMap = record.reduce((agg, cur) => {
                        idx++;
                        return {
                            ...agg,
                            [headers[idx]]: [cur]
                        };
                    }, {});

                    if (!sanctionRecords[groupId]) {
                        sanctionRecords[groupId] = csvLineMap
                    } else {
                        Object.keys(csvLineMap).forEach(key => {

                            const incomingValue = csvLineMap[key][0];
                            const existingValue = sanctionRecords[groupId][key];
                            if (typeof incomingValue !== 'undefined'
                                && typeof existingValue !== 'undefined'
                                && !existingValue.includes(incomingValue)
                            ) {
                                sanctionRecords[groupId][key].push(incomingValue);
                            }
                        });
                    }
                }
            });

            parser.on('error', (err) => {
                console.log('There was an error while parsing', err);
            });

            lineReader
                .on('line', (line) => {
                    // Create map for CSV headers
                    if (lineIdx === 0) {
                        const publishInfo = line.split(',');
                        dbInfo['Publish Date'] = publishInfo[1];
                    } else if (lineIdx === 1) {
                        headers = line
                            .split(',')
                            .map(header => header.trim())
                    } else {
                        parser.write(`${line}\n`);
                    }

                    lineIdx++;
                })
                .on('error', (error) => {
                    if (self.opts.debug) {
                        console.error('[uk-sanctions-search][mapCsvToJson] Error encountered.', { csvPath, error });
                    }
                    parser.end();
                    return reject(error);
                })
                .on('close', () => {
                    // keep track of the total records encountered
                    dbInfo['Record Count'] = lineIdx - 2;
                    parser.end();

                    return resolve([dbInfo, sanctionRecords]);
                });
        });
    },

    /**
     *
     * @param searchEntity
     * @param sanctionRecords
     * @return {Promise<*>}
     */
    search: async (searchEntity, sanctionRecords = self.db) => {
        if (self.opts.debug) {
            console.log('[uk-sanctions-search][search] Initialized.', { searchEntity });
        }

        if (!sanctionRecords) {
            await self.init();
            sanctionRecords = self.db;
        }

        let searchEntitySanitized = searchEntity;

        // clean input data
        searchEntitySanitized = self.processor.sanitize(searchEntitySanitized);

        if (!searchEntitySanitized.search_type || searchEntitySanitized.search_type === 'individual') {
            searchEntitySanitized.search_type = 'Individual';
        }

        searchEntitySanitized.permutations = searchEntitySanitized.fullName ? self.combinator.generate(searchEntitySanitized.fullName) : [];

        // for any matches
        let matchingEntries = [];

        if (self.opts.debug) {
            console.log(`[uk-sanctions-search][search] Looping through ${Object.keys(sanctionRecords).length} records for`, {
                searchEntitySanitized
            });
        }

        for (const groupId of Object.keys(sanctionRecords)) {
            const record = sanctionRecords[groupId];
            const results = self.comparer.findMatch(searchEntitySanitized, record);
            if (results && results.length) {
                matchingEntries = matchingEntries.concat(results);
            }
        }

        return matchingEntries;
    },

    /**
     * Get file path for EU sanctions list file.
     *
     * @return {string}
     */
    _getSanctionsListFilepath: () => {
        return self.opts.path + '/' + self.opts.csv;
    },

    /**
     * Get file path for EU sanctions list file.
     *
     * @return {string}
     */
    _getSanctionsParsedJsonFilepath: () => {
        return self.opts.path + '/' + self.opts.parsed_json;
    },

    _getSanctionsVersionFilepath: () => {
        const url = self.opts.version_json;

        return self.opts.path + '/' + url.replace(/.*\//, '');
    },

    _doesFileExist: (filepath) => {
        if (fs.existsSync(filepath)) {
            return filepath;
        }

        return false;
    },

    _loadJsonFile: (path) => {
        let data = fs.readFileSync(path, 'utf8');
        return JSON.parse(data);
    },
};
