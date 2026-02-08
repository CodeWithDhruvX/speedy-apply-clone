// Test to verify all 8 work entries are extracted
const fs = require('fs');
const path = require('path');

// Read the actual resume file
const resumePath = path.join(__dirname, '..', '..', '..', 'MEAN_MERN_resume_2026', 'resume_faangpath.tex');
const texContent = fs.readFileSync(resumePath, 'utf8');

// Extract Experience section
const experienceMatch = texContent.match(/\\begin\{rSection\}\{Experience\}([\s\S]*?)\\end\{rSection\}/i);

if (experienceMatch) {
    const experienceText = experienceMatch[1];

    // OLD regex
    const oldRegex = /\\textbf\{([^}]+)\}\s*\\hfill\s*([^\\\n]+)/g;
    const oldMatches = experienceText.match(oldRegex);

    // NEW regex
    const newRegex = /\\textbf\{([^}]+)\}\s*\\hfill\s*([^\n]+?)(?:\\\\)?(?:\n|$)/g;
    const newMatches = experienceText.match(newRegex);

    console.log('OLD regex matched:', oldMatches ? oldMatches.length : 0, 'entries');
    console.log('NEW regex matched:', newMatches ? newMatches.length : 0, 'entries');
    console.log('\nNEW matches:');
    if (newMatches) {
        newMatches.forEach((match, idx) => {
            console.log(`${idx + 1}. ${match.substring(0, 80)}...`);
        });
    }

    console.log('\nExpected: 8 work experience entries');
} else {
    console.log('No Experience section found!');
}
