window.SpeedyInjector = {
    setValue: function (element, value, key) {
        if (!element || !value) return;

        let finalValue = value;

        // --- Formatting Logic ---
        // 1. Date Formatting
        if (element.type === 'date') {
            // HTML5 date input expects YYYY-MM-DD
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                finalValue = date.toISOString().split('T')[0];
            }
        } else if (key && (key.includes('Date') || key.includes('start') || key.includes('end') || key.includes('dob'))) {
            // Text input but identified as a date field (common in Workday/ATS)
            // Default to MM/DD/YYYY
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();

                // Check if placeholder suggests otherwise (e.g. DD/MM/YYYY)
                if (element.placeholder && element.placeholder.includes('DD/MM')) {
                    finalValue = `${day}/${month}/${year}`;
                } else {
                    // Default to US format (Workday standard)
                    finalValue = `${month}/${day}/${year}`;
                }
            }
        }

        // 2. Phone Formatting
        if (element.type === 'tel' || element.name.includes('phone') || element.name.includes('mobile')) {
            // Optional: Implement phone formatting if needed
        }

        // --- Injection ---
        this.applyValue(element, finalValue);
    },

    // Handle "Select" elements
    setSelectValue: function (element, value, key) {
        // --- Special Handling for Split Dates (Month / Year) ---
        if (key && (key.includes('Date') || key.includes('start') || key.includes('end') || key.includes('dob'))) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const year = date.getFullYear().toString();
                const monthIndex = date.getMonth(); // 0-11
                const monthName = date.toLocaleString('default', { month: 'long' }); // "February"
                const monthShort = date.toLocaleString('default', { month: 'short' }); // "Feb"
                const monthNum = String(monthIndex + 1); // "2"
                const monthNumPad = String(monthIndex + 1).padStart(2, '0'); // "02"

                const options = Array.from(element.options);

                // Heuristic: Is this a Year selector?
                // Check if any option value looks like a recent year (1900-2099)
                const hasYears = options.some(opt => /^(19|20)\d{2}$/.test(opt.value) || /^(19|20)\d{2}$/.test(opt.text));

                if (hasYears) {
                    // Try to match Year
                    const yearMatch = options.find(opt => opt.value === year || opt.text === year);
                    if (yearMatch) {
                        element.value = yearMatch.value;
                        this.triggerEvents(element);
                        return;
                    }
                } else {
                    // Assume Month selector
                    // Try to match Month (Name, Short Name, Number)
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

    // Handle Custom Dropdowns (Div/Button based)
    setCustomDropdownValue: function (element, value, key) {
        element.click();

        setTimeout(() => {
            const listboxId = element.getAttribute('aria-controls');
            let listbox = listboxId ? document.getElementById(listboxId) : null;

            if (!listbox) {
                const listboxes = document.querySelectorAll('[role="listbox"]');
                for (let box of listboxes) {
                    if (box.offsetParent !== null) { // visible
                        listbox = box;
                        break;
                    }
                }
            }

            if (listbox) {
                const options = listbox.querySelectorAll('[role="option"], li');
                const valStr = String(value).toLowerCase();

                for (let opt of options) {
                    if (opt.innerText.toLowerCase().includes(valStr)) {
                        opt.click();
                        console.log("SpeedyApply: Clicked custom option", opt.innerText);
                        break;
                    }
                }
            }
        }, 300);
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
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }
};
