window.SpeedyDictionary = {
    // Map profile keys to regex keywords and common selectors
    mapping: {
        "personal.firstName": {
            regex: /first\s*name|given\s*name|fname|legal\s*name/i,
            selectors: ['#first_name', 'input[name="first_name"]', 'input[name="firstName"]', '[autocomplete="given-name"]', '[data-automation-id="legalNameSection_firstName"]', '#user_name', 'input[name="job_application[first_name]"]', '[name="name"]'] // Added Greenhouse, generic name
        },
        "personal.lastName": {
            regex: /last\s*name|surname|lname|family\s*name/i,
            selectors: ['#last_name', 'input[name="last_name"]', 'input[name="lastName"]', '[autocomplete="family-name"]', '[data-automation-id="legalNameSection_lastName"]', 'input[name="job_application[last_name]"]'] // Added Greenhouse
        },
        "personal.email": {
            regex: /email|e-mail/i,
            selectors: ['#email', 'input[name="email"]', '[type="email"]', '[autocomplete="email"]', '[data-automation-id="email"]', '#user_email', 'input[name="job_application[email]"]'] // Added Greenhouse
        },
        "personal.phone": {
            regex: /phone(?!.*code)|mobile|contact\s*number/i,
            selectors: ['#phone', 'input[name="phone"]', '[type="tel"]', '[autocomplete="tel"]', '[data-automation-id="phone-number"]', '#user_mobile', 'input[name="job_application[phone]"]', 'input[name="mobile"]', 'input[name="mobile_number"]'] // Added Greenhouse, Instahyre, Foundit
        },

        // Address Components - MOVED UP to prioritize over generic Location
        "personal.street": {
            regex: /^address\s*line\s*1$|^street$|^address1$|^address$/i,
            selectors: ['input[name*="address"]', 'input[name*="street"]', '[autocomplete="address-line1"]', '[data-automation-id="addressSection_addressLine1"]', '[data-automation-id="addressLine1"]']
        },
        "personal.city": {
            regex: /city|town|location\s*\(?city\)?/i,
            selectors: ['input[name*="city"]', 'input[name*="town"]', '[autocomplete="address-level2"]', '[data-automation-id="addressSection_city"]', '[data-automation-id="city"]']
        },
        "personal.state": {
            regex: /state|province|region|county/i,
            selectors: ['input[name*="state"]', 'input[name*="province"]', '[autocomplete="address-level1"]', '[data-automation-id="addressSection_region"]', '[data-automation-id="region"]']
        },
        "personal.zip": {
            regex: /zip\s*code|postal\s*code|pincode|zip/i,
            selectors: ['input[name*="zip"]', 'input[name*="postal"]', '[autocomplete="postal-code"]', '[data-automation-id="addressSection_postalCode"]', '[data-automation-id="postalCode"]']
        },
        "personal.country": {
            regex: /country/i,
            selectors: ['input[name*="country"]', 'select[name*="country"]', '[autocomplete="country"]', '[data-automation-id="addressSection_countryRegion"]', '[data-automation-id="countryRegion"]']
        },

        // Generic Location (Fallback)
        "personal.location": {
            regex: /location|residence/i, // Removed 'city' from here
            selectors: ['#address', '#location', '[autocomplete="address-level2"]', 'input[name="job_application[location]"]', 'input[name="current_location"]'] // Added Greenhouse, generic
        },

        "links.linkedin": {
            regex: /linkedin/i,
            selectors: ['input[name*="linkedin"]', '[id*="linkedin"]', 'input[name="job_application[answers][][text_value]"]'] // Note: Greenhouse often uses custom IDs for questions, this is a best guess for standard questions
        },
        "links.github": {
            regex: /github/i,
            selectors: ['input[name*="github"]', '[id*="github"]']
        },
        "links.portfolio": {
            regex: /portfolio|website|personal\s*site/i,
            selectors: ['input[name*="website"]', 'input[name*="portfolio"]', '[id*="portfolio"]', 'input[name="urls[Portfolio]"]'] // Added Lever
        },
        "links.twitter": {
            regex: /twitter|x\.com/i,
            selectors: ['input[name*="twitter"]']
        },
        "preferences.noticePeriod": {
            regex: /notice\s*period|how\s*soon/i,
            selectors: ['input[name*="notice"]', 'select[name*="notice"]', 'input[name="notice_period"]'] // Added Lever/Generic
        },
        "preferences.currentCtc": {
            regex: /current\s*ctc|current\s*salary|current\s*compensation/i,
            selectors: ['input[name*="ctc"]', 'input[name*="salary"]', 'input[name="current_ctc"]'] // Added Generic/Lever
        },
        "preferences.expectedCtc": {
            regex: /expected\s*ctc|expected\s*salary|expectation/i,
            selectors: ['input[name*="expected"]', 'input[name="expected_ctc"]'] // Added Generic/Lever
        },
        "preferences.experience": {
            regex: /years\s*of\s*experience|total\s*experience/i,
            selectors: ['input[name*="experience"]', 'select[name*="experience"]', 'input[name="experience_years"]']
        },
        // Education
        "education.school": {
            regex: /school|university|college|institution|board/i,
            selectors: ['input[name*="school"]', 'input[name*="university"]', 'input[name*="college"]', '[id*="education"]', 'input[name="education[school_name]"]'] // Added Greenhouse
        },
        "education.degree": {
            regex: /degree|qualification|certification/i,
            selectors: ['input[name*="degree"]', 'select[name*="degree"]', 'input[name="education[degree]"]'] // Added Greenhouse
        },
        "education.field": {
            regex: /major|field\s*of\s*study|specialization/i,
            selectors: ['input[name*="major"]', 'input[name*="field"]', 'input[name="education[discipline]"]'] // Added Greenhouse
        },
        // Work
        "work.company": {
            regex: /company|employer|organization/i,
            selectors: ['input[name*="company"]', 'input[name*="employer"]', 'input[name="job_application[employment][][company_name]"]', 'input[name="org"]', 'input[name="current-company"]'] // Added Greenhouse, Lever
        },
        "work.title": {
            regex: /job\s*title|role|position|designation/i,
            selectors: ['input[name*="title"]', 'input[name*="role"]', 'input[name="job_application[employment][][title]"]'] // Added Greenhouse
        },
        "work.startDate": {
            regex: /start\s*date|from/i,
            selectors: ['input[name*="start"]', 'input[name*="from"]', 'input[name="job_application[employment][][start_date]"]'] // Added Greenhouse
        },
        "work.endDate": {
            regex: /end\s*date|to/i,
            selectors: ['input[name*="end"]', 'input[name*="to"]', 'input[name="job_application[employment][][end_date]"]'] // Added Greenhouse
        },
        "work.description": {
            regex: /description|responsibilities|duties/i,
            selectors: ['textarea[name*="description"]', 'textarea[name*="responsibilities"]', 'textarea[name="job_application[employment][][notes]"]'] // Added Greenhouse
        },
        // Legal & Authorization
        "legal.authorized": {
            regex: /authorized\s*to\s*work|legally\s*authorized/i,
            selectors: ['input[name*="authorized"]', 'input[name*="legal"]', '[data-automation-id*="authorized"]']
        },
        "legal.sponsorship": {
            regex: /sponsorship|visa/i,
            selectors: ['input[name*="sponsorship"]', 'input[name*="visa"]', '[data-automation-id*="sponsorship"]']
        },
        // EEOC / Demographics
        "eeoc.gender": {
            regex: /gender|sex/i,
            selectors: ['input[name*="gender"]', 'select[name*="gender"]', '[data-automation-id="gender"]', 'select[name="job_application[gender]"]'] // Added Greenhouse
        },
        "eeoc.race": {
            regex: /race|ethnicity/i,
            selectors: ['input[name*="race"]', 'select[name*="race"]', 'select[name*="ethnicity"]', '[data-automation-id="race"]', 'select[name="job_application[race]"]'] // Added Greenhouse
        },
        "eeoc.veteran": {
            regex: /veteran/i,
            selectors: ['input[name*="veteran"]', 'select[name*="veteran"]', '[data-automation-id="veteran"]', 'select[name="job_application[veteran_status]"]'] // Added Greenhouse
        },
        "eeoc.disability": {
            regex: /disability/i,
            selectors: ['input[name*="disability"]', 'select[name*="disability"]', '[data-automation-id="disability"]', 'select[name="job_application[disability_status]"]'] // Added Greenhouse
        },
        // Profile Enhancements
        "profile.skills": {
            regex: /skills|technologies/i,
            selectors: ['input[name*="skills"]', 'textarea[name*="skills"]', '[data-automation-id="skills"]']
        },
        "profile.summary": {
            regex: /summary|headline|bio|about\s*me/i,
            selectors: ['textarea[name*="summary"]', 'textarea[name*="bio"]', 'textarea[name*="about"]', '[data-automation-id="summary"]']
        },
        "documents.coverLetter": {
            regex: /cover\s*letter|cl/i,
            selectors: ['textarea[name*="cover"]', 'textarea[name*="letter"]', '[data-automation-id="coverLetter"]']
        },
        "preferences.referral": {
            regex: /how\s*did\s*you\s*hear|source/i,
            selectors: ['select[name*="source"]', 'input[name*="source"]', '[data-automation-id="source"]']
        },
        "preferences.relocation": {
            regex: /relocate|relocation/i,
            selectors: ['input[name*="relocat"]', 'select[name*="relocat"]', '[data-automation-id="relocation"]']
        },
        "eeoc.pronouns": {
            regex: /pronoun/i,
            selectors: ['input[name*="pronoun"]', 'select[name*="pronoun"]', '[data-automation-id="pronouns"]']
        }
    }
};
