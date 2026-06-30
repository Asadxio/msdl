const fs = require('fs');
const path = require('path');

const APP_DIR = 'app';

function walkSync(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      filelist = walkSync(filepath, filelist);
    } else {
      if (filepath.endsWith('.tsx') || filepath.endsWith('.ts') || filepath.endsWith('.js')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

const files = walkSync(APP_DIR);

let patchedFiles = 0;

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  const originalContent = content;

  // Search Bars & Forms (Input) Standardization
  // We look for 'searchInput: {' or 'input: {' and replace with standard input style.
  // We'll use a regex that matches the block until the closing brace.
  const standardInputStyle = `{
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.textMain,
    fontSize: 14,
  }`;
  
  content = content.replace(/searchInput:\s*\{[^}]+\}/g, `searchInput: ${standardInputStyle}`);
  content = content.replace(/input:\s*\{[^}]+\}/g, `input: ${standardInputStyle}`);

  // Buttons Standardization
  // Primary buttons usually called `btn`, `primaryBtn`, `submitBtn`
  const standardBtnStyle = `{
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  }`;
  
  content = content.replace(/primaryBtn:\s*\{[^}]+\}/g, `primaryBtn: ${standardBtnStyle}`);
  content = content.replace(/submitBtn:\s*\{[^}]+\}/g, `submitBtn: ${standardBtnStyle}`);
  // for "btn:", be careful not to override specific modifiers, but standard "btn: {" is usually primary
  content = content.replace(/\bbtn:\s*\{[^}]+\}/g, `btn: ${standardBtnStyle}`);

  // Secondary buttons
  const standardSecondaryBtnStyle = `{
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  }`;
  content = content.replace(/secondaryBtn:\s*\{[^}]+\}/g, `secondaryBtn: ${standardSecondaryBtnStyle}`);

  // Badges & Chips
  const standardBadgeStyle = `{
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  }`;
  content = content.replace(/roleBadge:\s*\{[^}]+\}/g, `roleBadge: ${standardBadgeStyle}`);
  content = content.replace(/statusBadge:\s*\{[^}]+\}/g, `statusBadge: ${standardBadgeStyle}`);
  content = content.replace(/categoryBadge:\s*\{[^}]+\}/g, `categoryBadge: ${standardBadgeStyle}`);

  // Replace hardcoded values globally in styles block (basic safety passes)
  // borderRadius: 8 -> RADIUS.md
  // borderRadius: 12 -> RADIUS.lg
  // padding: 16 -> SPACING.lg
  // padding: 12 -> SPACING.md
  // padding: 8 -> SPACING.sm
  if (content.includes('StyleSheet.create')) {
    let stylesPart = content.substring(content.indexOf('StyleSheet.create'));
    let preStyles = content.substring(0, content.indexOf('StyleSheet.create'));
    
    stylesPart = stylesPart.replace(/borderRadius:\s*8\b/g, 'borderRadius: RADIUS.md');
    stylesPart = stylesPart.replace(/borderRadius:\s*12\b/g, 'borderRadius: RADIUS.lg');
    stylesPart = stylesPart.replace(/padding:\s*16\b/g, 'padding: SPACING.lg');
    stylesPart = stylesPart.replace(/padding:\s*12\b/g, 'padding: SPACING.md');
    stylesPart = stylesPart.replace(/padding:\s*8\b/g, 'padding: SPACING.sm');
    stylesPart = stylesPart.replace(/paddingHorizontal:\s*16\b/g, 'paddingHorizontal: SPACING.lg');
    stylesPart = stylesPart.replace(/paddingHorizontal:\s*12\b/g, 'paddingHorizontal: SPACING.md');
    stylesPart = stylesPart.replace(/paddingVertical:\s*16\b/g, 'paddingVertical: SPACING.lg');
    stylesPart = stylesPart.replace(/paddingVertical:\s*12\b/g, 'paddingVertical: SPACING.md');
    
    content = preStyles + stylesPart;
  }

  // Inject standard imports if used
  if (content !== originalContent) {
    if (!content.includes('RADIUS')) {
      content = content.replace(/import \{ COLORS/, "import { COLORS, RADIUS");
    }
    if (!content.includes('SPACING')) {
      content = content.replace(/import \{ COLORS/, "import { COLORS, SPACING");
    }
    fs.writeFileSync(filePath, content);
    console.log('Patched', filePath);
    patchedFiles++;
  }
}

files.forEach(patchFile);
console.log('Total patched:', patchedFiles);
