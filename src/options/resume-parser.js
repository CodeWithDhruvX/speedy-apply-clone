/**
 * Resume Parser Module
 * Parses LaTeX resume files and extracts profile data
 * Supports ZIP file extraction and multiple file selection
 */

class ResumeParser {
    constructor() {
        this.parsedData = null;
    }

    /**
     * Main entry point for parsing resume files
     * @param {FileList|File[]} files - Files to parse (can include .tex, .zip)
     * @returns {Promise<Array>} Array of parsed profile data objects
     */
    async parseFiles(files) {
        const results = [];
        let errorCount = 0;

        try {
            // Handle different file types
            for (const file of files) {
                try {
                    let texContent = null;
                    let resumeName = 'Resume';
                    const fileName = file.name.toLowerCase();

                    if (fileName.endsWith('.zip')) {
                        // Extract and parse ZIP file
                        const extractedContent = await this.extractZip(file);
                        if (extractedContent) {
                            texContent = extractedContent.content;
                            resumeName = extractedContent.name;
                        }
                    } else if (fileName.endsWith('.tex')) {
                        // Read TEX file directly
                        texContent = await this.readFileAsText(file);
                        resumeName = file.name.replace('.tex', '');
                    }

                    if (texContent) {
                        // Parse the LaTeX content
                        const profileData = this.parseLatexResume(texContent);
                        profileData._resumeName = resumeName;
                        results.push(profileData);
                    }
                } catch (err) {

                    errorCount++;
                }
            }

            if (results.length === 0) {
                throw new Error('No valid .tex or .zip files found or all failed to parse.');
            }

            this.parsedData = results;
            return results;

        } catch (error) {

            throw error;
        }
    }

    /**
     * Extract ZIP file and find .tex file
     * @param {File} zipFile - ZIP file to extract
     * @returns {Promise<Object>} Object with content and name
     */
    async extractZip(zipFile) {
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded. Please refresh the page.');
        }

        const zip = new JSZip();
        const zipData = await zip.loadAsync(zipFile);

        // Find first .tex file in the ZIP
        for (const [fileName, fileObj] of Object.entries(zipData.files)) {
            if (fileName.toLowerCase().endsWith('.tex') && !fileObj.dir) {
                const content = await fileObj.async('text');
                const name = fileName.split('/').pop().replace('.tex', '');
                return { content, name };
            }
        }

