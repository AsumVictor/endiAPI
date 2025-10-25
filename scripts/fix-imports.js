#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      fixImports(filePath);
    } else if (file.endsWith('.js') || file.endsWith('.d.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      // Replace .ts imports with .js
      content = content.replace(/from ['"](.+)\.ts(['"])/g, "from '$1.js$2");
      fs.writeFileSync(filePath, content);
      console.log(`Fixed imports in: ${filePath}`);
    }
  }
}

const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  fixImports(distDir);
  console.log('✓ All imports fixed');
} else {
  console.log('✗ dist directory not found');
}
