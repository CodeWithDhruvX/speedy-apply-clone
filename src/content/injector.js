window.SpeedyInjector = {
    setValue: function (element, value) {
        if (!element || !value) return;

        // 1. Focus the element (without scrolling)
        element.focus({ preventScroll: true });

        // 2. Set the value
        // React overrides the setter, so we need to call the native setter
        const proto = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

        if (prototypeValueSetter && element.value !== value) {
            prototypeValueSetter.call(element, value);
        } else {
            element.value = value;
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
        }
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
