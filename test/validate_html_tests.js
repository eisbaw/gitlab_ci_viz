#!/usr/bin/env node
/**
 * Simple HTML test validator
 * Validates that HTML test files are well-formed and contain expected test structure
 */

const fs = require('fs');
const path = require('path');

function validateHTMLTest(filePath) {
    console.log(`Validating ${path.basename(filePath)}...`);

    const content = fs.readFileSync(filePath, 'utf-8');

    // Check basic HTML structure
    if (!content.includes('<!DOCTYPE html>')) {
        throw new Error('Missing DOCTYPE declaration');
    }

    if (!content.includes('<html')) {
        throw new Error('Missing <html> tag');
    }

    if (!content.includes('<head>')) {
        throw new Error('Missing <head> tag');
    }

    if (!content.includes('<body>')) {
        throw new Error('Missing <body> tag');
    }

    // Check for test framework elements
    if (!content.includes('class TestRunner') && !content.includes('runner.test')) {
        throw new Error('Missing test framework code');
    }

    // Check for test output elements
    if (!content.includes('id="test-output"') && !content.includes('id="output"') && !content.includes('id="results"')) {
        throw new Error('Missing test output element');
    }

    // Check for summary element (various formats)
    const hasSummary = content.includes('id="summary"') ||
                      content.includes('class="summary"') ||
                      (content.includes('.summary') && content.includes('summaryClass'));
    if (!hasSummary) {
        throw new Error('Missing summary element');
    }

    // Check for script tags
    const scriptMatches = content.match(/<script[^>]*>/g);
    if (!scriptMatches || scriptMatches.length === 0) {
        throw new Error('No script tags found');
    }

    // Count test definitions (support both runner.test and runner.it patterns)
    const testMatches = content.match(/runner\.(test|it)\(/g) || [];
    const testCount = testMatches.length;
    console.log(`  Found ${testCount} test definitions`);

    if (testCount === 0) {
        throw new Error('No tests found');
    }

    console.log(`✓ ${path.basename(filePath)} is valid (${testCount} tests)`);
    return testCount;
}

function main() {
    const testDir = path.join(__dirname);
    const testFiles = [
        'test-api-integration.html',
        'test-data-transformer.html'
    ];

    let totalTests = 0;
    let filesValidated = 0;

    for (const file of testFiles) {
        const filePath = path.join(testDir, file);

        if (!fs.existsSync(filePath)) {
            console.error(`✗ File not found: ${file}`);
            process.exit(1);
        }

        try {
            totalTests += validateHTMLTest(filePath);
            filesValidated++;
        } catch (error) {
            console.error(`✗ Validation failed for ${file}:`);
            console.error(`  ${error.message}`);
            process.exit(1);
        }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log(`✓ All ${filesValidated} HTML test files validated successfully`);
    console.log(`  Total tests defined: ${totalTests}`);
    console.log('='.repeat(60));
    console.log('');
    console.log('To run these tests:');
    console.log('  1. Start server: python serve.py --group 123 --since "1 day ago"');
    console.log('  2. Open in browser: http://localhost:8000/test/test-api-integration.html');
}

main();
