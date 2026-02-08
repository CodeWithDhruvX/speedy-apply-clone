window.SpeedyDictionary = {
    // Map profile keys to regex keywords and common selectors
    mapping: {
        "personal.firstName": {
            regex: /first\s*name|given\s*name|fname/i,
            selectors: ['#first_name', 'input[name="first_name"]', 'input[name="firstName"]', '[autocomplete="given-name"]', '[data-automation-id="legalNameSection_firstName"]', '#user_name', 'input[name="job_application[first_name]"]', '[name="name"]', 'input[name="candidate_name"]', 'input[name="user_name"]', '#applicant\.firstName', 'input[name*="applicant"][name*="first"]', 'input[name^="entry."][type="text"]'] // Added Greenhouse, generic name, Hirist, Indeed, Google Forms
        },
        "personal.lastName": {
            regex: /last\s*name|surname|lname|family\s*name/i,
            selectors: ['#last_name', 'input[name="last_name"]', 'input[name="lastName"]', '[autocomplete="family-name"]', '[data-automation-id="legalNameSection_lastName"]', 'input[name="job_application[last_name]"]', '#applicant\.lastName', 'input[name*="applicant"][name*="last"]', 'input[name^="entry."][type="text"]'] // Added Greenhouse, Indeed, Google Forms
        },
        "personal.fullName": {
            regex: /^full\s*name|complete\s*name|legal\s*name|name\s*\(.*first.*last.*\)/i,
            selectors: ['input[name*="full"]', 'input[name*="fullname"]', 'input[name="name"]', 'input[name^="entry."][type="text"]', 'input[aria-label*="full name" i]', 'input[aria-label*="legal name" i]']
        },
        "personal.email": {
            regex: /email|e-mail/i,
            selectors: ['#email', 'input[name="email"]', '[type="email"]', '[autocomplete="email"]', '[data-automation-id="email"]', '#user_email', 'input[name="job_application[email]"]', '#applicant\.email', 'input[name*="applicant"][name*="email"]', 'input[name^="entry."][type="email"]'] // Added Greenhouse, Indeed, Google Forms
        },
        "personal.phone": {
            regex: /phone(?!.*code)|mobile|contact\s*number|contact\s*no/i,
            selectors: ['#phone', 'input[name="phone"]', '[type="tel"]', '[autocomplete="tel"]', '[data-automation-id="phone-number"]', '#user_mobile', 'input[name="job_application[phone]"]', 'input[name="mobile"]', 'input[name="mobile_number"]', 'input[name="phone_no"]', 'input[name="contact_number"]', '#applicant\.phoneNumber', 'input[name*="applicant"][name*="phone"]', 'input[name^="entry."][type="tel"]', 'input[aria-label*="contact" i]', 'input[aria-label*="phone" i]', 'input[aria-label*="mobile" i]'] // Added Greenhouse, Instahyre, Foundit, Hirist, Indeed, Google Forms
        },

        // Address Components - MOVED UP to prioritize over generic Location
        "personal.street": {
            regex: /^address\s*line\s*1$|^street$|^address1$|^address$/i,
            selectors: ['input[name*="address"]', 'input[name*="street"]', '[autocomplete="address-line1"]', '[data-automation-id="addressSection_addressLine1"]', '[data-automation-id="addressLine1"]', 'input[name^="entry."][type="text"]', 'textarea[name^="entry."]']
        },
        "personal.city": {
            regex: /city|town|location\s*\(?city\)?/i,
            selectors: ['input[name*="city"]', 'input[name*="town"]', '[autocomplete="address-level2"]', '[data-automation-id="addressSection_city"]', '[data-automation-id="city"]', '#applicant\\.city', 'input[name*="applicant"][name*="city"]', 'input[name^="entry."][type="text"]']
        },
        "personal.state": {
            regex: /state|province|region|county/i,
            selectors: ['input[name*="state"]', 'input[name*="province"]', '[autocomplete="address-level1"]', '[data-automation-id="addressSection_region"]', '[data-automation-id="region"]', 'input[name^="entry."][type="text"]']
        },
        "personal.zip": {
            regex: /zip\s*code|postal\s*code|pincode|zip/i,
            selectors: ['input[name*="zip"]', 'input[name*="postal"]', '[autocomplete="postal-code"]', '[data-automation-id="addressSection_postalCode"]', '[data-automation-id="postalCode"]', 'input[name^="entry."][type="text"]']
        },
        "personal.country": {
            regex: /country/i,
            selectors: ['input[name*="country"]', 'select[name*="country"]', '[autocomplete="country"]', '[data-automation-id="addressSection_countryRegion"]', '[data-automation-id="countryRegion"]', 'input[name^="entry."][type="text"]']
        },

        // Generic Location (Fallback)
        "personal.location": {
            regex: /location|residence/i, // Removed 'city' from here
            selectors: ['#address', '#location', '[autocomplete="address-level2"]', 'input[name="job_application[location]"]', 'input[name="current_location"]', 'input[name="current_city"]', 'input[name="job_location"]', '#applicant\.address', 'input[name*="applicant"][name*="address"]', 'input[name*="applicant"][name*="location"]', 'input[name^="entry."][type="text"]', 'textarea[name^="entry."]'] // Added Greenhouse, generic, Hirist, Indeed, Google Forms
        },

        "links.linkedin": {
            regex: /linkedin/i,
            selectors: ['input[name*="linkedin"]', '[id*="linkedin"]', 'input[name="job_application[answers][][text_value]"]', 'input[name*="applicant"][name*="linkedin"]', 'input[name^="entry."][type="url"]', 'input[name^="entry."][type="text"]'] // Note: Greenhouse often uses custom IDs for questions, this is a best guess for standard questions. Indeed added. Google Forms
        },
        "links.github": {
            regex: /github/i,
            selectors: ['input[name*="github"]', '[id*="github"]', 'input[name^="entry."][type="url"]', 'input[name^="entry."][type="text"]']
        },
        "links.portfolio": {
            regex: /portfolio|website|personal\s*site/i,
            selectors: ['input[name*="website"]', 'input[name*="portfolio"]', '[id*="portfolio"]', 'input[name="urls[Portfolio]"]', 'input[name^="entry."][type="url"]', 'input[name^="entry."][type="text"]'] // Added Lever, Google Forms
        },
        "links.twitter": {
            regex: /twitter|x\.com/i,
            selectors: ['input[name*="twitter"]', 'input[name^="entry."][type="url"]', 'input[name^="entry."][type="text"]']
        },
        "preferences.noticePeriod": {
            regex: /notice\s*period|how\s*soon/i,
            selectors: ['input[name*="notice"]', 'select[name*="notice"]', 'input[name="notice_period"]', 'input[name^="entry."][type="text"]'] // Added Lever/Generic, Google Forms
        },
        "preferences.currentCtc": {
            regex: /current\s*ctc|current\s*salary|current\s*compensation|ctc\s*\(|your\s*ctc/i,
            selectors: ['input[name*="ctc"]', 'input[name*="salary"]', 'input[name="current_ctc"]', 'input[name^="entry."][type="text"]', 'input[name^="entry."][type="number"]'] // Added Generic/Lever/Indeed, Google Forms
        },
        "preferences.expectedCtc": {
            regex: /expected\s*ctc|expected\s*salary|expectation|expecting/i,
            selectors: ['input[name*="expected"]', 'input[name="expected_ctc"]', 'input[name^="entry."][type="text"]', 'input[name^="entry."][type="number"]'] // Added Generic/Lever, Google Forms
        },
        "preferences.experience": {
            regex: /years\s*of\s*experience|total\s*experience|overall\s*years?\s*of\s*experience|how\s*much\s*is\s*your\s*overall|experience\s*\*/i,
            selectors: ['input[name*="experience"]', 'select[name*="experience"]', 'input[name="experience_years"]', 'input[name="total_experience"]', 'select[name="total_experience"]', 'input[name^="entry."][type="text"]', 'input[name^="entry."][type="number"]'] // Hirist/Indeed, Google Forms
        },
        "preferences.techExperience": {
            regex: /experience\s*in\s*(frontend|backend|react|angular|vue|node|python|java|\.net|full[\s-]?stack)/i,
            selectors: ['input[name*="frontend"]', 'input[name*="backend"]', 'input[name*="tech"]', 'input[name*="stack"]', 'input[name^="entry."][type="text"]', 'textarea[name^="entry."]']
        },
        // Education
        "education.school": {
            regex: /school|university|college|institution|board/i,
            selectors: ['input[name*="school"]', 'input[name*="university"]', 'input[name*="college"]', '[id*="education"]', 'input[name="education[school_name]"]', 'input[name^="entry."][type="text"]', '[data-automation-id="educationSection_school"]', '[data-automation-id="school"]'] // Added Greenhouse, Google Forms, Workday
        },
        "education.degree": {
            regex: /degree|qualification|certification/i,
            selectors: ['input[name*="degree"]', 'select[name*="degree"]', 'input[name="education[degree]"]', 'input[name^="entry."][type="text"]', '[data-automation-id="educationSection_degree"]', '[data-automation-id="degree"]'] // Added Greenhouse, Google Forms, Workday
        },
        "education.field": {
            regex: /major|field\s*of\s*study|specialization/i,
            selectors: ['input[name*="major"]', 'input[name*="field"]', 'input[name="education[discipline]"]', 'input[name^="entry."][type="text"]', '[data-automation-id="educationSection_fieldOfStudy"]', '[data-automation-id="fieldOfStudy"]'] // Added Greenhouse, Google Forms, Workday
        },
        // Work
        "work.company": {
            regex: /company|employer|organization|enter.*company/i,
            selectors: [
                'input[name*="company"]',
                'input[name*="employer"]',
                'input[id*="company"]',
                'input[placeholder*="company" i]',
                'input[aria-label*="company" i]',
                'input[name="job_application[employment][][company_name]"]',
                'input[name="org"]',
                'input[name="current-company"]',
                'input[name^="entry."][type="text"]',
                '[data-automation-id="jobHistorySection_companyName"]',
                '[data-automation-id="company"]',
                '[data-automation-id="companyName"]'
            ] // Greenhouse, Lever, Indeed, Google Forms
        },
        "work.title": {
            regex: /job\s*title|position|designation|enter.*job|role(?!.*description|.*responsibilities)/i,
            selectors: [
                'input[name*="title"]',
                'input[name*="role"]',
                'input[name*="position"]',
                'input[id*="job"][id*="title"]',
                'input[id*="jobtitle"]',
                'input[placeholder*="job title" i]',
                'input[placeholder*="job" i][placeholder*="title" i]',
                'input[aria-label*="job title" i]',
                'input[name="job_application[employment][][title]"]',
                'input[name^="entry."][type="text"]',
                '[data-automation-id="jobHistorySection_title"]',
                '[data-automation-id="jobTitle"]',
                '[data-automation-id="title"]'
            ] // Greenhouse, Indeed, Google Forms
        },
        "work.startDate": {
            regex: /start\s*date|from/i,
            selectors: ['input[name*="start"]', 'select[name*="start"]', 'input[name*="from"]', 'select[name*="from"]', 'input[name="job_application[employment][][start_date]"]', 'input[name^="entry."][type="date"]', 'input[name^="entry."][type="text"]', '[data-automation-id="jobHistorySection_startDate"]', '[data-automation-id="startDate"]'] // Added Greenhouse, Google Forms, Workday
        },
        "work.endDate": {
            regex: /end\s*date|to/i,
            selectors: ['input[name*="end"]', 'select[name*="end"]', 'input[name*="to"]', 'select[name*="to"]', 'input[name="job_application[employment][][end_date]"]', 'input[name^="entry."][type="date"]', 'input[name^="entry."][type="text"]', '[data-automation-id="jobHistorySection_endDate"]', '[data-automation-id="endDate"]'] // Added Greenhouse, Google Forms, Workday
        },
        "work.description": {
            regex: /role\s*description|description|responsibilities|duties/i,
            selectors: ['textarea[name*="description"]', 'textarea[name*="responsibilities"]', 'textarea[name="job_application[employment][][notes]"]', 'textarea[name^="entry."]', 'div[role="textbox"]', 'input[name*="description"]', '[data-automation-id="jobHistorySection_description"]', '[data-automation-id="description"]'] // Added Greenhouse, Google Forms, Rich Text Editors, Workday
        },
        // Legal & Authorization
        "legal.authorized": {
            regex: /authorized\s*to\s*work|legally\s*authorized/i,
            selectors: ['input[name*="authorized"]', 'input[name*="legal"]', '[data-automation-id*="authorized"]', 'input[name^="entry."]']
        },
        "legal.sponsorship": {
            regex: /sponsorship|visa/i,
            selectors: ['input[name*="sponsorship"]', 'input[name*="visa"]', '[data-automation-id*="sponsorship"]', 'input[name^="entry."]']
        },
        // EEOC / Demographics
        "eeoc.gender": {
            regex: /gender|sex/i,
            selectors: ['input[name*="gender"]', 'select[name*="gender"]', '[data-automation-id="gender"]', 'select[name="job_application[gender]"]', 'input[name^="entry."]'] // Added Greenhouse, Google Forms
        },
        "eeoc.race": {
            regex: /race|ethnicity/i,
            selectors: ['input[name*="race"]', 'select[name*="race"]', 'select[name*="ethnicity"]', '[data-automation-id="race"]', 'select[name="job_application[race]"]', 'input[name^="entry."]'] // Added Greenhouse, Google Forms
        },
        "eeoc.veteran": {
            regex: /veteran/i,
            selectors: ['input[name*="veteran"]', 'select[name*="veteran"]', '[data-automation-id="veteran"]', 'select[name="job_application[veteran_status]"]', 'input[name^="entry."]'] // Added Greenhouse, Google Forms
        },
        "eeoc.disability": {
            regex: /disability/i,
            selectors: ['input[name*="disability"]', 'select[name*="disability"]', '[data-automation-id="disability"]', 'select[name="job_application[disability_status]"]', 'input[name^="entry."]'] // Added Greenhouse, Google Forms
        },
        // Profile Enhancements
        "profile.skills": {
            regex: /skills|technologies/i,
            selectors: ['input[name*="skills"]', 'textarea[name*="skills"]', '[data-automation-id="skills"]', 'input[name="key_skills"]', 'textarea[name="key_skills"]', 'input[name="primary_skills"]', 'input[name^="entry."][type="text"]', 'textarea[name^="entry."]'] // Hirist, Google Forms
        },
        "profile.reasonForChange": {
            regex: /reason\s*for\s*change|why\s*change|reason\s*for\s*leaving/i,
            selectors: ['textarea[name*="reason"]', 'input[name*="reason"]', '[data-automation-id="reasonForChange"]', 'textarea[name="reason_for_change"]', 'textarea[name^="entry."]', 'input[name^="entry."][type="text"]'] // Hirist, Google Forms
        },
        "profile.summary": {
            regex: /summary|headline|bio|about\s*me/i,
            selectors: ['textarea[name*="summary"]', 'textarea[name*="bio"]', 'textarea[name*="about"]', '[data-automation-id="summary"]', 'textarea[name="resume_headline"]', 'textarea[name="profile_summary"]', 'textarea[name^="entry."]'] // Hirist, Google Forms
        },
        "documents.coverLetter": {
            regex: /cover\s*letter|cl/i,
            selectors: ['textarea[name*="cover"]', 'textarea[name*="letter"]', '[data-automation-id="coverLetter"]', 'textarea[name^="entry."]']
        },
        "preferences.referral": {
            regex: /how\s*did\s*you\s*(hear|find)|source\s*you\s*found|where\s*did\s*you|referral/i,
            selectors: ['select[name*="source"]', 'input[name*="source"]', '[data-automation-id="source"]', 'input[name^="entry."]', 'textarea[name^="entry."]', 'input[aria-label*="source" i]', 'input[aria-label*="found" i]', 'input[aria-label*="hear" i]']
        },
        "preferences.relocation": {
            regex: /relocate|relocation/i,
            selectors: ['input[name*="relocat"]', 'select[name*="relocat"]', '[data-automation-id="relocation"]', 'input[name^="entry."]']
        },
        "eeoc.pronouns": {
            regex: /pronoun/i,
            selectors: ['input[name*="pronoun"]', 'select[name*="pronoun"]', '[data-automation-id="pronouns"]', 'input[name^="entry."]']
        }
    }
};