        throw new Error('No .tex file found in ZIP archive.');
    }

    /**
     * Read file as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Parse LaTeX resume content and extract profile data
     * @param {string} texContent - LaTeX file content
     * @returns {Object} Structured profile data
     */
    parseLatexResume(texContent) {
        const data = {
            // Personal Information
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            location: '',

            // Links
            linkedin: '',
            github: '',
            portfolio: '',
            twitter: '',

            // Address (if detailed)
            street: '',
            city: '',
            state: '',
            zip: '',
            country: '',

            // Skills and Summary
            skills: '',
            summary: '',

            // Education
            education: [],

            // Work History
            workHistory: [],

            // Preferences
            experience: '',
            noticePeriod: '',
            currentCtc: '',
            expectedCtc: ''
        };

        // Extract name
        const nameMatch = texContent.match(/\\name\{([^}]+)\}/);
        if (nameMatch) {
            const fullName = nameMatch[1].trim();
            const nameParts = fullName.split(' ');
            data.firstName = nameParts[0] || '';
            data.lastName = nameParts.slice(1).join(' ') || '';
        }

        // Extract email
        const emailMatch = texContent.match(/\\href\{mailto:([^}]+)\}|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) {
            data.email = emailMatch[1] || emailMatch[2] || '';
        }

        // Extract phone
        const phoneMatch = texContent.match(/\+?\d{1,3}[\s-]?\d{10}|\+?\d{10,}/);
        if (phoneMatch) {
            data.phone = phoneMatch[0].trim();
        }

        // Extract location from address
        const addressMatches = texContent.match(/\\address\{([^}]+)\}/g);
        if (addressMatches && addressMatches.length > 0) {
            const firstAddress = addressMatches[0].match(/\\address\{([^}]+)\}/)[1];
            // Remove LaTeX commands and extract location
            const cleanAddress = firstAddress.replace(/\\/g, '').replace(/\|/g, ',').trim();
            data.location = cleanAddress;

            // Try to extract city and country
            const locationParts = cleanAddress.split(',').map(p => p.trim());
            if (locationParts.length >= 2) {
                data.city = locationParts[0];
                data.country = locationParts[locationParts.length - 1];
            }
        }

        // Extract LinkedIn
        const linkedinMatch = texContent.match(/\\href\{https?:\/\/(?:www\.)?linkedin\.com\/in\/([^}]+)\}/i);
        if (linkedinMatch) {
            data.linkedin = `https://linkedin.com/in/${linkedinMatch[1].replace(/\}/g, '')}`;
        }

        // Extract GitHub
        const githubMatch = texContent.match(/\\href\{https?:\/\/(?:www\.)?github\.com\/([^}]+)\}/i);
        if (githubMatch) {
            data.github = `https://github.com/${githubMatch[1].replace(/\}/g, '')}`;
        }

        // Extract Portfolio/Website
        const portfolioMatch = texContent.match(/\\href\{(https?:\/\/(?!linkedin|github|twitter|mailto)[^}]+)\}/i);
        if (portfolioMatch) {
            data.portfolio = portfolioMatch[1];
        }

        // Extract Objective/Summary
        const objectiveMatch = texContent.match(/\\begin\{rSection\}\{Objective\}([\s\S]*?)\\end\{rSection\}/i);
        if (objectiveMatch) {
            data.summary = this.cleanLatexText(objectiveMatch[1]);
        }

        // Extract Skills
        const skillsMatch = texContent.match(/\\begin\{rSection\}\{Skills\}([\s\S]*?)\\end\{rSection\}/i);
        if (skillsMatch) {
            const skillsText = this.cleanLatexText(skillsMatch[1]);
            // Extract skills from tabular format
            const skillsList = [];
            const lines = skillsText.split('\n');
            for (const line of lines) {
                const parts = line.split('&');
                if (parts.length > 1) {
                    const skills = parts[1].split(',').map(s => s.trim()).filter(s => s);
                    skillsList.push(...skills);
                }
            }
            data.skills = skillsList.join(', ');
        }

        // Extract Education
        const educationMatch = texContent.match(/\\begin\{rSection\}\{Education\}([\s\S]*?)\\end\{rSection\}/i);
        if (educationMatch) {
            const educationText = educationMatch[1];
            // Pattern: \textbf{Degree}, Institution \hfill Date
            // Use split to process each education entry
            const eduLines = educationText.split(/\n/).filter(line => line.includes('\\textbf'));

            for (const line of eduLines) {
                // Extract using simple string operations
                const textbfStart = line.indexOf('\\textbf{');
                const textbfEnd = line.indexOf('}', textbfStart);
                const hfillPos = line.indexOf('\\hfill');

                if (textbfStart >= 0 && textbfEnd > textbfStart && hfillPos > textbfEnd) {
                    // Extract degree
                    const degree = line.substring(textbfStart + 8, textbfEnd);

                    // Extract institution (between }, and \hfill)
                    const afterDegree = line.substring(textbfEnd + 1);
                    const commaPos = afterDegree.indexOf(',');
                    const hfillInAfter = afterDegree.indexOf('\\hfill');

                    let institution = '';
                    if (commaPos >= 0 && hfillInAfter > commaPos) {
                        institution = afterDegree.substring(commaPos + 1, hfillInAfter).trim();
                    }

                    // Extract dates (after \hfill)
                    const dateStr = line.substring(line.indexOf('\\hfill') + 6).trim();
                    const cleanDate = this.cleanLatexText(dateStr);

                    // Split on either "--" (double dash) or " - " (space dash space)
                    let dateParts;
                    if (cleanDate.includes('--')) {
                        dateParts = cleanDate.split('--').map(d => d.trim());
                    } else if (cleanDate.includes(' - ')) {
                        dateParts = cleanDate.split(' - ').map(d => d.trim());
                    } else {
                        dateParts = [cleanDate];
                    }

                    data.education.push({
                        degree: this.cleanLatexText(degree),
                        institution: this.cleanLatexText(institution),
                        startDate: this.convertTextDateToYYYYMM(dateParts[0] || ''),
                        endDate: this.convertTextDateToYYYYMM(dateParts[1] || dateParts[0] || ''),
                        description: ''
                    });

                    // Debug: Log converted dates



                }
            }
        }

        // Extract Work Experience
        const experienceMatch = texContent.match(/\\begin\{rSection\}\{Experience\}([\s\S]*?)\\end\{rSection\}/i);
        if (experienceMatch) {
            const experienceText = experienceMatch[1];
            // Match work entries: \textbf{Title, Company} \hfill Dates\\
            // Match work entries: \textbf{Title, Company} \hfill Dates\\
            // The dates might be followed by \\\\ which is a LaTeX line break
            // We use spread syntax to get all matches with their indices
            const workEntriesRegex = /\\textbf\{([^}]+)\}\s*\\hfill\s*([^\n]+?)(?:\\\\)?(?:\n|$)/g;
            const matches = [...experienceText.matchAll(workEntriesRegex)];

            if (matches.length > 0) {
                for (let i = 0; i < matches.length; i++) {
                    const match = matches[i];
                    const nextMatch = matches[i + 1];
                    const entry = match[0];

                    // Extract title and date from capture groups
                    const titleRaw = match[1];
                    const dateRaw = match[2];

                    // Find the section for this entry (from end of this match to start of next match)
                    const entryEndIndex = match.index + entry.length;
                    const nextEntryStartIndex = nextMatch ? nextMatch.index : experienceText.length;
                    const nextSection = experienceText.substring(entryEndIndex, nextEntryStartIndex);

                    // Extract bullet points (all items in itemize block)
                    const bulletMatch = nextSection.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);
                    let description = '';
                    if (bulletMatch) {
                        // Extract all \item entries - match everything until next \item or \end
                        const itemsText = bulletMatch[1];
                        const bullets = [];

                        // Split by \item and filter empty entries
                        const parts = itemsText.split(/\\item\s+/).filter(p => p.trim());

                        for (const part of parts) {
                            // Clean up the bullet text - remove trailing \n and other LaTeX
                            let bulletText = part.trim();
                            // Remove any trailing backslashes or newlines
                            bulletText = bulletText.replace(/\\+$/, '').trim();
                            if (bulletText) {
                                const cleaned = this.cleanLatexText(bulletText);
                                bullets.push('• ' + cleaned);
                            }
                        }

                        description = bullets.join('\n');
                    }

                    const [company, role] = this.parseCompanyAndRole(titleRaw);

                    // Parse date range (e.g., "Aug 2024 -- Present" or "Aug 2024 - Present")
                    let startDate = '';
                    let endDate = '';
                    if (dateRaw) {
                        const dateRange = this.cleanLatexText(dateRaw);

                        // Split on either "--" (double dash) or " - " (space dash space)
                        let dateParts;
                        if (dateRange.includes('--')) {
                            dateParts = dateRange.split('--').map(d => d.trim());
                        } else if (dateRange.includes(' - ')) {
                            dateParts = dateRange.split(' - ').map(d => d.trim());
                        } else {
                            dateParts = [dateRange];
                        }

                        startDate = this.convertTextDateToYYYYMM(dateParts[0] || '');
                        endDate = this.convertTextDateToYYYYMM(dateParts[1] || dateParts[0] || '');
                    }

                    data.workHistory.push({
                        company: company,
                        title: role,
                        startDate: startDate,
                        endDate: endDate,
                        description: description
                    });

                    // Debug: Log entries
                    if (data.workHistory.length <= 3) {



                    }
                }
            }
        }

        // Try to extract years of experience from objective/summary
        const experienceYearsMatch = data.summary.match(/(\d+)\+?\s*years?/i);
        if (experienceYearsMatch) {
            data.experience = experienceYearsMatch[1];
        }

        return data;
    }

    /**
     * Parse company and role from job title string
     * @param {string} titleString - Job title string (e.g., "Senior Engineer, Company Name")
     * @returns {Array} [company, role]
     */
    parseCompanyAndRole(titleString) {
        const parts = titleString.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            return [parts[1], parts[0]];
        }
        return [titleString, ''];
    }

    /**
     * Convert text date (e.g., "Mar 2021", "Present") to yyyy-MM format
     * @param {string} dateStr - Date string like "Mar 2021", "Jun 2018", "Present"
     * @returns {string} Date in yyyy-MM format or original if "Present" or unable to parse
     */
    convertTextDateToYYYYMM(dateStr) {
        if (!dateStr) return '';

        const cleaned = dateStr.trim();

        // Handle "Present" or "Current"
        if (/^(present|current)$/i.test(cleaned)) {
            return 'Present';
        }

        // Month name mapping
        const monthMap = {
            'jan': '01', 'january': '01',
            'feb': '02', 'february': '02',
            'mar': '03', 'march': '03',
            'apr': '04', 'april': '04',
            'may': '05',
            'jun': '06', 'june': '06',
            'jul': '07', 'july': '07',
            'aug': '08', 'august': '08',
            'sep': '09', 'sept': '09', 'september': '09',
            'oct': '10', 'october': '10',
            'nov': '11', 'november': '11',
            'dec': '12', 'december': '12'
        };

        // Try to match "Mon YYYY" or "Month YYYY" pattern
        const match = cleaned.match(/^([a-z]+)\.?\s+(\d{4})$/i);
        if (match) {
            const monthName = match[1].toLowerCase();
            const year = match[2];
            const monthNum = monthMap[monthName];

            if (monthNum) {
                return `${year}-${monthNum}`;
            }
        }

        // If already in yyyy-MM format, return as is
        if (/^\d{4}-\d{2}$/.test(cleaned)) {
            return cleaned;
        }

        // Unable to parse, return original
        return cleaned;
    }

    /**
     * Clean LaTeX formatting from text
     * @param {string} text - Text with LaTeX commands
     * @returns {string} Cleaned text
     */
    cleanLatexText(text) {
        if (!text) return '';

        return text
            // Remove textbf, textit, href commands but keep content
            .replace(/\\textbf\{([^}]+)\}/g, '$1')
            .replace(/\\textit\{([^}]+)\}/g, '$1')
            .replace(/\\href\{[^}]+\}\{([^}]+)\}/g, '$1')
            // Remove other common LaTeX commands
            .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
            .replace(/\\[a-zA-Z]+/g, '')
            // Clean up special characters
            .replace(/~/g, ' ')
            .replace(/--/g, '-')
            .replace(/&/g, '')
            .replace(/\\\\/g, ' ')
            // Clean up whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Get parsed data
     * @returns {Object} Parsed profile data
     */
    getParsedData() {
        return this.parsedData;
    }
}

// Export for use in options.js
window.ResumeParser = ResumeParser;
