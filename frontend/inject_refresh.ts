import { Project, SyntaxKind, jsxElement } from "ts-morph";

const project = new Project();
project.addSourceFilesAtPaths("app/**/*.tsx");

const filesToProcess = [
  "app/(tabs)/index.tsx",
  "app/(tabs)/courses.tsx",
  "app/course/[id].tsx",
  "app/(tabs)/library.tsx",
  "app/book/[id].tsx",
  "app/(tabs)/chats.tsx",
  "app/chat/[id].tsx",
  "app/prayer-times.tsx",
  "app/qibla.tsx",
  "app/(tabs)/notifications.tsx",
  "app/status.tsx",
  "app/(tabs)/progress.tsx",
  "app/(tabs)/quiz.tsx",
  "app/(tabs)/attendance.tsx",
  "app/(tabs)/certificate.tsx",
  "app/(tabs)/teachers.tsx",
  "app/teacher/[id].tsx",
  "app/more/index.tsx",
  "app/admin/users.tsx",
  "app/admin/payments.tsx",
  "app/admin/analytics.tsx",
  "app/admin/moderation.tsx",
  "app/admin/manage-academics.tsx",
  "app/admin/security.tsx",
  "app/admin/add-book.tsx",
  "app/admin/privacy-requests.tsx",
  "app/admin/send-push.tsx"
];

for (const filePath of filesToProcess) {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) {
    console.log(`File not found: ${filePath}`);
    continue;
  }

  // Skip if already injected
  if (sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === "@/hooks/usePullToRefresh")) {
    console.log(`Already injected: ${filePath}`);
    continue;
  }

  console.log(`Processing ${filePath}...`);

  // 1. Add Imports
  sourceFile.addImportDeclarations([
    {
      namedImports: ["ScreenRefreshControl"],
      moduleSpecifier: "@/components/ui"
    },
    {
      namedImports: ["usePullToRefresh"],
      moduleSpecifier: "@/hooks/usePullToRefresh"
    }
  ]);

  // 2. Find default export function
  const defaultExport = sourceFile.getDefaultExportSymbol()?.getDeclarations()[0];
  if (!defaultExport || !defaultExport.isKind(SyntaxKind.FunctionDeclaration)) {
    console.log(`No default export function in ${filePath}`);
    continue;
  }

  const funcDecl = defaultExport;
  
  // 3. Determine refetch logic
  const text = funcDecl.getText();
  let refetchLogic = "";
  
  if (text.includes("const { ") && text.includes("useData()")) {
      // It has useData. Check if refetch is extracted.
      refetchLogic = "if (typeof refetch === 'function') await refetch();";
      
      // We must ensure refetch is destructured
      const varDecls = funcDecl.getVariableDeclarations();
      for (const vd of varDecls) {
          const init = vd.getInitializer();
          if (init && init.getText().includes("useData()")) {
              const nameNode = vd.getNameNode();
              if (nameNode.isKind(SyntaxKind.ObjectBindingPattern)) {
                  const elements = nameNode.getElements();
                  const hasRefetch = elements.some(e => e.getName() === "refetch");
                  if (!hasRefetch) {
                      nameNode.addBindingElement({ name: "refetch" });
                  }
              }
          }
      }
  } else if (text.includes("const { ") && text.includes("useAuth()")) {
      refetchLogic = "if (typeof refreshProfile === 'function') await refreshProfile();";
      // Ensure refreshProfile is destructured
      const varDecls = funcDecl.getVariableDeclarations();
      for (const vd of varDecls) {
          const init = vd.getInitializer();
          if (init && init.getText().includes("useAuth()")) {
              const nameNode = vd.getNameNode();
              if (nameNode.isKind(SyntaxKind.ObjectBindingPattern)) {
                  const elements = nameNode.getElements();
                  const hasRefresh = elements.some(e => e.getName() === "refreshProfile");
                  if (!hasRefresh) {
                      nameNode.addBindingElement({ name: "refreshProfile" });
                  }
              }
          }
      }
  } else {
      // Prayer Times, Qibla etc. that don't have useData or useAuth
      refetchLogic = "await new Promise(r => setTimeout(r, 1200));"; // Default fallback
  }

  // 4. Inject hook at the beginning of the function body
  const body = funcDecl.getBody();
  if (body && body.isKind(SyntaxKind.Block)) {
      body.insertStatements(0, `const { refreshing, onRefresh } = usePullToRefresh(async () => { ${refetchLogic} });`);
  }

  // 5. Inject refreshControl into the first ScrollView or FlatList
  const jsxElements = funcDecl.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).concat(
      funcDecl.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
  );
  
  const targetElement = jsxElements.find(el => {
      const tagName = el.getTagNameNode().getText();
      return tagName === "ScrollView" || tagName === "FlatList";
  });

  if (targetElement) {
      targetElement.addAttribute({
          name: "refreshControl",
          initializer: "{<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}"
      });
  } else {
      console.log(`No ScrollView or FlatList found in ${filePath}`);
  }
}

project.saveSync();
console.log("AST manipulation complete!");
