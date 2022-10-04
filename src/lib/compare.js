const FuzzySet = require('fuzzyset.js');
const { Processor } = require('./processor.js');

class Compare {

    source = 'uk-sanctions';

    constructor(debug = false, fuzzy_threshold = 0.8) {
        this.debug = debug;
        this.fuzzy_threshold = fuzzy_threshold;

        this.processor = new Processor();
    }

    /**
     * Given an object containing search parameters for a "person", attempt to find a match from the
     * EU sanctions list.
     *
     * @param   searchEntity
     * @param   sanctionsEntry
     * @return  {Array}
     */
    findMatch(searchEntity, sanctionsEntry) {
        // only match specific search types
        if (!sanctionsEntry['Group Type'].includes(searchEntity.search_type)) {
            return [];
        }

        // check if we need to filter (skip) by country
        if (searchEntity.country) {
            if (sanctionsEntry['Country'][0].length === 0) {
                return [];
            }

            const countries =
                sanctionsEntry['Country']
                    .map(countryName => this.processor.sanitize(countryName));
            if (!countries.includes(searchEntity.country)) {
                return [];
            }
        }

        const individualMatchesFound = [];

        const fullNameProvided = searchEntity.fullName;
        if (fullNameProvided) {
            const result_exact = this._matchFullNameExact(searchEntity.permutations, sanctionsEntry);
            if (result_exact.match) {
                individualMatchesFound.push(result_exact);
            }

            const result_fuzzy = this._matchFullNameFuzzy(searchEntity.permutations, sanctionsEntry);
            if (result_fuzzy.match) {
                individualMatchesFound.push(result_fuzzy);
            }

            if (individualMatchesFound.length) {
                return individualMatchesFound;
            }
        }

        // perform name search
        const nameSearch = !!(searchEntity.firstName || searchEntity.lastName);
        if (nameSearch) {
            const result_exact = this._matchSimpleNameExact(searchEntity, sanctionsEntry);
            if (result_exact.match) {
                individualMatchesFound.push(result_exact);
            }

            const result_fuzzy = this._matchSimpleNameFuzzy(searchEntity, sanctionsEntry);
            if (result_fuzzy.match) {
                individualMatchesFound.push(result_fuzzy);
            }
        }

        return individualMatchesFound;
    }

    fuzzyAdvanced(permutation, sdnStr) {
        const validStrComparisons = this._generateVariationsOfPermutation(permutation);
        const fuzzySet = new FuzzySet(validStrComparisons);
        const fuzzyMatchResult = fuzzySet.get(sdnStr, false, this.fuzzy_threshold);

        return {
            isMatching: !!fuzzyMatchResult,
            ...(fuzzyMatchResult && { score: fuzzyMatchResult })
        };
    }

    /**
     * Given an SDN name string and a full name to compare against, attempt to find match(es).
     *
     * @param firstName
     * @param lastName
     * @param sdnStr
     * @return {{isMatching: boolean}}
     */
    fuzzySimple(firstName, lastName, sdnStr) {
        // generate all of our name comparisons
        const validStrComparisons = this._generateVariationsOfPermutation({ firstName, lastName });
        const fuzzySet = new FuzzySet(validStrComparisons);
        const fuzzyMatchResult = fuzzySet.get(sdnStr, false, this.fuzzy_threshold);

        return {
            isMatching: !!fuzzyMatchResult,
            ...(fuzzyMatchResult && { score: fuzzyMatchResult })
        };
    }

    _matchFullNameExact(permutations, sanctionsEntry, type = 'exact') {
        // NameAlias_WholeName
        sanctionsEntry['Name 1'] = this._sanitizeStringArray(sanctionsEntry['Name 1']);
        sanctionsEntry['Name 2'] = this._sanitizeStringArray(sanctionsEntry['Name 2']);
        sanctionsEntry['Name 3'] = this._sanitizeStringArray(sanctionsEntry['Name 3']);

        for (const permutation of permutations) {
            let matchFound = false;

            if (sanctionsEntry['Name 1'][0].length && permutation.firstName) {
                matchFound = sanctionsEntry['Name 1'].includes(permutation.firstName);
            }

            if (sanctionsEntry['Name 2'][0].length && permutation.middleName) {
                matchFound = matchFound && sanctionsEntry['Name 2'].includes(permutation.middleName);
            }

            if (sanctionsEntry['Name 3'][0].length && permutation.lastName) {
                matchFound = matchFound && sanctionsEntry['Name 3'].includes(permutation.lastName);
            }

            if (matchFound) {
                return {
                    match: true,
                    match_type: type,
                    source: this.source,
                    sdn_entry: sanctionsEntry,
                    permutation,
                    fuzzymatch: []
                };
            }
        }

        return {
            match: false,
            source: this.source
        };
    }

    _matchFullNameFuzzy(permutations, sanctionsEntry, type = 'fuzzy') {
        // NameAlias_WholeName
        sanctionsEntry['Name 1'] = this._sanitizeStringArray(sanctionsEntry['Name 1']);
        sanctionsEntry['Name 3'] = this._sanitizeStringArray(sanctionsEntry['Name 3']);

        const max = Math.max(sanctionsEntry['Name 1'].length, sanctionsEntry['Name 3'].length);

        for (const permutation of permutations) {
            let result = { isMatching: false };
            for (let i = 0; i < max; i++) {
                if (sanctionsEntry['Name 1'][i] && sanctionsEntry['Name 3'][i]) {
                    result = this.fuzzyAdvanced(
                        permutation,
                        `${sanctionsEntry['Name 1'][i]} ${sanctionsEntry['Name 3'][i]}`
                    );
                }
                if (result.isMatching) {
                    break;
                }
            }

            if (result.isMatching) {
                return {
                    match: true,
                    match_type: type,
                    source: this.source,
                    sdn_entry: sanctionsEntry,
                    permutation,
                    fuzzymatch: result.score
                };
            }
        }

        return {
            match: false,
            source: this.source
        };
    }

