// Quick test to debug work experience extraction
const testLatex = `\\begin{rSection}{Experience}

\\textbf{Senior Engineer, Ascendion Pvt. Ltd.} \\hfill Aug 2024 -- Present\\\\
\\textit{Project: Insight Governance (Client: KPMG)}
\\begin{itemize}
    \\item Integrated PowerBI dashboards into Angular-based UI.
    \\item Containerized applications using Docker.
\\end{itemize}

\\textbf{Software Engineer, Tatvasoft Pvt. Ltd.} \\hfill Mar 2021 -- Aug 2021\\\\
\\textit{Project: Wassel-UI}
\\begin{itemize}
    \\item Built healthcare claims management system.
\\end{itemize}

\\end{rSection}`;

// Test the regex
const regex = /\\textbf\{([^}]+)\}\s*\\hfill\s*([^\\\n]+)/g;
const matches = testLatex.match(regex);



// Expected: Should match both entries
