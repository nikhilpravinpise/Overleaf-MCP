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
    }, async ({ topic, style, length }) => {
        try {
            if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
                throw new Error('Topic is required and must be a non-empty string');
            }
            const sanitizedTopic = topic.trim();
            const sanitizedStyle = style ? style.trim() : "academic";
            const sanitizedLength = length ? length.trim() : "300-500";
            
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Write a LaTeX section about "${sanitizedTopic}".

Requirements:
- Style: ${sanitizedStyle}
- Length: approximately ${sanitizedLength} words
- Include proper LaTeX formatting
- Use \\section{} for the heading
- Include relevant subsections if appropriate
- Add placeholder \\label{} and \\cite{} where appropriate

Output only the LaTeX code, no explanations.`,
                    },
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Error: Unable to generate LaTeX section. ${errorMessage}`,
                    },
                }],
            };
        }
    });

    server.prompt({
        name: "fix_errors",
        description: "Fix LaTeX compilation errors",
        schema: z.object({
            errors: z.string().describe("Error messages from compilation"),
            context: z.string().optional().describe("Relevant code context"),
        }),
    }, async ({ errors, context }) => {
        try {
            if (!errors || typeof errors !== 'string' || errors.trim().length === 0) {
                throw new Error('Error messages are required and must be a non-empty string');
            }
            const sanitizedErrors = errors.trim();
            const sanitizedContext = context ? context.trim() : "";
            
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Fix these LaTeX compilation errors:\n\n${sanitizedErrors}\n\n${sanitizedContext ? `\nRelevant code:\n\`\`\`latex\n${sanitizedContext}\n\`\`\`` : ""}\n\nExplain each error and provide the corrected LaTeX code.`,
                    },
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Error: Unable to process LaTeX errors. ${errorMessage}`,
                    },
                }],
            };
        }
    });

    server.prompt({
        name: "convert_to_latex",
        description: "Convert plain text or markdown to LaTeX",
        schema: z.object({
            text: z.string().describe("Text to convert"),
            format: z.string().optional().describe("Source format (plain, markdown)"),
        }),
    }, async ({ text, format }) => {
        try {
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                throw new Error('Text content is required and must be a non-empty string');
            }
            const sanitizedText = text.trim();
            const sanitizedFormat = format ? format.trim() : "plain text";
            
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Convert this ${sanitizedFormat} to well-formatted LaTeX:\n\n${sanitizedText}\n\nRequirements:\n- Preserve all formatting and structure\n- Use appropriate LaTeX environments (itemize, enumerate, etc.)\n- Convert any markdown elements to LaTeX equivalents\n- Add proper escaping for special characters\n- Output only the LaTeX code`,
                    },
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Error: Unable to convert text to LaTeX. ${errorMessage}`,
                    },
                }],
            };
        }
    });

    server.prompt({
        name: "create_table",
        description: "Generate a LaTeX table from data",
        schema: z.object({
            data: z.string().describe("Table data (CSV or description)"),
            caption: z.string().optional().describe("Table caption"),
        }),
    }, async ({ data, caption }) => {
        try {
            if (!data || typeof data !== 'string' || data.trim().length === 0) {
                throw new Error('Table data is required and must be a non-empty string');
            }
            const sanitizedData = data.trim();
            const sanitizedCaption = caption ? caption.trim() : "";
            
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Create a LaTeX table from this data:\n\n${sanitizedData}\n\n${sanitizedCaption ? `Caption: ${sanitizedCaption}` : ""}\n\nRequirements:\n- Use booktabs package style (\\toprule, \\midrule, \\bottomrule)\n- Include \\begin{table} environment with centering\n- Add \\caption and \\label\n- Align columns appropriately\n- Output only the LaTeX code`,
                    },
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Error: Unable to create LaTeX table. ${errorMessage}`,
                    },
                }],
            };
        }
    });

    server.prompt({
        name: "add_citations",
        description: "Create BibTeX entries for references",
        schema: z.object({
            references: z.string().describe("References to add (titles, URLs, etc.)"),
            style: z.string().optional().describe("Citation style preference"),
        }),
    }, async ({ references, style }) => {
        try {
            if (!references || typeof references !== 'string' || references.trim().length === 0) {
                throw new Error('References are required and must be a non-empty string');
            }
            const sanitizedReferences = references.trim();
            const sanitizedStyle = style ? style.trim() : "";
            
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Create BibTeX entries for these references:\n\n${sanitizedReferences}\n\n${sanitizedStyle ? `Preferred style: ${sanitizedStyle}` : ""}\n\nRequirements:\n- Use appropriate entry types (@article, @book, @inproceedings, etc.)\n- Generate sensible citation keys\n- Include all available metadata\n- Output valid BibTeX code`,
                    },
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Error: Unable to create BibTeX entries. ${errorMessage}`,
                    },
                }],
            };
        }
    });

    server.prompt({
        name: "create_figure",
        description: "Generate LaTeX figure environment",
        schema: z.object({
            imagePath: z.string().describe("Path to image file"),
            caption: z.string().describe("Figure caption"),
            label: z.string().describe("Reference label"),
        }),
    }, async ({ imagePath, caption, label }) => {
        try {
            if (!imagePath || typeof imagePath !== 'string' || imagePath.trim().length === 0) {
                throw new Error('Image path is required and must be a non-empty string');
            }
            if (!caption || typeof caption !== 'string' || caption.trim().length === 0) {
                throw new Error('Figure caption is required and must be a non-empty string');
            }
            if (!label || typeof label !== 'string' || label.trim().length === 0) {
                throw new Error('Figure label is required and must be a non-empty string');
            }
            const sanitizedImagePath = imagePath.trim();
            const sanitizedCaption = caption.trim();
            const sanitizedLabel = label.trim();
            
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Create a LaTeX figure environment:\n\nImage path: ${sanitizedImagePath}\nCaption: ${sanitizedCaption}\nLabel: ${sanitizedLabel}\n\nRequirements:\n- Use \\begin{figure}[htbp] environment\n- Center the image\n- Use appropriate width (e.g., 0.8\\textwidth)\n- Include \\caption and \\label\n- Output only the LaTeX code`,
                    },
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Error: Unable to create LaTeX figure. ${errorMessage}`,
                    },
                }],
            };
        }
    });

    server.prompt({
        name: "optimize_document",
        description: "Suggest improvements for a LaTeX document",
        schema: z.object({
            content: z.string().describe("LaTeX document content"),
        }),
    }, async ({ content }) => {
        try {
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                throw new Error('Document content is required and must be a non-empty string');
            }
            const sanitizedContent = content.trim();
            
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Review this LaTeX document and suggest improvements:\n\n\`\`\`latex\n${sanitizedContent}\n\`\`\`\n\nCheck for:\n1. Missing or unnecessary packages\n2. Formatting improvements\n3. Best practices violations\n4. Potential compilation issues\n5. Accessibility improvements\n\nProvide specific suggestions with corrected code where applicable.`,
                    },
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Error: Unable to analyze LaTeX document. ${errorMessage}`,
                    },
                }],
            };
        }
    });

    server.prompt({
        name: "edit_resume",
        description: "Edit and improve a resume. Use this for making targeted improvements to resume content, formatting, or structure.",
        schema: z.object({
            currentContent: z.string().describe("Current resume LaTeX content"),
            changes: z.string().describe("Description of changes to make (e.g., 'add work experience at Google', 'improve bullet points', 'fix formatting')"),
            focus: z.string().optional().describe("Specific area to focus on (e.g., 'experience', 'skills', 'education', 'formatting')"),
        }),
    }, async ({ currentContent, changes, focus }) => {
        try {
            if (!currentContent || typeof currentContent !== 'string' || currentContent.trim().length === 0) {
                throw new Error('Current resume content is required');
            }
            if (!changes || typeof changes !== 'string' || changes.trim().length === 0) {
                throw new Error('Changes description is required');
            }
            const sanitizedChanges = changes.trim();
            const sanitizedFocus = focus ? focus.trim() : "overall resume";
            
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Help me edit my resume with the following changes:\n\n${sanitizedChanges}\n\nFocus area: ${sanitizedFocus}\n\nCurrent resume content:\n\`\`\`latex\n${currentContent}\n\`\`\`\n\nRequirements:\n- Make only the requested changes\n- Preserve the existing LaTeX structure and formatting\n- Keep the same document class and preamble\n- Ensure all LaTeX syntax is correct\n- Output the complete updated LaTeX code`,
                    },
                }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                messages: [{
                    role: "user" as const,
                    content: {
                        type: "text" as const,
                        text: `Error: Unable to process resume edit. ${errorMessage}`,
                    },
                }],
            };
        }
    });
}
