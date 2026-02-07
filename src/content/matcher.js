window.SpeedyMatcher = {
    /**
     * Attempts to find the best matching profile key for a given input element.
     */
    identifyField: function (element) {
        // 1. Check direct attributes (ID, Name, Data attributes)
        for (const [key, config] of Object.entries(window.SpeedyDictionary.mapping)) {
            // Check specific selectors matches
            if (element.matches && config.selectors && config.selectors.some(sel => element.matches(sel))) {
                return key;
            }

            // Check string attributes
            const attributes = [
                element.id,
                element.name,
                element.placeholder,
                element.getAttribute('aria-label'),
                element.getAttribute('data-automation-id'), // Workday
                element.getAttribute('data-test-id')
            ].filter(Boolean);

            if (attributes.some(attr => config.regex.test(attr))) {
                return key;
            }
        }

        // 2. Check nearby Label text
        const labelText = this.getLabelText(element);
        if (labelText) {
            for (const [key, config] of Object.entries(window.SpeedyDictionary.mapping)) {
                if (config.regex.test(labelText)) {
                    return key;
                }
            }
        }

        return null;
    },

    getLabelText: function (element) {
        // Option A: <label for="id">
        if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.innerText;
        }

        // Option B: Wrapped <label><input></label>
        const parentLabel = element.closest('label');
        if (parentLabel) {
            // Clone and remove input to get just the text
            const clone = parentLabel.cloneNode(true);
            const input = clone.querySelector('input, select, textarea');
            if (input) input.remove();
            return clone.innerText;
        }

        // Option C: Preceding sibling or container text (heuristic)
        // This is risky, keeping it simple for now.
        return null;
    }
};
