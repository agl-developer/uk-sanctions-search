class NameCombinator {

    constructor(debug = false) {
        this.debug = debug;
    }

    generate(name) {
        const parts = name.split(' ');
        const nameLength = parts.length;

        if (this.debug) {
            console.log('[uk-sanctions-search][name-combinator] Initialized.', { name, nameLength, parts });
        }

        // base error state
        if (nameLength < 2) {
            return [
                {
                    firstName: parts[0],
                    middleName: null,
                    lastName: null
                },
                {
                    firstName: null,
                    middleName: null,
                    lastName: parts[0]
                },
            ];
        }

        // used to generate our comparison list
        let validStrComparisons = [];

        // first last
        // handle the simplest base case of a first and last name
        if (nameLength === 2) {
            // validStrComparisons = validStrComparisons.concat(validStrComparisons, this._splitNameFirstLast(parts, nameLength));
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstLast(parts, nameLength)];
        } else {
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstFirstLast(parts, nameLength)];
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstLastLast(parts, nameLength)];
            /*
            // NOTE: these aren't necessary for now as middle names aren't used in OFAC SDN
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstMiddleLast(parts, nameLength)];
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstMiddleMiddleLast(parts, nameLength)];
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstMiddleLastLast(parts, nameLength)];
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstFirstMiddleLast(parts, nameLength)];
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstFirstMiddleLastLast(parts, nameLength)];
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstFirstMiddleMiddleLast(parts, nameLength)];
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstMiddleMiddleLastLast(parts, nameLength)];
            validStrComparisons = [...validStrComparisons, ...this._splitNameFirstFirstMiddleMiddleLastLast(parts, nameLength)];
            */
        }

        // remove any null responses
        validStrComparisons = validStrComparisons.filter((element) => {
            return element !== null;
        });

        if (this.debug) {
            console.log('[uk-sanctions-search][name-combinator] Permutations generated.', {
                name,
                parts,
                permutations: JSON.stringify(validStrComparisons, null, 2)
            });
        }

        return validStrComparisons;
    }

    /**
     * Easiest scenario of splitting a name given an array name consisting of two parts: [first, last].
     *
     * @param parts
     * @param nameLength
     * @return {{firstName: *, lastName: *, middleName: null}[]}
     * @private
     */
    _splitNameFirstLast(parts, nameLength) {
        return [{
            firstName: parts[0],
            middleName: null,
            lastName: parts[1],
        }];
    }

    /**
     * Split a given name into first/middle/last.
     *
     * @param parts
     * @param nameLength
     * @return {*}
     * @private
     */
    _splitNameFirstMiddleLast(parts, nameLength) {
        if (nameLength !== 3) {
            return [];
        }

        return [{
            firstName: parts[0],
            middleName: parts[1],
            lastName: parts[2],
        }];
    }

    /**
     * Handle scenario of lastname being a single word with no middle name. Ex:
     *
     * first first last
     * first first first last
     *
     * @param parts
     * @param nameLength
     * @return {{firstName: string, lastName: string, middleName: *}[]}
     * @private
     */
    _splitNameFirstFirstLast(parts, nameLength) {
        const firstName = [];
        const middleName = [];
        const lastName = [];

        lastName.push(parts[nameLength - 1]);

        for (let i = 0; i < nameLength - 1; i++) {
            firstName.push(parts[i]);
        }

        return [{
            firstName: firstName.join(' '),
            middleName: middleName.length ? middleName.join(' ') : null,
            lastName: lastName.join(' ')
        }];
    }

    /**
     * Handle scenario of firstname being a single word with no middle name. Ex:
     *
     * first last last
     * first last last last
     *
     * @param parts
     * @param nameLength
     * @return {{firstName: string, lastName: string, middleName: *}[]}
     * @private
     */
    _splitNameFirstLastLast(parts, nameLength) {
        const firstName = [];
        const middleName = [];
        const lastName = [];

        firstName.push(parts[0]);

        for (let i = 1; i < nameLength; i++) {
            lastName.push(parts[i]);
        }

        return [{
            firstName: firstName.join(' '),
            middleName: middleName.length ? middleName.join(' ') : null,
            lastName: lastName.join(' ')
        }];
    }

    /**
     * Handle scenario of first and lastname being single words with a middle name. Ex:
     *
     * first middle middle last
     * first middle middle middle last
     *
     * @param parts
     * @param nameLength
     * @return {{firstName: string, lastName: string, middleName: *}[]}
     * @private
     */
    _splitNameFirstMiddleMiddleLast(parts, nameLength) {
        if (nameLength < 4) {
            return [];
        }

        const firstName = [];
        const middleName = [];
        const lastName = [];

        firstName.push(parts[0]);
        lastName.push(parts[nameLength - 1]);

        for (let i = 1; i < nameLength - 1; i++) {
            middleName.push(parts[i]);
        }

        return [{
            firstName: firstName.join(' '),
            middleName: middleName.length ? middleName.join(' ') : null,
            lastName: lastName.join(' ')
        }];
    }

    /**
     * Handle scenario of middlename and lastname being a single word. Ex:
     *
     * first first middle last
     * first first first middle last
     *
     * @param parts
     * @param nameLength
     * @return {{firstName: string, lastName: string, middleName: *}[]}
     * @private
     */
    _splitNameFirstFirstMiddleLast(parts, nameLength) {
        if (nameLength < 4) {
            return [];
        }

        const firstName = [];
        const middleName = [];
        const lastName = [];

        middleName.push(parts[nameLength - 2]);
        lastName.push(parts[nameLength - 1]);

        for (let i = 0; i < nameLength - 2; i++) {
            firstName.push(parts[i]);
        }

        return [{
            firstName: firstName.join(' '),
            middleName: middleName.length ? middleName.join(' ') : null,
            lastName: lastName.join(' ')
        }];
    }

    /**
     * Handle scenario of firstname and middlename being a single word. Ex:
     *
     * first middle last last
     * first middle last last last
     *
     * @param parts
     * @param nameLength
     * @return {{firstName: string, lastName: string, middleName: *}[]}
     * @private
     */
    _splitNameFirstMiddleLastLast(parts, nameLength) {
        if (nameLength < 4) {
            return [];
        }

        const firstName = [];
        const middleName = [];
        const lastName = [];

        firstName.push(parts[0]);
        middleName.push(parts[1]);

        for (let i = 2; i < nameLength; i++) {
            lastName.push(parts[i]);
        }

        return [{
            firstName: firstName.join(' '),
            middleName: middleName.length ? middleName.join(' ') : null,
            lastName: lastName.join(' ')
        }];
    }

    /**
     * Handle scenario of firstname and lastname being multiple words. Ex:
     *
     * first first middle last last
     * first first first middle last last
     * first first middle last last last
     *
     * @param parts
     * @param nameLength
     * @return {*}
     * @private
     */
    _splitNameFirstFirstMiddleLastLast(parts, nameLength) {
        if (nameLength < 5) {
            return [];
        }

        const permutations = [];

        // find the "middle"
        let middleIndex = nameLength / 2;

        // if we have a decimal, the middle name is tucked exactly between the two
        // i.e. "first first middle last last"
        if (!Number.isInteger(middleIndex)) {
            middleIndex = Math.floor(middleIndex);
            permutations.push(this._splitNameOnMiddleIndex(parts, nameLength, middleIndex));
            // if we have an integer, the middle name is uneven
            // i.e. "first first first middle last last" or "first first middle last last last"
        } else {
            // scenario 1: middle name uneven right
            permutations.push(this._splitNameOnMiddleIndex(parts, nameLength, middleIndex));

            // scenario 2: middle name uneven left
            middleIndex = middleIndex - 1;
            permutations.push(this._splitNameOnMiddleIndex(parts, nameLength, middleIndex));
        }

        return permutations;
    }

    /**
     *
     * first first middle middle last (2,2)
     * first first first middle middle last (3,2)
     * first first middle middle middle last (2,3)
     * first first first middle middle middle last (3,3)
     *
     * @param parts
     * @param nameLength
     * @return {*}
     * @private
     */
    _splitNameFirstFirstMiddleMiddleLast(parts, nameLength) {
        if (nameLength < 5) {
            return [];
        }

        const permutations = [];

        const firstName = [];
        let middleName = [];
        const lastName = [];

        lastName.push(parts[nameLength - 1]);

        // we cannot let i exceed the minimum middle name length requirement
        for (let i = 0; i < nameLength - 3; i++) {
            firstName.push(parts[i]);

            // reset middle name
            middleName = [];

            // middle must be at least 2 spots from the beginning to satisfy "first first"
            // and 1 spot from the end to satisfy "last"
            for (let j = i + 1; j < nameLength - 1; j++) {
                middleName.push(parts[j]);
            }

            // only add permutations if we've hit our minimum length requirement
            if (firstName.length > 1) {
                permutations.push({
                    firstName: firstName.join(' '),
                    middleName: middleName.join(' '),
                    lastName: lastName.join(' ')
                });
            }
        }

        return permutations;
    }

    /**
     * first middle middle last last
     * first middle middle middle last last
     * first middle middle last last last
     *
     * @param parts
     * @param nameLength
     * @return {*}
     * @private
     */
    _splitNameFirstMiddleMiddleLastLast(parts, nameLength) {
        if (nameLength < 5) {
            return [];
        }

        const permutations = [];

        const firstName = [];
        const middleName = [];
        let lastName = [];

        firstName.push(parts[0]);

        // we cannot let i exceed the minimum last name length requirement
        for (let i = 1; i < nameLength - 2; i++) {
            middleName.push(parts[i]);

            // reset last name
            lastName = [];

            for (let j = i + 1; j < nameLength; j++) {
                lastName.push(parts[j]);
            }

            // only add permutations if we've hit our minimum length requirement
            if (middleName.length > 1 && lastName.length > 1) {
                permutations.push({
                    firstName: firstName.join(' '),
                    middleName: middleName.join(' '),
                    lastName: lastName.join(' ')
                });
            }
        }

        return permutations;
    }

    /**
     * TODO: This needs an overhaul to match the following scenarios:
     *
     * first first middle middle last last
     * first first first middle middle last last
     * first first middle middle middle last last
     * first first middle middle last last last
     *
     * @param parts
     * @param nameLength
     * @return {*}
     * @private
     */
    _splitNameFirstFirstMiddleMiddleLastLast(parts, nameLength) {
        if (nameLength < 6) {
            return [];
        }

        const permutations = [];

        const firstName = [];
        let middleName = [];
        let lastName = [];

        // first first middle middle last last
        // i = 0, i < 2; i++
        // j = 2, j < 4; j++
        // k = 4, j < 6; j++

        // EXAMPLE ITERATION
        // =================
        // firstName: 0
        // middleName: 2
        // lastName: 4
        // lastName: 5
        // middleName: 3
        // firstName: 1
        // BREAK

        firstName.push(parts[0]);
        firstName.push(parts[1]);

        // we cannot let i exceed the minimum middle+last name requirement
        for (let i = 2; i < nameLength - 4; i++) {

            // middlename is always minimally offset by 2 from first and last name
            for (let j = i + 1; j < nameLength - 2; j++) {

                middleName.push(parts[j]);

                // lastname is always offset by 2 from middle name
                for (let k = j + 1; k < nameLength; k++) {
                    lastName.push(parts[k]);
                }
            }

            // we've finished out this permutation finishing out middleName
            if (firstName.length > 1 && middleName.length > 1 && lastName.length > 1) {
                permutations.push({
                    firstName: firstName.join(' '),
                    middleName: middleName.join(' '),
                    lastName: lastName.join(' ')
                });
            }

            lastName = [];
            middleName = [];

            // delayed addition to firstname
            firstName.push(parts[i]);
        }

        return permutations;
    }

    /**
     * Special helper function for sanely splitting name based on a given middle index.
     *
     * @param parts
     * @param nameLength
     * @param middleIndex
     * @return {{firstName: string, lastName: string, middleName: string}}
     * @private
     */
    _splitNameOnMiddleIndex(parts, nameLength, middleIndex) {
        const firstName = [];
        const middleName = [];
        const lastName = [];

        middleName.push(parts[middleIndex]);

        for (let i = 0; i < middleIndex; i++) {
            firstName.push(parts[i]);
        }

        for (let i = middleIndex + 1; i < nameLength; i++) {
            lastName.push(parts[i]);
        }

        return {
            firstName: firstName.join(' '),
            middleName: middleName.join(' '),
            lastName: lastName.join(' ')
        };
    }
}

module.exports = {
    NameCombinator: NameCombinator
};
