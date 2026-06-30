const fs = require('fs');

const performanceProps = `
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}`;

const files = [
  'app/recordings.tsx',
  'app/live-class/index.tsx',
  'app/(tabs)/attendance.tsx',
  'app/admin/users.tsx',
  'app/admin/manage-academics.tsx',
  'app/admin/payments.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Simple naive insertion: if FlatList has data, inject after it
    if (!content.includes('initialNumToRender=')) {
      content = content.replace(/<FlatList\\s+data=\\{([^}]+)\\}/g, "<FlatList\\n            data={$1}" + performanceProps);
      fs.writeFileSync(file, content);
      console.log('Patched ' + file);
    } else {
      console.log('Skipped ' + file + ', already has performance props');
    }
  }
}
