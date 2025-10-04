import * as path from 'path';
import * as fs from 'fs/promises';
import { TemplateVariable } from '../templates/TemplateManager';

export interface ValidationRule {
  name: string;
  validate: (value: any) => ValidationResult;
  sanitize?: (value: any) => any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedValue?: any;
}

export interface ValidationSchema {
  required?: boolean;
  type?:
    | 'string'
    | 'number'
    | 'boolean'
    | 'array'
    | 'object'
    | 'date'
    | 'email'
    | 'url'
    | 'path'
    | 'select';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: ValidationRule[];
}

export class ValidationService {
  private static instance: ValidationService;
  private customRules: Map<string, ValidationRule> = new Map();

  private constructor() {
    this.initializeBuiltInRules();
  }

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  /**
   * Validate and sanitize input data
   */
  validateAndSanitize(data: any, schema: ValidationSchema): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizedValue: data,
    };

    // Check if required
    if (
      schema.required &&
      (data === null || data === undefined || data === '')
    ) {
      result.isValid = false;
      result.errors.push('This field is required');
      return result;
    }

    // Skip validation if data is null/undefined and not required
    if (!schema.required && (data === null || data === undefined)) {
      result.sanitizedValue = data;
      return result;
    }

    // Type validation and sanitization
    const typeResult = this.validateType(data, schema.type);
    if (!typeResult.isValid) {
      result.isValid = false;
      result.errors.push(...typeResult.errors);
    }
    if (typeResult.sanitizedValue !== undefined) {
      result.sanitizedValue = typeResult.sanitizedValue;
    }

    // Length validation for strings and arrays
    if (schema.minLength !== undefined || schema.maxLength !== undefined) {
      const lengthResult = this.validateLength(
        result.sanitizedValue,
        schema.minLength,
        schema.maxLength
      );
      if (!lengthResult.isValid) {
        result.isValid = false;
        result.errors.push(...lengthResult.errors);
      }
    }

    // Numeric range validation
    if (schema.min !== undefined || schema.max !== undefined) {
      const rangeResult = this.validateRange(
        result.sanitizedValue,
        schema.min,
        schema.max
      );
      if (!rangeResult.isValid) {
        result.isValid = false;
        result.errors.push(...rangeResult.errors);
      }
    }

    // Pattern validation
    if (schema.pattern) {
      const patternResult = this.validatePattern(
        result.sanitizedValue,
        schema.pattern
      );
      if (!patternResult.isValid) {
        result.isValid = false;
        result.errors.push(...patternResult.errors);
      }
    }

    // Enum validation
    if (schema.enum) {
      const enumResult = this.validateEnum(result.sanitizedValue, schema.enum);
      if (!enumResult.isValid) {
        result.isValid = false;
        result.errors.push(...enumResult.errors);
      }
    }

    // Custom validation rules
    if (schema.custom) {
      for (const rule of schema.custom) {
        const customResult = rule.validate(result.sanitizedValue);
        if (!customResult.isValid) {
          result.isValid = false;
          result.errors.push(...customResult.errors);
        }
        result.warnings.push(...customResult.warnings);

        if (rule.sanitize && customResult.sanitizedValue !== undefined) {
          result.sanitizedValue = customResult.sanitizedValue;
        }
      }
    }

    return result;
  }

  /**
   * Validate template variables
   */
  validateTemplateVariables(
    variables: Record<string, any>,
    templateVariables: TemplateVariable[]
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizedValue: { ...variables },
    };

    for (const templateVar of templateVariables) {
      const value = variables[templateVar.name];
      const schema = this.templateVariableToSchema(templateVar);

      const varResult = this.validateAndSanitize(value, schema);

      if (!varResult.isValid) {
        result.isValid = false;
        result.errors.push(
          `${templateVar.name}: ${varResult.errors.join(', ')}`
        );
      }

      result.warnings.push(
        ...varResult.warnings.map((w) => `${templateVar.name}: ${w}`)
      );

      if (varResult.sanitizedValue !== undefined) {
        result.sanitizedValue[templateVar.name] = varResult.sanitizedValue;
      }
    }

    return result;
  }

  /**
   * Validate file paths
   */
  validateFilePath(
    filePath: string,
    options?: {
      mustExist?: boolean;
      mustBeDirectory?: boolean;
      allowRelative?: boolean;
      allowedExtensions?: string[];
    }
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizedValue: this.sanitizeFilePath(filePath),
    };

    // Check if path is provided
    if (!filePath || typeof filePath !== 'string') {
      result.isValid = false;
      result.errors.push('File path is required and must be a string');
      return result;
    }

    // Check for dangerous characters
    const dangerousChars = /[<>:"|*?]/;
    if (dangerousChars.test(filePath)) {
      result.isValid = false;
      result.errors.push('File path contains invalid characters');
    }

    // Check if relative paths are allowed
    if (!options?.allowRelative && !path.isAbsolute(result.sanitizedValue)) {
      result.isValid = false;
      result.errors.push('Absolute path is required');
    }

    // Check file extension
    if (options?.allowedExtensions) {
      const ext = path.extname(result.sanitizedValue).toLowerCase();
      if (!options.allowedExtensions.includes(ext)) {
        result.isValid = false;
        result.errors.push(
          `File extension must be one of: ${options.allowedExtensions.join(', ')}`
        );
      }
    }

    return result;
  }

  /**
   * Validate folder paths for analysis
   */
  validateFolderPath(folderPath: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizedValue: this.sanitizeFolderPath(folderPath),
    };

    if (!folderPath || typeof folderPath !== 'string') {
      result.isValid = false;
      result.errors.push('Folder path is required');
      return result;
    }

    // Check for path traversal attempts
    if (folderPath.includes('..')) {
      result.isValid = false;
      result.errors.push('Path traversal not allowed');
    }

    // Check for absolute path requirement
    if (!path.isAbsolute(result.sanitizedValue)) {
      result.warnings.push(
        'Relative paths may not work correctly across different environments'
      );
    }

    return result;
  }

  /**
   * Validate configuration objects
   */
  validateConfiguration(config: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizedValue: this.sanitizeConfiguration(config),
    };

    if (!config || typeof config !== 'object') {
      result.isValid = false;
      result.errors.push('Configuration must be an object');
      return result;
    }

    // Validate specific configuration fields
    const configValidations = [
      {
        field: 'excludePatterns',
        schema: { type: 'array' as const, custom: [this.getRegexArrayRule()] },
      },
      {
        field: 'includePatterns',
        schema: { type: 'array' as const, custom: [this.getRegexArrayRule()] },
      },
      {
        field: 'maxDepth',
        schema: { type: 'number' as const, min: 1, max: 50 },
      },
      {
        field: 'maxFiles',
        schema: { type: 'number' as const, min: 1, max: 100000 },
      },
      {
        field: 'outputDirectory',
        schema: {
          type: 'string' as const,
          custom: [this.getPathValidationRule()],
        },
      },
    ];

    for (const validation of configValidations) {
      if (validation.field in config) {
        const fieldResult = this.validateAndSanitize(
          config[validation.field],
          validation.schema
        );
        if (!fieldResult.isValid) {
          result.isValid = false;
          result.errors.push(
            `${validation.field}: ${fieldResult.errors.join(', ')}`
          );
        }
        result.warnings.push(
          ...fieldResult.warnings.map((w) => `${validation.field}: ${w}`)
        );

        if (fieldResult.sanitizedValue !== undefined) {
          result.sanitizedValue[validation.field] = fieldResult.sanitizedValue;
        }
      }
    }

    return result;
  }

  /**
   * Sanitize user input strings
   */
  sanitizeString(
    input: string,
    options?: {
      removeHtml?: boolean;
      removeScripts?: boolean;
      maxLength?: number;
      allowedChars?: RegExp;
    }
  ): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Remove HTML tags if requested
    if (options?.removeHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Remove script tags specifically
    if (options?.removeScripts) {
      sanitized = sanitized.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        ''
      );
    }

    // Remove non-allowed characters
    if (options?.allowedChars) {
      sanitized = sanitized.replace(options.allowedChars, '');
    }

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length
    if (options?.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Add custom validation rule
   */
  addCustomRule(name: string, rule: ValidationRule): void {
    this.customRules.set(name, rule);
  }

  /**
   * Get custom validation rule
   */
  getCustomRule(name: string): ValidationRule | undefined {
    return this.customRules.get(name);
  }

  private validateType(value: any, type?: string): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitizedValue: value,
    };

    if (!type) {
      return result;
    }

    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          if (value != null) {
            result.sanitizedValue = String(value);
            result.warnings.push('Value converted to string');
          } else {
            result.isValid = false;
            result.errors.push('Value must be a string');
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          const converted = Number(value);
          if (isNaN(converted)) {
            result.isValid = false;
            result.errors.push('Value must be a number');
          } else {
            result.sanitizedValue = converted;
            result.warnings.push('Value converted to number');
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === '1' || lower === 'yes') {
              result.sanitizedValue = true;
              result.warnings.push('Value converted to boolean');
            } else if (lower === 'false' || lower === '0' || lower === 'no') {
              result.sanitizedValue = false;
              result.warnings.push('Value converted to boolean');
            } else {
              result.isValid = false;
              result.errors.push('Value must be a boolean');
            }
          } else {
            result.sanitizedValue = Boolean(value);
            result.warnings.push('Value converted to boolean');
          }
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          result.isValid = false;
          result.errors.push('Value must be an array');
        }
        break;

      case 'object':
        if (
          typeof value !== 'object' ||
          value === null ||
          Array.isArray(value)
        ) {
          result.isValid = false;
          result.errors.push('Value must be an object');
        }
        break;

      case 'date':
        if (!(value instanceof Date)) {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            result.isValid = false;
            result.errors.push('Value must be a valid date');
          } else {
            result.sanitizedValue = date;
            result.warnings.push('Value converted to date');
          }
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value === 'string') {
          result.sanitizedValue = value.toLowerCase().trim();
          if (!emailRegex.test(result.sanitizedValue)) {
            result.isValid = false;
            result.errors.push('Value must be a valid email address');
          }
        } else {
          result.isValid = false;
          result.errors.push('Email must be a string');
        }
        break;

      case 'url':
        if (typeof value === 'string') {
          try {
            new URL(value);
            result.sanitizedValue = value.trim();
          } catch {
            result.isValid = false;
            result.errors.push('Value must be a valid URL');
          }
        } else {
          result.isValid = false;
          result.errors.push('URL must be a string');
        }
        break;

      case 'path':
        if (typeof value === 'string') {
          result.sanitizedValue = this.sanitizeFilePath(value);
        } else {
          result.isValid = false;
          result.errors.push('Path must be a string');
        }
        break;
    }

    return result;
  }

  private validateLength(
    value: any,
    minLength?: number,
    maxLength?: number
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    let length = 0;
    if (typeof value === 'string' || Array.isArray(value)) {
      length = value.length;
    } else {
      return result; // Skip length validation for non-string/array types
    }

    if (minLength !== undefined && length < minLength) {
      result.isValid = false;
      result.errors.push(`Minimum length is ${minLength}, got ${length}`);
    }

    if (maxLength !== undefined && length > maxLength) {
      result.isValid = false;
      result.errors.push(`Maximum length is ${maxLength}, got ${length}`);
    }

    return result;
  }

  private validateRange(
    value: any,
    min?: number,
    max?: number
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (typeof value !== 'number') {
      return result; // Skip range validation for non-numeric types
    }

    if (min !== undefined && value < min) {
      result.isValid = false;
      result.errors.push(`Minimum value is ${min}, got ${value}`);
    }

    if (max !== undefined && value > max) {
      result.isValid = false;
      result.errors.push(`Maximum value is ${max}, got ${value}`);
    }

    return result;
  }

  private validatePattern(value: any, pattern: RegExp): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (typeof value !== 'string') {
      result.isValid = false;
      result.errors.push('Pattern validation requires a string value');
      return result;
    }

    if (!pattern.test(value)) {
      result.isValid = false;
      result.errors.push(
        `Value does not match required pattern: ${pattern.source}`
      );
    }

    return result;
  }

  private validateEnum(value: any, enumValues: any[]): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!enumValues.includes(value)) {
      result.isValid = false;
      result.errors.push(`Value must be one of: ${enumValues.join(', ')}`);
    }

    return result;
  }

  private templateVariableToSchema(
    templateVar: TemplateVariable
  ): ValidationSchema {
    const schema: ValidationSchema = {
      required: templateVar.required,
      type: templateVar.type,
    };

    if (templateVar.type === 'select' && templateVar.options) {
      schema.enum = templateVar.options;
    }

    return schema;
  }

  private sanitizeFilePath(filePath: string): string {
    if (typeof filePath !== 'string') {
      return '';
    }

    // Normalize path separators
    let sanitized = path.normalize(filePath);

    // Remove dangerous characters
    sanitized = sanitized.replace(/[<>:"|*?]/g, '');

    // Remove leading/trailing whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  private sanitizeFolderPath(folderPath: string): string {
    if (typeof folderPath !== 'string') {
      return '';
    }

    // Use file path sanitization as base
    let sanitized = this.sanitizeFilePath(folderPath);

    // Ensure it ends with a path separator for consistency
    if (sanitized && !sanitized.endsWith(path.sep)) {
      sanitized += path.sep;
    }

    return sanitized;
  }

  private sanitizeConfiguration(config: any): any {
    if (!config || typeof config !== 'object') {
      return {};
    }

    const sanitized: any = {};

    // Deep clone and sanitize nested objects
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value, {
          removeHtml: true,
          removeScripts: true,
        });
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'string'
            ? this.sanitizeString(item, {
                removeHtml: true,
                removeScripts: true,
              })
            : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeConfiguration(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private initializeBuiltInRules(): void {
    // Add built-in validation rules
    this.addCustomRule('noPathTraversal', {
      name: 'noPathTraversal',
      validate: (value: any) => {
        const result: ValidationResult = {
          isValid: true,
          errors: [],
          warnings: [],
        };

        if (typeof value === 'string' && value.includes('..')) {
          result.isValid = false;
          result.errors.push('Path traversal not allowed');
        }

        return result;
      },
    });

    this.addCustomRule('safeFileName', {
      name: 'safeFileName',
      validate: (value: any) => {
        const result: ValidationResult = {
          isValid: true,
          errors: [],
          warnings: [],
        };

        if (typeof value === 'string') {
          const dangerousChars = /[<>:"|*?\\\/]/;
          if (dangerousChars.test(value)) {
            result.isValid = false;
            result.errors.push('Filename contains invalid characters');
          }
        }

        return result;
      },
      sanitize: (value: any) => {
        if (typeof value === 'string') {
          return value.replace(/[<>:"|*?\\\/]/g, '_');
        }
        return value;
      },
    });
  }

  private getRegexArrayRule(): ValidationRule {
    return {
      name: 'regexArray',
      validate: (value: any) => {
        const result: ValidationResult = {
          isValid: true,
          errors: [],
          warnings: [],
        };

        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === 'string') {
              try {
                new RegExp(item);
              } catch {
                result.isValid = false;
                result.errors.push(`Invalid regex pattern: ${item}`);
              }
            }
          }
        }

        return result;
      },
    };
  }

  private getPathValidationRule(): ValidationRule {
    return {
      name: 'pathValidation',
      validate: (value: any) => {
        const result: ValidationResult = {
          isValid: true,
          errors: [],
          warnings: [],
        };

        if (typeof value === 'string') {
          if (value.includes('..')) {
            result.isValid = false;
            result.errors.push('Path traversal not allowed');
          }

          const dangerousChars = /[<>:"|*?]/;
          if (dangerousChars.test(value)) {
            result.isValid = false;
            result.errors.push('Path contains invalid characters');
          }
        }

        return result;
      },
      sanitize: (value: any) => {
        if (typeof value === 'string') {
          return this.sanitizeFilePath(value);
        }
        return value;
      },
    };
  }
}
