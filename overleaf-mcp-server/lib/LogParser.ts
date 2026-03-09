import type { CompileError, CompileWarning, ParsedLog, ValidationResult } from "./types.js";

// ============================================
// LaTeX Log Parser
// ============================================

/**
 * Parse LaTeX compilation log into structured errors and warnings
 */
export function parseLog(rawLog: string): ParsedLog {
    // Input validation
    if (typeof rawLog !== 'string') {
        throw new Error('Log content must be a string');
    }
    
    if (rawLog.length === 0) {
        return {
            errors: [],
            warnings: [],
            rawLog: '',
            summary: 'Empty log',
        };
    }
    
    // Prevent extremely large logs
    if (rawLog.length > 10 * 1024 * 1024) {
        throw new Error('Log content too large (max 10MB)');
    }
    
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];

    const lines = rawLog.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // === Error Patterns ===

        // Pattern: ! Undefined control sequence.
        if (line.startsWith("!")) {
            const error = parseErrorBlock(lines, i);
            if (error) {
                errors.push(error);
            }
        }

        // Pattern: LaTeX Error: ...
        else if (/^LaTeX Error:/i.test(line)) {
            const latexErrorMatch = line.match(/^LaTeX Error:\s*(.+)/i);
            if (latexErrorMatch) {
                const lineNum = extractLineNumber(lines, i);
                errors.push({
                    line: lineNum,
                    message: latexErrorMatch[1].trim(),
                    type: "other",
                });
            }
        }

        // Pattern: Missing $ inserted (only if not already caught by ! prefix)
        else if (line.includes("Missing $ inserted") || line.includes("Missing } inserted")) {
            const lineNum = extractLineNumber(lines, i);
            errors.push({
                line: lineNum,
                message: line.trim(),
                type: "syntax",
            });
        }

        // === Warning Patterns ===

        // Pattern: LaTeX Warning: Reference 'xxx' on page X undefined
        const refWarningMatch = line.match(/LaTeX Warning:\s*Reference\s*[`']([^'`]+)[`']\s*on page\s*\d+\s*undefined/i);
        if (refWarningMatch) {
            warnings.push({
                message: `Undefined reference: ${refWarningMatch[1]}`,
                type: "reference",
            });
        }

        // Pattern: LaTeX Warning: Citation 'xxx' undefined
        const citeWarningMatch = line.match(/LaTeX Warning:\s*Citation\s*[`']([^'`]+)[`']\s*undefined/i);
        if (citeWarningMatch) {
            warnings.push({
                message: `Undefined citation: ${citeWarningMatch[1]}`,
                type: "reference",
            });
        }

        // Pattern: Package xxx Warning:
        const pkgWarningMatch = line.match(/Package\s+(\w+)\s+Warning:\s*(.+)/i);
        if (pkgWarningMatch) {
            warnings.push({
                message: `${pkgWarningMatch[1]}: ${pkgWarningMatch[2]}`,
                type: "package",
            });
        }

        // Pattern: Font Warning
        const fontWarningMatch = line.match(/Font Warning:\s*(.+)/i);
        if (fontWarningMatch) {
            warnings.push({
                message: fontWarningMatch[1],
                type: "font",
            });
        }

        // Pattern: Overfull/Underfull \hbox
        if (line.includes("Overfull \\hbox") || line.includes("Underfull \\hbox")) {
            const lineNum = extractLineNumber(lines, i);
            warnings.push({
                line: lineNum > 0 ? lineNum : undefined,
                message: line.trim(),
                type: "other",
            });
        }
    }

    // Generate summary
    const summary = generateSummary(errors, warnings);

    return {
        errors,
        warnings,
        rawLog,
        summary,
    };
}

/**
 * Parse a multi-line error block starting with !
 */
