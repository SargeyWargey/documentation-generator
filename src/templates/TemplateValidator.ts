import {
  TemplateMetadata,
  TemplateVariable,
  Template,
} from './TemplateManager';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class TemplateValidator {
  /**
   * Validate a complete template including metadata and content
   */
  validateTemplate(template: Template): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Validate metadata
    const metadataResult = this.validateMetadata(template.metadata);
    result.errors.push(...metadataResult.errors);
    result.warnings.push(...metadataResult.warnings);

    // Validate content
    const contentResult = this.validateContent(
      template.content,
      template.metadata.variables
    );
    result.errors.push(...contentResult.errors);
    result.warnings.push(...contentResult.warnings);

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate template metadata structure and required fields
   */
  validateMetadata(metadata: TemplateMetadata): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Required fields
    if (!metadata.name || metadata.name.trim() === '') {
      result.errors.push('Template name is required');
    }

    if (!metadata.description || metadata.description.trim() === '') {
      result.errors.push('Template description is required');
    }

    // Validate name format
    if (metadata.name && !/^[a-zA-Z0-9\s\-_]+$/.test(metadata.name)) {
      result.errors.push('Template name contains invalid characters');
    }

    // Validate category format if provided
    if (metadata.category && !/^[a-zA-Z0-9\-_]+$/.test(metadata.category)) {
      result.errors.push('Template category contains invalid characters');
    }

    // Validate variables
    if (metadata.variables) {
      const variableResult = this.validateVariables(metadata.variables);
      result.errors.push(...variableResult.errors);
      result.warnings.push(...variableResult.warnings);
    }

    // Validate version format if provided
    if (metadata.version && !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      result.warnings.push(
        'Version should follow semantic versioning (e.g., 1.0.0)'
      );
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate template content structure and variable usage
   */
  validateContent(
    content: string,
    variables?: TemplateVariable[]
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Check for empty content
    if (!content || content.trim() === '') {
      result.errors.push('Template content cannot be empty');
      result.isValid = false;
      return result;
    }

    // Extract variables used in content
    const usedVariables = this.extractVariablesFromContent(content);
    const definedVariables = new Set(variables?.map((v) => v.name) || []);

    // Check for undefined variables
    for (const variable of usedVariables) {
      if (
        !definedVariables.has(variable) &&
        !this.isBuiltInVariable(variable)
      ) {
        result.errors.push(
          `Variable '${variable}' is used but not defined in metadata`
        );
      }
    }

    // Check for unused variables
    if (variables) {
      for (const variable of variables) {
        if (!usedVariables.has(variable.name)) {
          result.warnings.push(
            `Variable '${variable.name}' is defined but not used in template`
          );
        }
      }
    }

    // Validate variable syntax
    const syntaxErrors = this.validateVariableSyntax(content);
    result.errors.push(...syntaxErrors);

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate variable definitions
   */
  private validateVariables(variables: TemplateVariable[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const variableNames = new Set<string>();

    for (const variable of variables) {
      // Check for required fields
      if (!variable.name || variable.name.trim() === '') {
        result.errors.push('Variable name is required');
        continue;
      }

      if (!variable.description || variable.description.trim() === '') {
        result.errors.push(
          `Variable '${variable.name}' must have a description`
        );
      }

      if (!variable.type) {
        result.errors.push(`Variable '${variable.name}' must have a type`);
      }

      // Check for valid variable name format
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable.name)) {
        result.errors.push(
          `Variable name '${variable.name}' is invalid. Must start with letter and contain only letters, numbers, and underscores`
        );
      }

      // Check for duplicate names
      if (variableNames.has(variable.name)) {
        result.errors.push(`Duplicate variable name '${variable.name}'`);
      }
      variableNames.add(variable.name);

      // Validate type-specific constraints
      this.validateVariableType(variable, result);
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate type-specific constraints for variables
   */
  private validateVariableType(
    variable: TemplateVariable,
    result: ValidationResult
  ): void {
    const validTypes = ['string', 'number', 'boolean', 'date', 'select'];

    if (!validTypes.includes(variable.type)) {
      result.errors.push(
        `Variable '${variable.name}' has invalid type '${variable.type}'`
      );
      return;
    }

    // Validate select type
    if (variable.type === 'select') {
      if (!variable.options || variable.options.length === 0) {
        result.errors.push(
          `Select variable '${variable.name}' must have options defined`
        );
      } else if (
        variable.options.some(
          (option) => typeof option !== 'string' || option.trim() === ''
        )
      ) {
        result.errors.push(
          `Select variable '${variable.name}' has invalid options`
        );
      }
    }

    // Validate default value type
    if (variable.default !== undefined) {
      if (!this.isValidDefaultValue(variable.default, variable.type)) {
        result.errors.push(
          `Variable '${variable.name}' has invalid default value for type '${variable.type}'`
        );
      }
    }
  }

  /**
   * Extract variable names from template content
   */
  private extractVariablesFromContent(content: string): Set<string> {
    const variables = new Set<string>();
    const regex = /{{(\s*[a-zA-Z][a-zA-Z0-9_]*\s*)}}/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const variableName = match[1].trim();
      variables.add(variableName);
    }

    return variables;
  }

  /**
   * Check if a variable is a built-in system variable
   */
  private isBuiltInVariable(variableName: string): boolean {
    const builtInVariables = ['date', 'datetime', 'year', 'month', 'day'];
    return builtInVariables.includes(variableName);
  }

  /**
   * Validate variable syntax in content
   */
  private validateVariableSyntax(content: string): string[] {
    const errors: string[] = [];

    // Check for malformed variable syntax
    const malformedRegex = /{{[^}]*(?:{{|$)|^[^{]*}}/g;
    let match;

    while ((match = malformedRegex.exec(content)) !== null) {
      if (match[0].includes('{{') && !match[0].includes('}}')) {
        errors.push(`Malformed variable syntax: unclosed '{{' found`);
      } else if (match[0].includes('}}') && !match[0].includes('{{')) {
        errors.push(`Malformed variable syntax: unmatched '}}' found`);
      }
    }

    // Check for nested variables
    const nestedRegex = /{{[^}]*{{/g;
    if (nestedRegex.test(content)) {
      errors.push('Nested variables are not allowed');
    }

    return errors;
  }

  /**
   * Validate that default value matches the variable type
   */
  private isValidDefaultValue(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return typeof value === 'string' && !isNaN(Date.parse(value));
      case 'select':
        return typeof value === 'string';
      default:
        return false;
    }
  }

  /**
   * Quick validation for template frontmatter
   */
  validateFrontmatter(frontmatter: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    try {
      // Basic YAML-like parsing validation
      const lines = frontmatter.split('\n');

      for (const line of lines) {
        if (line.trim() === '') {continue;}

        if (!line.includes(':')) {
          result.errors.push(
            `Invalid frontmatter line: '${line}' - missing colon separator`
          );
        }
      }
    } catch (error) {
      result.errors.push(`Invalid frontmatter format: ${error}`);
    }

    result.isValid = result.errors.length === 0;
    return result;
  }
}
