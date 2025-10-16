import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';
import { ModuleInfo } from '../types';

export class ModuleAnalyzer {
  private project: Project;

  constructor(projectPath: string) {
    this.project = new Project({
      tsConfigFilePath: `${projectPath}/tsconfig.json`,
      skipAddingFilesFromTsConfig: true,
    });
    this.project.addSourceFilesAtPaths(`${projectPath}/src/**/*.module.ts`);
  }

  analyze(): ModuleInfo[] {
    const modules: ModuleInfo[] = [];
    const sourceFiles = this.project.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      const moduleInfo = this.analyzeModuleFile(sourceFile);
      if (moduleInfo) {
        modules.push(moduleInfo);
      }
    }

    return modules;
  }

  private analyzeModuleFile(sourceFile: SourceFile): ModuleInfo | null {
    const classes = sourceFile.getClasses();

    for (const classDeclaration of classes) {
      const decorator = classDeclaration.getDecorator('Module');
      if (!decorator) continue;

      const decoratorArgs = decorator.getArguments();
      if (decoratorArgs.length === 0) continue;

      const configObject = decoratorArgs[0];
      if (!Node.isObjectLiteralExpression(configObject)) continue;

      const name = classDeclaration.getName() || 'UnknownModule';
      const filePath = sourceFile.getFilePath();

      return {
        name,
        filePath,
        imports: this.extractArrayPropertyValues(configObject, 'imports'),
        providers: this.extractArrayPropertyValues(configObject, 'providers'),
        controllers: this.extractArrayPropertyValues(configObject, 'controllers'),
        exports: this.extractArrayPropertyValues(configObject, 'exports'),
        guards: this.extractArrayPropertyValues(configObject, 'guards'),
        interceptors: this.extractArrayPropertyValues(configObject, 'interceptors'),
        pipes: this.extractArrayPropertyValues(configObject, 'pipes'),
        filters: this.extractArrayPropertyValues(configObject, 'filters'),
      };
    }

    return null;
  }

  private extractArrayPropertyValues(
    objectLiteral: any,
    propertyName: string
  ): string[] {
    const property = objectLiteral.getProperty(propertyName);
    if (!property) return [];

    const initializer = property.getInitializer?.();
    if (!initializer || !Node.isArrayLiteralExpression(initializer)) return [];

    return initializer.getElements().map((element) => {
      // Handle identifiers (e.g., UserService)
      if (Node.isIdentifier(element)) {
        return element.getText();
      }
      
      // Handle property access (e.g., TypeOrmModule.forRoot())
      if (Node.isCallExpression(element)) {
        const expression = element.getExpression();
        if (Node.isPropertyAccessExpression(expression)) {
          return expression.getExpression().getText();
        }
        return expression.getText();
      }

      // Handle property access without calls (e.g., SomeModule)
      if (Node.isPropertyAccessExpression(element)) {
        return element.getExpression().getText();
      }

      return element.getText();
    });
  }
}