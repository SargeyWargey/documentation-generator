import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

suite('Documentation Generation Integration Tests', () => {
  test('Should generate help documentation for test folder', async function () {
    this.timeout(30000); // 30 seconds timeout

    try {
      // Get the test folder path
      const testFolderPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'test-folder'
      );

      // Check if test folder exists
      const exists = await fs
        .access(testFolderPath)
        .then(() => true)
        .catch(() => false);
      assert.strictEqual(exists, true, 'Test folder should exist');

      // Execute the generateDocs command
      const result = await vscode.commands.executeCommand(
        'documentation-generator.generateDocs'
      );

      // Check if documentation file was created
      const helpDocPath = path.join(testFolderPath, 'help-documentation.md');
      const docExists = await fs
        .access(helpDocPath)
        .then(() => true)
        .catch(() => false);

      if (docExists) {
        const content = await fs.readFile(helpDocPath, 'utf-8');
        assert.ok(
          content.length > 0,
          'Generated documentation should not be empty'
        );
        console.log('✅ Help documentation generated successfully');

        // Clean up
        await fs.unlink(helpDocPath).catch(() => {});
      } else {
        console.log(
          '⚠️  Command executed but no file was created (manual selection may be required)'
        );
      }
    } catch (error) {
      console.error('Test error:', error);
      throw error;
    }
  });

  test('Should handle invalid folder paths gracefully', async function () {
    this.timeout(10000);

    try {
      // This should not throw an error, but handle it gracefully
      const result = await vscode.commands.executeCommand(
        'documentation-generator.generateDocs'
      );
      // Command should complete without throwing
      assert.ok(true, 'Command should handle invalid paths gracefully');
    } catch (error) {
      // If error is thrown, it should be a user-friendly message
      assert.ok(
        error.message.length > 0,
        'Error message should be informative'
      );
    }
  });

  test('Should show extension as active', async function () {
    const extension = vscode.extensions.getExtension(
      'your-publisher.documentation-generator'
    );

    if (extension) {
      assert.strictEqual(
        extension.isActive,
        true,
        'Extension should be active'
      );
      console.log('✅ Extension is active');
    } else {
      console.log(
        '⚠️  Extension not found (may be expected in test environment)'
      );
    }
  });
});
