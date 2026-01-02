import { z } from "zod";
import type { MCPServer } from "mcp-use/server";

// ============================================
// MCP Prompt Definitions (using Zod schemas instead of args)
// ============================================

export function registerPrompts(server: MCPServer) {
    server.prompt({
        name: "write_section",
        description: "Generate a well-formatted LaTeX section on any topic",
        schema: z.object({
            topic: z.string().describe("Section topic"),
            style: z.string().optional().describe("Writing style (academic, casual, technical)"),
            length: z.string().optional().describe("Approximate word count"),
        }),
    }, async ({ topic, style, length }) => ({
        messages: [{
            role: "user" as const,
            content: {
                type: "text" as const,
                text: `Write a LaTeX section about "${topic}".

Requirements:
- Style: ${style || "academic"}
- Length: approximately ${length || "300-500"} words
- Include proper LaTeX formatting
- Use \\section{} for the heading
- Include relevant subsections if appropriate
- Add placeholder \\label{} and \\cite{} where appropriate

Output only the LaTeX code, no explanations.`,
            },
        }],
    }));

    server.prompt({
        name: "fix_errors",
        description: "Fix LaTeX compilation errors",
        schema: z.object({
            errors: z.string().describe("Error messages from compilation"),
            context: z.string().optional().describe("Relevant code context"),
        }),
    }, async ({ errors, context }) => ({
        messages: [{
            role: "user" as const,
            content: {
                type: "text" as const,
                text: `Fix these LaTeX compilation errors:\n\n${errors}\n\n${context ? `\nRelevant code:\n\`\`\`latex\n${context}\n\`\`\`` : ""}\n\nExplain each error and provide the corrected LaTeX code.`,
            },
        }],
    }));

    server.prompt({
        name: "convert_to_latex",
        description: "Convert plain text or markdown to LaTeX",
        schema: z.object({
            text: z.string().describe("Text to convert"),
            format: z.string().optional().describe("Source format (plain, markdown)"),
        }),
    }, async ({ text, format }) => ({
        messages: [{
            role: "user" as const,
            content: {
                type: "text" as const,
                text: `Convert this ${format || "plain text"} to well-formatted LaTeX:\n\n${text}\n\nRequirements:\n- Preserve all formatting and structure\n- Use appropriate LaTeX environments (itemize, enumerate, etc.)\n- Convert any markdown elements to LaTeX equivalents\n- Add proper escaping for special characters\n- Output only the LaTeX code`,
            },
        }],
    }));

    server.prompt({
        name: "create_table",
        description: "Generate a LaTeX table from data",
        schema: z.object({
            data: z.string().describe("Table data (CSV or description)"),
            caption: z.string().optional().describe("Table caption"),
        }),
    }, async ({ data, caption }) => ({
        messages: [{
            role: "user" as const,
            content: {
                type: "text" as const,
                text: `Create a LaTeX table from this data:\n\n${data}\n\n${caption ? `Caption: ${caption}` : ""}\n\nRequirements:\n- Use booktabs package style (\\toprule, \\midrule, \\bottomrule)\n- Include \\begin{table} environment with centering\n- Add \\caption and \\label\n- Align columns appropriately\n- Output only the LaTeX code`,
            },
        }],
    }));

    server.prompt({
        name: "add_citations",
        description: "Create BibTeX entries for references",
        schema: z.object({
            references: z.string().describe("References to add (titles, URLs, etc.)"),
            style: z.string().optional().describe("Citation style preference"),
        }),
    }, async ({ references, style }) => ({
        messages: [{
            role: "user" as const,
            content: {
                type: "text" as const,
                text: `Create BibTeX entries for these references:\n\n${references}\n\n${style ? `Preferred style: ${style}` : ""}\n\nRequirements:\n- Use appropriate entry types (@article, @book, @inproceedings, etc.)\n- Generate sensible citation keys\n- Include all available metadata\n- Output valid BibTeX code`,
            },
        }],
    }));

    server.prompt({
        name: "create_figure",
        description: "Generate LaTeX figure environment",
        schema: z.object({
            imagePath: z.string().describe("Path to image file"),
            caption: z.string().describe("Figure caption"),
            label: z.string().describe("Reference label"),
        }),
    }, async ({ imagePath, caption, label }) => ({
        messages: [{
            role: "user" as const,
            content: {
                type: "text" as const,
                text: `Create a LaTeX figure environment:\n\nImage path: ${imagePath}\nCaption: ${caption}\nLabel: ${label}\n\nRequirements:\n- Use \\begin{figure}[htbp] environment\n- Center the image\n- Use appropriate width (e.g., 0.8\\textwidth)\n- Include \\caption and \\label\n- Output only the LaTeX code`,
            },
        }],
    }));

    server.prompt({
        name: "optimize_document",
        description: "Suggest improvements for a LaTeX document",
        schema: z.object({
            content: z.string().describe("LaTeX document content"),
        }),
    }, async ({ content }) => ({
        messages: [{
            role: "user" as const,
            content: {
                type: "text" as const,
                text: `Review this LaTeX document and suggest improvements:\n\n\`\`\`latex\n${content}\n\`\`\`\n\nCheck for:\n1. Missing or unnecessary packages\n2. Formatting improvements\n3. Best practices violations\n4. Potential compilation issues\n5. Accessibility improvements\n\nProvide specific suggestions with corrected code where applicable.`,
            },
        }],
    }));
}
