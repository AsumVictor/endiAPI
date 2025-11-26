// Template loader for email templates
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface TemplateVariables {
  [key: string]: string | number | undefined;
}

/**
 * Load and render an email template
 * @param templateName - Name of the template file (without .html extension)
 * @param variables - Variables to replace in the template (e.g., {name: "John", email: "john@example.com"})
 * @returns Rendered HTML string
 */
export function loadEmailTemplate(templateName: string, variables: TemplateVariables): string {
  try {
    const templatePath = join(__dirname, 'templates', `${templateName}.html`);
    let template = readFileSync(templatePath, 'utf-8');

    // Replace all placeholders in the format {{variableName}}
    // Match {{variableName}} or {{ variableName }} (with optional spaces)
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Replace {{key}} and {{ key }} (with spaces)
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        template = template.replace(regex, String(value));
      }
    });

    return template;
  } catch (error) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Email template "${templateName}" not found`);
      }
      throw new Error(`Failed to load email template "${templateName}": ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get list of available email templates
 */
export function getAvailableTemplates(): string[] {
  // This could be enhanced to read the directory, but for now we'll return known templates
  return [
    'beta-confirmation',
    // Add more template names as they are created
  ];
}

