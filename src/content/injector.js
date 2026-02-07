window.SpeedyInjector = {
    setValue: function (element, value) {
        if (!element || !value) return;

        let finalValue = value;

        // --- Formatting Logic ---
        // 1. Date Formatting
        if (element.type === 'date') {
            // HTML5 date input expects YYYY-MM-DD
            // Assuming profile value is somewhat standard, but let's try to parse
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                finalValue = date.toISOString().split('T')[0];
            }
        } else if (element.placeholder && (element.placeholder.includes('MM/DD') || element.placeholder.includes('DD/MM'))) {
            // Text input expecting date
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();

                if (element.placeholder.includes('MM/DD')) {
                    finalValue = `${month}/${day}/${year}`;
                } else if (element.placeholder.includes('DD/MM')) {
                    finalValue = `${day}/${month}/${year}`;
                }
            }
        }

        // 2. Phone Formatting
        if (element.type === 'tel' || element.name.includes('phone') || element.name.includes('mobile')) {
            // Strip non-digits for cleaner input if needed, or format as (XXX) XXX-XXXX
            // For now, let's keep it simple: if it looks like US number (10 digits), maybe format?
            // Some forms hate formatting, some require it.
            // Safe bet: Just digits if it contains non-digits in profile
            // finalValue = value.replace(/\D/g, ''); 
            // actually, let's leave it as is from profile unless user complains.
        }

        // --- Injection ---

        // 1. Focus the element (without scrolling)
        element.focus({ preventScroll: true });

        // 2. Set the value
        // React overrides the setter, so we need to call the native setter
        const proto = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        if (prototypeValueSetter && element.value !== finalValue) {
            prototypeValueSetter.call(element, finalValue);
        } else {
            element.value = finalValue;
        }

        // 3. Dispatch events to trigger state updates (React/Angular/Vue context)
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // 4. Blur to trigger validation
        element.blur();
    },

    // Handle "Select" elements
    setSelectValue: function (element, value) {
        // Simple string match for options
        const options = Array.from(element.options);
        const bestMatch = options.find(opt =>
            opt.value.toLowerCase().includes(value.toLowerCase()) ||
            opt.text.toLowerCase().includes(value.toLowerCase())
        );

        if (bestMatch) {
            element.value = bestMatch.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('input', { bubbles: true })); // Added input event
        }
    },

    // Handle Custom Dropdowns (Div/Button based)
    setCustomDropdownValue: function (element, value) {
        // 1. Click to open
        element.click();

        // 2. Wait for list (heuristic)
        // We can't easily wait async here without complicating flow, 
        // but we can try immediate search or use a short timeout approach if the architecture allows.
        // Since we are not async/awaiting in the main loop easily, we'll try a detached mutation observer or just a quick check.
        // Many dropdowns open synchronously or very fast.

        setTimeout(() => {
            // Look for list items
            // ARIA listbox?
            const listboxId = element.getAttribute('aria-controls');
            let listbox = listboxId ? document.getElementById(listboxId) : null;

            // If no explicit listbox, look for nearby ul/divs that became visible
            if (!listbox) {
                // heuristic: look for role="listbox" in document
                const listboxes = document.querySelectorAll('[role="listbox"]');
                // find the one that is visible
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

    setRadioValue: function (element, value) {
        const valStr = String(value).toLowerCase();
        const elVal = element.value.toLowerCase();

        // Check 1: Value match
        if (elVal === valStr) {
            element.click();
            element.checked = true;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        // Check 2: Label match (heuristic)
        // Check standard label
        if (element.labels && element.labels.length > 0) {
            if (element.labels[0].innerText.toLowerCase().includes(valStr)) {
                element.click();
                element.checked = true;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        }

        // Check parent text if wrapped
        const parent = element.closest('label');
        if (parent && parent.innerText.toLowerCase().includes(valStr)) {
            element.click();
            element.checked = true;
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    },

    setCheckboxValue: function (element, value) {
        const shouldBeChecked = (value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'yes');
        if (element.checked !== shouldBeChecked) {
            element.click();
            element.checked = shouldBeChecked;
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
};