    _matchSimpleNameExact(searchEntity, sanctionsEntry, type = 'exact') {
        let matchFound = false;
        sanctionsEntry['Name 1'] = this._sanitizeStringArray(sanctionsEntry['Name 1']);
        sanctionsEntry['Name 2'] = this._sanitizeStringArray(sanctionsEntry['Name 2']);
        sanctionsEntry['Name 3'] = this._sanitizeStringArray(sanctionsEntry['Name 3']);

        if (sanctionsEntry['Name 1'][0].length && searchEntity.firstName) {
            matchFound = sanctionsEntry['Name 1'].includes(searchEntity.firstName);
        }

        if (sanctionsEntry['Name 2'][0].length && searchEntity.middleName) {
            matchFound = matchFound && sanctionsEntry['Name 2'].includes(searchEntity.middleName);
        }

        if (sanctionsEntry['Name 3'][0].length && searchEntity.lastName) {
            matchFound = matchFound && sanctionsEntry['Name 3'].includes(searchEntity.lastName);
        }

        // handle early return case of an exact match
        if (matchFound) {
            return {
                match: true,
                match_type: type,
                source: this.source,
                sdn_entry: sanctionsEntry,
                permutation: searchEntity,
                fuzzymatch: []
            };
        }

        return {
            match: false,
            source: this.source
        };
    }

    _matchSimpleNameFuzzy(searchEntity, sanctionsEntry, type = 'fuzzy') {
        // perform a fuzzy comparison as a fallback
        sanctionsEntry['Name 1'] = this._sanitizeStringArray(sanctionsEntry['Name 1']);
        sanctionsEntry['Name 3'] = this._sanitizeStringArray(sanctionsEntry['Name 3']);

        const max = Math.max(sanctionsEntry['Name 1'].length, sanctionsEntry['Name 3'].length);

        let result = { isMatching: false };

        for (let i = 0; i < max; i++) {
            result = this.fuzzySimple(
                searchEntity.firstName,
                searchEntity.lastName,
                `${sanctionsEntry['Name 1']} ${sanctionsEntry['Name 3']}`
            );
            if (result.isMatching) {
                break;
            }
        }

        if (result.isMatching) {
            return {
                match: true,
                match_type: type,
                source: this.source,
                sdn_entry: sanctionsEntry,
                permutation: {
                    firstName: searchEntity.firstName,
                    lastName: searchEntity.lastName,
                },
                fuzzymatch: result.score
            };
        }

        return {
            match: false,
            source: this.source
        }
    }

    _generateVariationsOfPermutation(permutation) {
        // create AKA variations
        const firstInitial = permutation.firstName.charAt(0);

        if (permutation.middleName) {
            const middleInitial = permutation.middleName.charAt(0);

            return [
                `${permutation.firstName} ${permutation.lastName}`,             // Albus Dumbledore
                `${permutation.firstInitial} ${permutation.lastName}`,          // A Dumbledore
                `${permutation.lastName}, ${permutation.firstName}`,            // Dumbledore, Albus
                `${permutation.lastName},${permutation.firstName}`,             // Dumbledore,Albus
                `${permutation.lastName}, ${firstInitial}`,                     // Dumbledore, A
                `${permutation.lastName},${firstInitial}`,                      // Dumbledore,A

                // with middle names
                `${permutation.firstName} ${permutation.middleName} ${permutation.lastName}`,    // Albus Benjamin Dumbledore
                `${permutation.firstName} ${middleInitial} ${permutation.lastName}`,             // Albus B Dumbledore
                `${permutation.firstInitial} ${permutation.middleName} ${permutation.lastName}`, // A Benjamin Dumbledore
                `${permutation.firstInitial} ${middleInitial} ${permutation.lastName}`,          // A B Dumbledore
                `${permutation.lastName}, ${permutation.firstName} ${permutation.middleName}`,   // Dumbledore, Albus Benjamin
                `${permutation.lastName},${permutation.firstName} ${permutation.middleName}`,    // Dumbledore,Albus Benjamin
                `${permutation.lastName}, ${firstInitial} ${permutation.middleName}`,            // Dumbledore, A Benjamin
                `${permutation.lastName},${firstInitial} ${permutation.middleName}`,             // Dumbledore,A Benjamin
                `${permutation.lastName}, ${permutation.firstName} ${middleInitial}`,            // Dumbledore, Albus B
                `${permutation.lastName},${permutation.firstName} ${middleInitial}`,             // Dumbledore,Albus B
                `${permutation.lastName}, ${firstInitial} ${middleInitial}`,                     // Dumbledore, A B
                `${permutation.lastName},${firstInitial} ${middleInitial}`,                      // Dumbledore,A B
            ];
        }

        return [
            `${permutation.firstName} ${permutation.lastName}`,             // Albus Dumbledore
            `${firstInitial} ${permutation.lastName}`,                      // A Dumbledore
            `${permutation.lastName}, ${permutation.firstName}`,            // Dumbledore, Albus
            `${permutation.lastName},${permutation.firstName}`,             // Dumbledore,Albus
            `${permutation.lastName}, ${firstInitial}`,                     // Dumbledore, A
            `${permutation.lastName},${firstInitial}`,                      // Dumbledore,A
        ];
    }

    _sanitizeStringArray(values = []) {
        return values.map(value => this.processor.sanitize(value));
    }
}

module.exports = {
    Compare: Compare
};
