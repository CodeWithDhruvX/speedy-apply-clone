window.SpeedyInjector = {
    // Helper to simulate realistic typing
    simulateTyping: async function (element, value) {
        if (!element) return;
        element.focus();

        // Clear existing value if needed (optional, depends on use case)
        // element.value = ''; 

        const events = ['keydown', 'keypress', 'input', 'keyup'];
        const key = value.length > 0 ? value[value.length - 1] : ''; // Approximation

        // 1. Dispatch Events
        events.forEach(eventType => {
            const event = new KeyboardEvent(eventType, {
                key: key,
                code: 'Key' + key.toUpperCase(),
                bubbles: true,
                cancelable: true,
                composed: true
            });
            element.dispatchEvent(event);
        });

        // 2. Set Value Prototypically
        const proto = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        if (prototypeValueSetter && element.value !== value) {
            prototypeValueSetter.call(element, value);
        } else {
            element.value = value;
        }

        // 3. Dispatch Input/Change again to be sure
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    },

    setValue: async function (element, value, key) {
        if (!element || !value) return;
        if (element.type === 'file') return;

        let finalValue = value;

        // --- Formatting Logic ---
        // 1. Date Formatting
        if (element.type === 'date') {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                finalValue = date.toISOString().split('T')[0];
            }
        } else if (key && (key.includes('Date') || key.includes('start') || key.includes('end') || key.includes('dob'))) {
            // Text input but identified as a date field
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();

                const placeholder = (element.placeholder || '').toLowerCase();
                const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();

                if (placeholder.includes('mm/yyyy') || placeholder.includes('mm/yy') || ariaLabel.includes('mm/yyyy')) {
                    finalValue = `${month}/${year}`;
                } else if (placeholder.includes('dd/mm')) {
                    finalValue = `${day}/${month}/${year}`;
                } else {
                    finalValue = `${month}/${day}/${year}`;
                }
            }
        }

        // --- Injection ---
        // For search inputs (often used in Education/University), try typing simulation
        if (key && (key.includes('school') || key.includes('university') || key.includes('company') || key.includes('location'))) {
            // Heuristic: If it looks like a search box (combobox, no type/text type), simulate typing
            const isCombobox = element.getAttribute('role') === 'combobox' || element.getAttribute('aria-autocomplete') === 'list';
            if (isCombobox || element.type === 'text') {
                // Try simple set first, but if it clears or doesn't trigger, we might need typing.
                // For now, let's stick to robust setting + events.
                await this.simulateTyping(element, finalValue);
            } else {
                this.applyValue(element, finalValue);
            }
        } else {
            this.applyValue(element, finalValue);
        }
    },

    // Handle "Select" elements
    setSelectValue: function (element, value, key) {
        // --- Split Dates (Month / Year) ---
        if (key && (key.includes('Date') || key.includes('start') || key.includes('end') || key.includes('dob'))) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear().toString();
                const monthIndex = date.getMonth();
                const monthName = date.toLocaleString('default', { month: 'long' });
                const monthShort = date.toLocaleString('default', { month: 'short' });
                const monthNum = String(monthIndex + 1);
                const monthNumPad = String(monthIndex + 1).padStart(2, '0');

                const options = Array.from(element.options);
                const hasYears = options.some(opt => /^(19|20)\d{2}$/.test(opt.value) || /^(19|20)\d{2}$/.test(opt.text));

                if (hasYears) {
                    const yearMatch = options.find(opt => opt.value === year || opt.text === year);
                    if (yearMatch) {
                        element.value = yearMatch.value;
                        this.triggerEvents(element);
                        return;
                    }
                } else {
                    const monthMatch = options.find(opt => {
                        const t = opt.text.trim().toLowerCase();
                        const v = opt.value.trim().toLowerCase();
                        return (
                            t === monthName.toLowerCase() || v === monthName.toLowerCase() ||
                            t === monthShort.toLowerCase() || v === monthShort.toLowerCase() ||
                            v === monthNum || t === monthNum ||
                            v === monthNumPad || t === monthNumPad
                        );
                    });

                    if (monthMatch) {
                        element.value = monthMatch.value;
                        this.triggerEvents(element);
                        return;
                    }
                }
            }
        }

        // Standard String Match Fallback
        const options = Array.from(element.options);
        const bestMatch = options.find(opt =>
            opt.value.toLowerCase().includes(value.toLowerCase()) ||
            opt.text.toLowerCase().includes(value.toLowerCase())
        );

        if (bestMatch) {
            element.value = bestMatch.value;
            this.triggerEvents(element);
        }
    },

    // Handle Custom Dropdowns (Div/Button based) & Searchable lists
    setCustomDropdownValue: async function (element, value, key) {
        element.focus();
        element.click();

        // If it's an input inside a custom dropdown wrapper, type in it
        if (element.tagName === 'INPUT') {
            await this.simulateTyping(element, value);
        }

        setTimeout(() => {
            // Strategy A: aria-controls
            const listboxId = element.getAttribute('aria-controls');
            let listbox = listboxId ? document.getElementById(listboxId) : null;

            // Strategy B: find visible listbox
            if (!listbox) {
                const listboxes = document.querySelectorAll('[role="listbox"]');
                for (let box of listboxes) {
                    if (box.offsetParent !== null) { // visible
                        listbox = box;
                        break;
                    }
                }
            }

            // Strategy C: Workday / Greenhouse specific containers
            // If no listbox found, look for typical dropdown containers near the element
            if (!listbox) {
                // Greenhouse often uses <ul> with classes
                const nextUl = element.parentElement.querySelector('ul');
                if (nextUl) listbox = nextUl;
            }

            if (listbox) {
                const options = listbox.querySelectorAll('[role="option"], li, div[class*="option"]');
                const valStr = String(value).toLowerCase();
                let clicked = false;

                // 1. Exact Match First
                for (let opt of options) {
                    if (opt.innerText.trim().toLowerCase() === valStr) {
                        opt.click();

                        clicked = true;
                        break;
                    }
                }

                // 2. Partial Match
                if (!clicked) {
                    for (let opt of options) {
                        if (opt.innerText.toLowerCase().includes(valStr)) {
                            opt.click();

                            clicked = true;
                            break;
                        }
                    }
                }
            } else {
                // Fallback: Dispatch Enter key to select first result if typing happened
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', which: 13, bubbles: true
                });
                element.dispatchEvent(enterEvent);
            }
        }, 500); // Increased wait time for network results
    },

    setRadioValue: function (element, value, key) {
        const valStr = String(value).toLowerCase();
        const elVal = element.value.toLowerCase();

        if (elVal === valStr) {
            element.click();
            element.checked = true;
            this.triggerEvents(element);
            return;
        }

        if (element.labels && element.labels.length > 0) {
            if (element.labels[0].innerText.toLowerCase().includes(valStr)) {
                element.click();
                element.checked = true;
                this.triggerEvents(element);
                return;
            }
        }

        const parent = element.closest('label');
        if (parent && parent.innerText.toLowerCase().includes(valStr)) {
            element.click();
            element.checked = true;
            this.triggerEvents(element);
        }
    },

    setCheckboxValue: function (element, value, key) {
        const shouldBeChecked = (value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'yes');
        if (element.checked !== shouldBeChecked) {
            element.click();
            element.checked = shouldBeChecked;
            this.triggerEvents(element);
        }
    },

    // Helpers
    applyValue: function (element, finalValue) {
        element.focus({ preventScroll: true });

        const proto = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        if (prototypeValueSetter && element.value !== finalValue) {
            prototypeValueSetter.call(element, finalValue);
        } else {
            element.value = finalValue;
        }

        this.triggerEvents(element);
        element.blur();
    },

    triggerEvents: function (element) {
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
    }
};
