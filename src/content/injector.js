window.SpeedyInjector = {
    setValue: function (element, value) {
        if (!element || !value) return;

        // 1. Focus the element
        element.focus();

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

    // Handle "ContentEditable" or other complex inputs if necessary
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
    }
};