function parseErrorBlock(lines: string[], startIndex: number): CompileError | null {
    const errorLine = lines[startIndex];
    let message = errorLine.replace(/^!\s*/, "").trim();
    let lineNum = 0;
    let file: string | undefined;
    let type: CompileError["type"] = "other";

    // Determine error type
    if (message.includes("Undefined control sequence")) {
        type = "undefined";
    } else if (message.includes("Missing")) {
        type = "missing";
    } else if (
        message.includes("syntax") ||
        message.includes("Paragraph ended") ||
        message.includes("Extra")
    ) {
        type = "syntax";
    }

    // Look for line number in subsequent lines (l.XX pattern)
    for (let i = startIndex + 1; i < Math.min(startIndex + 5, lines.length); i++) {
        const nextLine = lines[i];

        // Pattern: l.123 \somecommand
        const lineMatch = nextLine.match(/^l\.(\d+)\s*(.*)/);
        if (lineMatch) {
            lineNum = parseInt(lineMatch[1], 10);
            // Extract the problematic code
            if (lineMatch[2]) {
                message += ` - near: ${lineMatch[2].trim().substring(0, 50)}`;
            }
            break;
        }
    }

    return {
        line: lineNum,
        message,
        file,
        type,
    };
}

/**
 * Extract line number from context
 */
function extractLineNumber(lines: string[], currentIndex: number): number {
    // Look around for l.XX pattern
    for (let i = currentIndex; i < Math.min(currentIndex + 5, lines.length); i++) {
        const match = lines[i].match(/l\.(\d+)/);
        if (match) {
            return parseInt(match[1], 10);
        }
    }
    return 0;
}

/**
 * Generate human-readable summary
 */
function generateSummary(errors: CompileError[], warnings: CompileWarning[]): string {
    const parts: string[] = [];

    if (errors.length === 0 && warnings.length === 0) {
        return "Compilation completed successfully.";
    }

    if (errors.length > 0) {
        parts.push(`${errors.length} error${errors.length > 1 ? "s" : ""}`);
    }

    if (warnings.length > 0) {
        parts.push(`${warnings.length} warning${warnings.length > 1 ? "s" : ""}`);
    }

    let summary = `Compilation ${errors.length > 0 ? "failed" : "completed"} with ${parts.join(" and ")}.`;

    // Add first error detail
    if (errors.length > 0) {
        const firstError = errors[0];
        summary += `\n\nFirst error${firstError.line > 0 ? ` (line ${firstError.line})` : ""}: ${firstError.message}`;
    }

    return summary;
}

/**
 * Quick validation check (without full compilation)
 */
export function quickValidate(content: string): ValidationResult {
    const issues: string[] = [];

    // Check for \documentclass
    if (!content.includes("\\documentclass")) {
        issues.push("Missing \\documentclass declaration");
    }

    // Check for \begin{document}
    if (!content.includes("\\begin{document}")) {
        issues.push("Missing \\begin{document}");
    }

    // Check for \end{document}
    if (!content.includes("\\end{document}")) {
        issues.push("Missing \\end{document}");
    }

    // CQ-11: Strip comments and verbatim environments before counting braces
    // to reduce false positives
    const strippedContent = content
        .replace(/\\verb[^a-zA-Z].*?[^a-zA-Z]/g, '')  // Remove \verb|...|
        .replace(/\\begin\{verbatim\}[\s\S]*?\\end\{verbatim\}/g, '') // Remove verbatim environments
        .replace(/%[^\n]*/g, ''); // Remove % comments

    // Check for unbalanced braces (on stripped content)
    const openBraces = (strippedContent.match(/(?<!\\)\{/g) || []).length;
    const closeBraces = (strippedContent.match(/(?<!\\)\}/g) || []).length;
    if (openBraces !== closeBraces) {
        issues.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for unbalanced $ (math mode)
    const dollarSigns = (strippedContent.match(/(?<!\\)\$/g) || []).length;
    if (dollarSigns % 2 !== 0) {
        issues.push("Unbalanced $ (math mode delimiters)");
    }

    return {
        valid: issues.length === 0,
        issues,
    };
}
