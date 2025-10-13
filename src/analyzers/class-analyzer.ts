import { Project, SourceFile, ClassDeclaration, Node, SyntaxKind } from 'ts-morph';
import { ClassInfo, DependencyInfo } from '../types';

export class ClassAnalyzer {
  private project: Project;

  constructor(projectPath: string) {
    this.project = new Project({
      tsConfigFilePath: `${projectPath}/tsconfig.json`,
      skipAddingFilesFromTsConfig: true,
    });
    this.project.addSourceFilesAtPaths(`${projectPath}/src/**/*.ts`);
  }

  analyze(): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      const classInfos = this.analyzeSourceFile(sourceFile);
      classes.push(...classInfos);
    }

    return classes;
  }

  private analyzeSourceFile(sourceFile: SourceFile): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const classDeclarations = sourceFile.getClasses();

    for (const classDeclaration of classDeclarations) {
      const classInfo = this.analyzeClass(classDeclaration, sourceFile);
      if (classInfo) {
        classes.push(classInfo);
      }
    }

    return classes;
  }

  private analyzeClass(
    classDeclaration: ClassDeclaration,
    sourceFile: SourceFile
  ): ClassInfo | null {
    const name = classDeclaration.getName();
    if (!name) return null;

    const dependencies = this.extractDependencies(classDeclaration);
    const isInjectable = this.hasInjectableDecorator(classDeclaration);

    return {
      name,
      filePath: sourceFile.getFilePath(),
      dependencies,
      isInjectable,
    };
  }

  private extractDependencies(classDeclaration: ClassDeclaration): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const constructors = classDeclaration.getConstructors();

    if (constructors.length === 0) return dependencies;

    const constructor = constructors[0];
    const parameters = constructor.getParameters();

    for (const param of parameters) {
      // Try to get the type from the type annotation first
      const typeNode = param.getTypeNode();
      let typeName: string;

      if (typeNode) {
        // Get the text directly from the source code (not resolved)
        typeName = typeNode.getText();
      } else {
        // Fallback to resolved type
        const type = param.getType();
        typeName = type.getText();
      }

      // Clean up the type name
      typeName = this.extractTypeName(typeName);
      
      // Skip primitive types and common non-injectable types
      if (this.isPrimitiveOrCommon(typeName)) continue;

      // Check for @Inject decorator
      const injectDecorator = param.getDecorator('Inject');
      let token: string | undefined;
      
      if (injectDecorator) {
        const args = injectDecorator.getArguments();
        if (args.length > 0) {
          token = args[0].getText().replace(/['"]/g, '');
        }
      }

      // Check if optional (has ? or @Optional decorator)
      const isOptional = param.hasQuestionToken() || param.getDecorator('Optional') !== undefined;

      dependencies.push({
        name: param.getName(),
        type: typeName,
        isOptional,
        token,
      });
    }

    return dependencies;
  }

  private extractTypeName(typeText: string): string {
    // Remove import() wrappers if present
    let cleaned = typeText.replace(/import\([^)]+\)\./g, '');
    
    // Remove array brackets
    cleaned = cleaned.replace(/\[\]/g, '');
    
    // Remove generics
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    
    // Handle union types - take the first non-undefined type
    if (cleaned.includes('|')) {
      const types = cleaned.split('|').map(t => t.trim());
      cleaned = types.find(t => t !== 'undefined' && t !== 'null') || types[0];
    }

    // If it still contains a path separator, extract just the last part (class name)
    if (cleaned.includes('/') || cleaned.includes('\\')) {
      const parts = cleaned.split(/[/\\]/);
      cleaned = parts[parts.length - 1];
      // Remove any remaining quotes or special chars
      cleaned = cleaned.replace(/["']/g, '');
    }

    return cleaned.trim();
  }

  private isPrimitiveOrCommon(typeText: string): boolean {
    const primitives = [
      'string', 'number', 'boolean', 'any', 'unknown', 'void', 'never',
      'String', 'Number', 'Boolean', 'undefined', 'null'
    ];
    
    const cleanType = this.extractTypeName(typeText).toLowerCase();
    return primitives.includes(cleanType);
  }

  private hasInjectableDecorator(classDeclaration: ClassDeclaration): boolean {
    return classDeclaration.getDecorator('Injectable') !== undefined;
  }
}