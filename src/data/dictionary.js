window.SpeedyDictionary = {
    // Map profile keys to regex keywords and common selectors
    mapping: {
        "personal.firstName": {
            regex: /first\s*name|given\s*name|fname|legal\s*name/i,
            selectors: ['#first_name', 'input[name="first_name"]', 'input[name="firstName"]', '[autocomplete="given-name"]', '[data-automation-id="legalNameSection_firstName"]', '#user_name']
        },
        "personal.lastName": {
            regex: /last\s*name|surname|lname|family\s*name/i,
            selectors: ['#last_name', 'input[name="last_name"]', 'input[name="lastName"]', '[autocomplete="family-name"]', '[data-automation-id="legalNameSection_lastName"]']
        },
        "personal.email": {
            regex: /email|e-mail/i,
            selectors: ['#email', 'input[name="email"]', '[type="email"]', '[autocomplete="email"]', '[data-automation-id="email"]', '#user_email']
        },
        "personal.phone": {
            regex: /phone|mobile|contact\s*number/i,
            selectors: ['#phone', 'input[name="phone"]', '[type="tel"]', '[autocomplete="tel"]', '[data-automation-id="phone-number"]', '#user_mobile']
        },
        "personal.location": {
            regex: /city|location|address/i,
            selectors: ['#address', '#location', '[autocomplete="address-level2"]']
        },
        "links.linkedin": {
            regex: /linkedin/i,
            selectors: ['input[name*="linkedin"]', '[id*="linkedin"]']
        },
        "links.github": {
            regex: /github/i,
            selectors: ['input[name*="github"]', '[id*="github"]']
        },
        "links.portfolio": {
            regex: /portfolio|website|personal\s*site/i,
            selectors: ['input[name*="website"]', 'input[name*="portfolio"]', '[id*="portfolio"]']
        },
        "links.twitter": {
            regex: /twitter|x\.com/i,
            selectors: ['input[name*="twitter"]']
        },
        "work.noticePeriod": {
            regex: /notice\s*period|how\s*soon/i,
            selectors: ['input[name*="notice"]', 'select[name*="notice"]']
        },
        "work.currentCtc": {
            regex: /current\s*ctc|current\s*salary|current\s*compensation/i,
            selectors: ['input[name*="ctc"]', 'input[name*="salary"]']
        },
        "work.expectedCtc": {
            regex: /expected\s*ctc|expected\s*salary|expectation/i,
            selectors: ['input[name*="expected"]']
        },
        "work.experience": {
            regex: /years\s*of\s*experience|total\s*experience/i,
            selectors: ['input[name*="experience"]', 'select[name*="experience"]']
        }
    }
};
