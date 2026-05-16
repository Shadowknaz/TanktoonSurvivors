const fs = require('fs');
const path = require('path');

function processFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf-8');
  let oldContent = content;

  content = content.replace(/world: any/g, 'world: IWorld');
  content = content.replace(/worldInstance: any/g, 'worldInstance: IWorld');

  if (content.includes('IWorld') && !oldContent.includes('IWorld')) {
    const bitecsImportRegex = /import\s+{([^}]+)}\s+from\s+['"]bitecs['"];?/;
    const match = content.match(bitecsImportRegex);
    if (match) {
      if (!match[1].includes('IWorld')) {
        const newImportStr = `import { ${match[1]}, IWorld } from "bitecs";`;
        content = content.replace(bitecsImportRegex, newImportStr);
      }
    } else {
      content = `import { IWorld } from "bitecs";\n` + content;
    }
  }

  if (content !== oldContent) {
    fs.writeFileSync(filepath, content);
    console.log(`Updated ${filepath}`);
  }
}

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat && stat.isDirectory()) { 
      walk(filepath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      processFile(filepath);
    }
  });
}

walk('src');
