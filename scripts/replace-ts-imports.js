#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function replaceImports(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist') {
      replaceImports(filePath);
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      // Replace .ts imports with .js for compilation
      const originalContent = content;
      content = content.replace(/from ['"](\.\.?\/[^'"]+\.ts)(['"])/g, "from '$1'.replace(/\\.ts$/, '.js')");
      content = content.replace(/from ['"](\.\.?\/[^'"]+)\.ts(['"])/g, "from '$1.js$2");
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`Replaced imports in: ${filePath}`);
        
        // Store original for restoration
        fs.writeFileSync(filePath + '.orig', originalContent);
      }
    }
  }
}

const srcDir = path.join(__dirname, '..', 'src');
if (fs.existsSync(srcDir)) {
  replaceImports(srcDir);
  console.log('✓ All imports replaced temporarily for build');
} else {
  console.log('✗ src directory not found');
}
