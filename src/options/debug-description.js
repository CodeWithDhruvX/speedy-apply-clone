const fs = require('fs');
const path = require('path');

// Mock ResumeParser class partially for testing
class ResumeParser {
    cleanLatexText(text) {
        if (!text) return '';
        return text
            .replace(/\\textbf\{([^}]+)\}/g, '$1')
            .replace(/\\textit\{([^}]+)\}/g, '$1')
            .replace(/\\href\{[^}]+\}\{([^}]+)\}/g, '$1')
            .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
            .replace(/\\[a-zA-Z]+/g, '')
            .replace(/~/g, ' ')
            .replace(/--/g, '-')
            .replace(/&/g, '')
            .replace(/\\\\/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

const parser = new ResumeParser();

// Read actual resume
const resumePath = path.join(__dirname, '..', '..', '..', 'MEAN_MERN_resume_2026', 'resume_faangpath.tex');
const texContent = fs.readFileSync(resumePath, 'utf8');

// Extract Experience Section
const experienceMatch = texContent.match(/\\begin\{rSection\}\{Experience\}([\s\S]*?)\\end\{rSection\}/i);

if (experienceMatch) {
    const experienceText = experienceMatch[1];


    // Current Regex matches
    const workEntries = experienceText.match(/\\textbf\{([^}]+)\}\s*\\hfill\s*([^\n]+?)(?:\\\\)?(?:\n|$)/g);

    if (workEntries) {


        // Take the first entry to debug
        const entry = workEntries[0];


        const entryIndex = experienceText.indexOf(entry);


        if (entryIndex === -1) {

            // This is likely the problem
        } else {
            const nextEntryIndex = experienceText.indexOf('\\textbf', entryIndex + entry.length);
            const sectionEnd = nextEntryIndex > 0 ? nextEntryIndex : experienceText.length;
            const nextSection = experienceText.substring(entryIndex, sectionEnd);



            const bulletMatch = nextSection.match(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/);

            if (bulletMatch) {

            }
        }
    }
} else {

}
