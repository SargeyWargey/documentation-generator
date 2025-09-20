# Troubleshooting Guide and FAQ

This guide covers common issues, solutions, and frequently asked questions for the Documentation Generator extension.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Extension Loading Problems](#extension-loading-problems)
3. [Documentation Generation Failures](#documentation-generation-failures)
4. [Template Issues](#template-issues)
5. [Claude Code Integration Problems](#claude-code-integration-problems)
6. [Performance Issues](#performance-issues)
7. [Frequently Asked Questions](#frequently-asked-questions)
8. [Getting Help](#getting-help)

## Installation Issues

### Extension Won't Install

**Problem**: Extension installation fails or shows errors

**Solutions**:
1. **Check VS Code version**
   ```bash
   code --version
   ```
   Requires version 1.104.0 or higher

2. **Clear VS Code cache**
   - Close VS Code completely
   - Delete: `~/.vscode/extensions/` (backup first)
   - Restart VS Code and reinstall

3. **Install from VSIX**
   ```bash
   code --install-extension documentation-generator-0.0.1.vsix
   ```

4. **Check disk space**
   - Ensure sufficient disk space (>100MB)
   - Clear temporary files if needed

### Extension Not Appearing

**Problem**: Extension installed but not visible in Extensions list

**Solutions**:
1. **Restart VS Code** completely
2. **Check filter settings** in Extensions view
3. **Verify installation location**:
   ```bash
   ls ~/.vscode/extensions/ | grep documentation-generator
   ```

## Extension Loading Problems

### Extension Won't Activate

**Problem**: Extension appears installed but commands don't work

**Diagnostics**:
1. **Check Output panel**:
   - View → Output
   - Select "Documentation Generator" from dropdown
   - Look for error messages

2. **Check Developer Console**:
   - Help → Toggle Developer Tools
   - Look for JavaScript errors

**Solutions**:
1. **Reload VS Code window**: `Ctrl+Shift+P` → "Developer: Reload Window"
2. **Check Node.js installation**: Required for MCP server mode
3. **Verify extension dependencies**: Check if all required packages are installed

### Commands Not Appearing

**Problem**: Right-click menu doesn't show "Generate Documentation"

**Solutions**:
1. **Check activation events**: Extension activates when VS Code starts
2. **Verify folder selection**: Commands only appear when right-clicking folders
3. **Reset command palette**: `Ctrl+Shift+P` → "Developer: Reset Command Palette"

### Sidebar Not Loading

**Problem**: Documentation Generator sidebar panel is empty or missing

**Solutions**:
1. **Refresh sidebar**: Click refresh button in sidebar
2. **Reset panel**: Close and reopen sidebar panel
3. **Check workspace**: Some features require an open workspace

## Documentation Generation Failures

### Generation Never Completes

**Problem**: Generation starts but never finishes

**Diagnostics**:
1. **Check progress notifications** (if enabled)
2. **Look at Output panel** for error messages
3. **Monitor Claude Code activity** for command execution

**Solutions**:
1. **Check Claude Code Pro status**:
   - Ensure active subscription
   - Verify Claude Code is responding
   - Test with simple Claude command

2. **Reduce scope**:
   - Try smaller folders first
   - Check for extremely large files
   - Use exclusion patterns for unnecessary files

3. **Clear temporary files**:
   ```bash
   rm -rf .claude/commands/documentation-generator-*
   ```

### No Output Generated

**Problem**: Generation completes but no file is created

**Solutions**:
1. **Check output directory permissions**
2. **Verify template validity**
3. **Look for error messages** in Output panel
4. **Try default template** to isolate issue

### Poor Quality Output

**Problem**: Generated documentation is incomplete or inaccurate

**Solutions**:
1. **Improve project structure**:
   - Add README files
   - Include code comments
   - Use meaningful file/folder names

2. **Use better templates**:
   - Add more specific prompts
   - Include example structures
   - Test with known good projects

3. **Provide more context**:
   - Include configuration files
   - Add project documentation
   - Use descriptive variable names

## Template Issues

### Template Not Found

**Problem**: Custom template doesn't appear in selection

**Diagnostics**:
1. **Check template directory path** in settings
2. **Verify file extension** (.md required)
3. **Validate frontmatter** syntax

**Solutions**:
1. **Use absolute path** for template directory
2. **Refresh sidebar** after adding templates
3. **Check file permissions** on template files

### Template Syntax Errors

**Problem**: Template contains syntax errors or doesn't render correctly

**Common Issues**:
```yaml
# Bad YAML
---
name: My Template  # Missing quotes
variables
  - name: var1     # Missing colon
---

# Good YAML
---
name: "My Template"
variables:
  - name: "var1"
---
```

**Solutions**:
1. **Validate YAML** online (e.g., yaml-lint.com)
2. **Check indentation** (use spaces, not tabs)
3. **Escape special characters** in strings
4. **Test incrementally** - start simple, add complexity

### Variable Substitution Fails

**Problem**: Variables show as `{{variableName}}` in output instead of values

**Solutions**:
1. **Check variable names** for typos
2. **Verify variable definition** in frontmatter
3. **Use built-in variables** to test
4. **Enable debug mode** to trace substitution

### Template Performance Issues

**Problem**: Templates take too long to process

**Solutions**:
1. **Simplify complex loops**:
   ```markdown
   <!-- Slow -->
   {{#each allFiles}}
     {{#each allLines}}
       {{content}}
     {{/each}}
   {{/each}}

   <!-- Better -->
   {{#each importantFiles}}
     {{summary}}
   {{/each}}
   ```

2. **Use specific variables** instead of analyzing everything
3. **Break into smaller templates** with includes
4. **Cache frequently used data**

## Claude Code Integration Problems

### Slash Commands Not Working

**Problem**: Commands are created but not executed by Claude Code

**Diagnostics**:
1. **Check `.claude/commands/` directory**:
   ```bash
   ls -la .claude/commands/
   ```

2. **Verify command file format**:
   ```yaml
   name: generate-docs
   description: Generate documentation
   steps:
     - analyze folder structure
     - create documentation
   ```

**Solutions**:
1. **Restart Claude Code Pro** application
2. **Check command permissions**:
   ```bash
   chmod 644 .claude/commands/*
   ```

3. **Verify Claude Code configuration**
4. **Try manual command execution** to test

### MCP Server Connection Issues

**Problem**: MCP server mode doesn't work

**Prerequisites**:
- Node.js installed and accessible
- MCP server properly configured
- Claude Code Pro configured for MCP

**Solutions**:
1. **Test Node.js**:
   ```bash
   node --version
   npm --version
   ```

2. **Check MCP server logs**:
   - Look in VS Code Output panel
   - Check for connection errors

3. **Verify server configuration**:
   ```json
   {
     "mcpServers": {
       "documentation-generator": {
         "command": "node",
         "args": ["path/to/server.js"]
       }
     }
   }
   ```

### Integration Method Switching

**Problem**: Switching between slash commands and MCP server doesn't work

**Solutions**:
1. **Restart VS Code** after changing integration method
2. **Clear cached commands**:
   ```bash
   rm -rf .claude/commands/documentation-generator-*
   ```
3. **Verify new method works** with simple test

## Performance Issues

### Slow Folder Analysis

**Problem**: Analyzing large folders takes too long

**Solutions**:
1. **Use exclusion patterns**:
   ```json
   {
     "documentation-generator.excludePatterns": [
       "**/node_modules/**",
       "**/dist/**",
       "**/.git/**",
       "**/coverage/**"
     ]
   }
   ```

2. **Limit analysis depth**:
   ```json
   {
     "documentation-generator.maxAnalysisDepth": 3
   }
   ```

3. **Process smaller folders** first

### High Memory Usage

**Problem**: Extension uses too much memory

**Solutions**:
1. **Close unused VS Code windows**
2. **Reduce analysis scope**
3. **Restart VS Code** periodically
4. **Check for memory leaks** in Output panel

### Slow Template Processing

**Problem**: Template rendering is slow

**Solutions**:
1. **Optimize template complexity**
2. **Use template caching**
3. **Avoid nested loops**
4. **Process templates incrementally**

## Frequently Asked Questions

### General Usage

**Q: Can I use this extension without Claude Code Pro?**
A: No, the extension requires Claude Code Pro for AI-powered analysis and generation. The extension is designed to integrate with Claude Code Pro's capabilities.

**Q: Does this work with any programming language?**
A: Yes, the extension analyzes folder structure and file content regardless of programming language. However, code-specific analysis works best with popular languages like JavaScript, Python, Java, etc.

**Q: Can I generate documentation for multiple folders at once?**
A: Currently, the extension processes one folder at a time. You can run it multiple times for different folders.

**Q: How long does documentation generation take?**
A: Typically 10-30 seconds depending on folder size and complexity. Large projects (1000+ files) may take longer.

### Templates

**Q: Can I share templates with my team?**
A: Yes, store templates in a shared location (Git repository, shared drive) and point all team members to the same template directory in settings.

**Q: Are there pre-built templates available?**
A: The extension includes default templates for common document types. Additional templates may be available from the community.

**Q: Can templates access external data?**
A: Templates can access file content, package.json data, and git information. They cannot make external API calls for security reasons.

**Q: How do I create multi-file documentation?**
A: Currently, each template generates a single file. Use multiple templates or create templates that include links to other generated documents.

### Customization

**Q: Can I customize the output filename format?**
A: Yes, use the `outputNamePattern` setting with variables like `{template}`, `{date}`, `{folder}`.

**Q: Can I change where documentation is saved?**
A: By default, documentation is saved in the analyzed folder. Use template `output.directory` to specify a different location.

**Q: How do I exclude certain files from analysis?**
A: Use the `excludePatterns` setting to specify files/folders to ignore during analysis.

### Troubleshooting

**Q: Why is my generated documentation incomplete?**
A: Common causes: insufficient project context, missing README files, unclear folder structure, or template limitations. Try adding more documentation to your project.

**Q: The extension stopped working after an update. What should I do?**
A: 1) Restart VS Code, 2) Check for setting changes, 3) Clear extension cache, 4) Reinstall if necessary.

**Q: Can I debug template processing?**
A: Enable debug mode in settings to see detailed logs of template processing and variable substitution.

### Integration

**Q: Which integration method should I use?**
A: Use slash commands (default) for most cases. Use MCP server for advanced workflows or if you need real-time communication with Claude Code Pro.

**Q: Can I use this extension with other Claude integrations?**
A: The extension is designed specifically for Claude Code Pro. Other Claude integrations may not be compatible.

**Q: Does this extension send my code to external servers?**
A: The extension only communicates with Claude Code Pro, which you already have access to. No additional external services are used.

## Getting Help

### Before Reporting Issues

1. **Check this troubleshooting guide**
2. **Update to latest extension version**
3. **Test with a simple project**
4. **Check VS Code and Claude Code Pro versions**
5. **Look at existing GitHub issues**

### Reporting Bugs

When reporting issues, include:

1. **Extension version**: Check in Extensions view
2. **VS Code version**: `code --version`
3. **Operating system**: Windows/Mac/Linux
4. **Steps to reproduce**: Detailed instructions
5. **Error messages**: From Output panel
6. **Project structure**: Example that fails
7. **Template used**: If applicable

### Debug Information Collection

Enable debug mode and collect logs:

```json
{
  "documentation-generator.debugMode": true,
  "documentation-generator.logLevel": "debug"
}
```

1. Reproduce the issue
2. Copy logs from Output panel
3. Include in bug report

### Support Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community support
- **Documentation**: Check all guide documents first
- **VS Code Marketplace**: Reviews and ratings

### Contributing

If you've found a solution to a common problem:

1. **Submit a PR** to update this troubleshooting guide
2. **Share solutions** in GitHub Discussions
3. **Create example templates** for common use cases

---

**Still need help?** Open a GitHub issue with detailed information about your problem, and we'll help you resolve it.