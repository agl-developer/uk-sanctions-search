class Processor {

    sanitize(o) {
        const t = typeof o;

        if (t === 'undefined') {
            return '';
        }

        if (t === 'string') {
            return o.toLowerCase().trim();
        }

        if (Array.isArray(o) || t !== 'object') {
            return o;
        }

        Object.keys(o).forEach(k => {
            if (typeof o[k] == 'string') {
                o[k] = o[k].toLowerCase().trim();
            }
        });

        // remove extraneous spacing
        for (const k of ['firstName', 'middleName', 'lastName']) {
            if (o[k]) {
                o[k] = (o[k] || '').replace(/\W/g, ' ');
            }
        }

        return o;
    }

}

module.exports = {
    Processor: Processor
};
