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


result.education.forEach((edu, idx) => {

});


result.workHistory.slice(0, 3).forEach((work, idx) => {

});


