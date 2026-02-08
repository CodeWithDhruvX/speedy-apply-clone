// Direct test of the parser conversion
const fs = require('fs');
const path = require('path');

// Simulate the browser environment
global.JSZip = require('jszip');

// Load the parser
const parserCode = fs.readFileSync(path.join(__dirname, 'resume-parser.js'), 'utf8');
eval(parserCode);

// Read the resume
const resumePath = path.join(__dirname, '..', '..', '..', 'MEAN_MERN_resume_2026', 'resume_faangpath.tex');
const texContent = fs.readFileSync(resumePath, 'utf8');

// Parse
const parser = new ResumeParser();
const result = parser.parseLatexResume(texContent);

console.log('\n===== EDUCATION DATES =====');
result.education.forEach((edu, idx) => {
    console.log(`${idx + 1}. ${edu.degree}`);
    console.log(`   Institution: ${edu.institution}`);
    console.log(`   Start: "${edu.startDate}" | End: "${edu.endDate}"`);
});

console.log('\n===== WORK HISTORY DATES (first 3) =====');
result.workHistory.slice(0, 3).forEach((work, idx) => {
    console.log(`${idx + 1}. ${work.title} at ${work.company}`);
    console.log(`   Start: "${work.startDate}" | End: "${work.endDate}"`);
    console.log(`   Description length: ${work.description.length} chars`);
    console.log(`   First 100 chars: ${work.description.substring(0, 100)}`);
});

console.log(`\nTotal work entries: ${result.workHistory.length}`);
