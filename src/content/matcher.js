window.SpeedyMatcher = {
    /**
     * Attempts to find the best matching profile key for a given input element.
     */
    /**
     * Attempts to find the best matching profile key for a given input element using a scoring system.
     */
    identifyField: function (element) {
        let bestMatch = null;
        let maxScore = 0;
        const THRESHOLD = 10; // Minimum score to result in a match

        // Get all relevant attributes once
        const elementId = (element.id || '').toLowerCase();
        const elementName = (element.name || '').toLowerCase();
        const elementPlaceholder = (element.placeholder || '').toLowerCase();
        const elementLabel = (this.getLabelText(element) || '').toLowerCase();
        const elementAriaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
        const elementDataId = (element.getAttribute('data-automation-id') || '').toLowerCase();
        const elementTestId = (element.getAttribute('data-test-id') || '').toLowerCase();

        // Iterate over ALL keys in the dictionary
        for (const [key, config] of Object.entries(window.SpeedyDictionary.mapping)) {
            let score = 0;

            // 1. Selector Match (Exact DOM structure match) - Score: 20
            if (config.selectors && config.selectors.some(sel => element.matches(sel))) {
                score += 20;
            }

            // 2. ID Match - Score: 40
            if (elementId && config.regex.test(elementId)) {
                score += 40;
            }

            // 3. Name Match - Score: 40
            if (elementName && config.regex.test(elementName)) {
                score += 40;
            }

            // 4. Label Match - Score: 100 (Highest Trust)
            if (elementLabel && config.regex.test(elementLabel)) {
                score += 100;
            }

            // 4b. Aria Label Match - Score: 100
            if (elementAriaLabel && config.regex.test(elementAriaLabel)) {
                score += 100;
            }

            // 5. Data Attribute Match (Workday/Greenhouse) - Score: 50
            if ((elementDataId && config.regex.test(elementDataId)) || (elementTestId && config.regex.test(elementTestId))) {
                score += 50;
            }

            // 6. Placeholder Match - Score: 30	
            if (elementPlaceholder && config.regex.test(elementPlaceholder)) {
                score += 30;
            }

            if (score > maxScore && score >= THRESHOLD) {
                maxScore = score;
                bestMatch = key;
            }
        }

        if (bestMatch) {

        }

        return bestMatch;
    },

    getLabelText: function (element) {
        // PRE-CHECK: If the element itself has a placeholder that is NOT "Select", use it as a fallback label
        let placeholderLabel = null;
        if (element.placeholder && element.placeholder.trim().length > 3 && !element.placeholder.toLowerCase().includes('select')) {
            placeholderLabel = element.placeholder;
        }

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
        if (ariaLabel) {
            // Ignore generic labels often found in dropdowns
            const genericLabels = ['select', 'select one', 'choose', 'select...', 'select option', 'required', 'optional'];
            if (!genericLabels.includes(ariaLabel.toLowerCase().trim())) {
                return ariaLabel;
            }
        }

        // Option C.5: Aria-labelledby
        const ariaLabelledBy = element.getAttribute('aria-labelledby');
        if (ariaLabelledBy) {
            // Handle multiple IDs
            const ids = ariaLabelledBy.split(/\s+/);
            let combinedLabel = '';
            for (const id of ids) {
                const labelElement = document.getElementById(id);
                if (labelElement) combinedLabel += labelElement.innerText + ' ';
            }
            if (combinedLabel.trim()) return combinedLabel.trim();
        }

        // Option C.75: Google Forms
        const listItem = element.closest('[role="listitem"]');
        if (listItem) {
            const heading = listItem.querySelector('[role="heading"]');
            if (heading) return heading.innerText.trim();
            const questionDiv = listItem.querySelector('.freebirdFormviewerComponentsQuestionBaseTitle, [jsname="wSAScd"]');
            if (questionDiv) return questionDiv.innerText.trim();
        }

        // Option D: Preceding Sibling / Parent Sibling Strategy
        // This is crucial for "Select One" dropdowns where the visual label is a sibling of the container
        let container = element;
        let attempts = 0;
        const MAX_DEPTH = 6; // Increased depth

        while (container && attempts < MAX_DEPTH) {
            // 1. Check previous siblings of current container
            let sibling = container.previousElementSibling;
            while (sibling) {
                // Skip invisible elements
                const style = window.getComputedStyle(sibling);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    sibling = sibling.previousElementSibling;
                    continue;
                }

                const tagName = sibling.tagName;
                const text = sibling.innerText ? sibling.innerText.replace(/\s+/g, ' ').trim() : '';
                const lowerText = text.toLowerCase();

                // If explicit label tag
                if (tagName === 'LABEL') return text;

                // If check for "Select One", "Required", etc - skip them and keep looking up/back
                if (lowerText === 'required' || lowerText === '*' || lowerText === 'select one') {
                    sibling = sibling.previousElementSibling;
                    continue;
                }

                // Heuristic: Looks like a label
                // - Not too long
                // - Not a script/style
                // - Not another input
                if (text.length > 0 && text.length < 150 &&
                    !['SCRIPT', 'STYLE', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tagName) &&
                    !lowerText.includes('section')) { // specific exclusion
                    return text;
                }

                // Move back
                sibling = sibling.previousElementSibling;
            }

            // Move up
            container = container.parentElement;
            attempts++;
            if (!container || container.tagName === 'BODY') break;
        }

        return placeholderLabel || null;
    }
};
