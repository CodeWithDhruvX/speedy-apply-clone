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

        // Option C: Aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        // Option C.5: Aria-labelledby
        const ariaLabelledBy = element.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            const labelElement = document.getElementById(ariaLabelledBy);
            if (labelElement) return labelElement.innerText;
        }

        // Option D: Preceding Sibling (Common in various forms)
        // Look for a label-like element immediately before the input container
        // Workday often nests input in a div, and the label is in a previous div
        let container = element;
        let attempts = 0;

        while (container && attempts < 5) {
            // Walk backwards through siblings
            let sibling = container.previousElementSibling;
            while (sibling) {
                // Check if it's a label tag
                if (sibling.tagName === 'LABEL') return sibling.innerText;

                // Check if it has 'label' in class
                if (sibling.className && typeof sibling.className === 'string' && sibling.className.toLowerCase().includes('label')) {
                    return sibling.innerText;
                }

                // Heuristic: Short text content that looks like a label
                // Normalize newlines to spaces to handle labels with blockified asterisks etc.
                const rawText = sibling.innerText || '';
                const text = rawText.replace(/\s+/g, ' ').trim();

                // Added heuristic: exclude 'section' headers or long texts
                if (text.length > 0 && text.length < 100 && !text.toLowerCase().includes('section')) {
                    return text;
                }

                // If it's a BR or empty span, keep going back
                if (sibling.tagName === 'BR' || text.length === 0) {
                    sibling = sibling.previousElementSibling;
                    continue;
                }

                // If we hit something substantial that isn't a label, stop for this container
                break;
            }

            container = container.parentElement;
            attempts++;
            // Stop if we hit a likely section boundary
            if (container && container.tagName === 'DIV' && container.className && typeof container.className === 'string' && container.className.includes('section')) break;
        }

        return null;
    }
};
