import { Project, SourceFile, ClassDeclaration, Node, SyntaxKind } from 'ts-morph';
import { ClassInfo, DependencyInfo, ModuleInfo, PropertyInfo, MethodInfo } from '../types';

export class ClassAnalyzer {
  private project: Project;

  constructor(projectPath: string) {
    this.project = new Project({
      tsConfigFilePath: `${projectPath}/tsconfig.json`,
      skipAddingFilesFromTsConfig: true,
    });
    this.project.addSourceFilesAtPaths(`${projectPath}/src/**/*.ts`);
  }

  analyze(modules?: ModuleInfo[]): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const sourceFiles = this.project.getSourceFiles();

    // Build a map of class names to their module context
    const classToModuleMap = new Map<string, string>();
    if (modules) {
      for (const module of modules) {
        const allClasses = [
          ...module.controllers,
          ...module.providers,
          ...(module.guards || []),
          ...(module.interceptors || []),
          ...(module.pipes || []),
          ...(module.filters || []),
        ];
        for (const className of allClasses) {
          classToModuleMap.set(className, module.name);
        }
      }
    }

    for (const sourceFile of sourceFiles) {
      // Skip module files
      if (sourceFile.getFilePath().endsWith('.module.ts')) continue;
      
      const classInfos = this.analyzeSourceFile(sourceFile, classToModuleMap);
      classes.push(...classInfos);
    }

    // Filter to include only classes that are either:
    // 1. In a module context (registered in a module)
    // 2. Referenced as a dependency by another class
    const referencedTypes = new Set<string>();
    for (const classInfo of classes) {
      for (const dep of classInfo.dependencies) {
        referencedTypes.add(dep.type);
      }
      // Also add properties and method parameter types as referenced
      for (const prop of classInfo.properties) {
        referencedTypes.add(prop.type);
      }
      for (const method of classInfo.methods) {
        referencedTypes.add(method.returnType);
        for (const param of method.parameters) {
          const typeMatch = param.match(/:\s*(.+)$/);
          if (typeMatch) {
            referencedTypes.add(typeMatch[1].trim());
          }
        }
      }
    }

    return classes.filter(c => c.moduleContext || referencedTypes.has(c.name));
  }

  private analyzeSourceFile(sourceFile: SourceFile, classToModuleMap: Map<string, string>): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const classDeclarations = sourceFile.getClasses();

    for (const classDeclaration of classDeclarations) {
      const classInfo = this.analyzeClass(classDeclaration, sourceFile, classToModuleMap);
      if (classInfo) {
        classes.push(classInfo);
      }
    }

    return classes;
  }

  private analyzeClass(
    classDeclaration: ClassDeclaration,
    sourceFile: SourceFile,
    classToModuleMap: Map<string, string>
  ): ClassInfo | null {
    const name = classDeclaration.getName();
    if (!name) return null;

    const dependencies = this.extractDependencies(classDeclaration);
    const properties = this.extractProperties(classDeclaration);
    const methods = this.extractMethods(classDeclaration);
    const isInjectable = this.hasInjectableDecorator(classDeclaration);
    const classType = this.determineClassType(classDeclaration);
    const moduleContext = classToModuleMap.get(name);

    return {
      name,
      filePath: sourceFile.getFilePath(),
      dependencies,
      properties,
      methods,
      isInjectable,
      classType,
      moduleContext,
    };
  }

  private determineClassType(classDeclaration: ClassDeclaration): ClassInfo['classType'] {
    // Check for specific decorators
    if (classDeclaration.getDecorator('Controller')) return 'controller';
    if (classDeclaration.getDecorator('Injectable')) {
      // Check if it's a guard, interceptor, pipe, or filter by interface/extends
      const implementsClause = classDeclaration.getImplements();
      const extendsClause = classDeclaration.getExtends();
      
      for (const impl of implementsClause) {
        const implName = impl.getText();
        if (implName.includes('Guard')) return 'guard';
        if (implName.includes('Interceptor')) return 'interceptor';
        if (implName.includes('PipeTransform')) return 'pipe';
        if (implName.includes('ExceptionFilter')) return 'filter';
      }
      
      if (extendsClause) {
        const extendsName = extendsClause.getText();
        if (extendsName.includes('Guard')) return 'guard';
        if (extendsName.includes('Interceptor')) return 'interceptor';
      }
      
      return 'service';
    }
    if (classDeclaration.getDecorator('Catch')) return 'filter';
    
    // Check for middleware by interface
    const implementsClause = classDeclaration.getImplements();
    for (const impl of implementsClause) {
      const implName = impl.getText();
      if (implName.includes('NestMiddleware')) return 'middleware';
    }

    return 'other';
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

  private extractProperties(classDeclaration: ClassDeclaration): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    const props = classDeclaration.getProperties();

    for (const prop of props) {
      const name = prop.getName();
      const type = prop.getType().getText();
      const isPrivate = prop.hasModifier(SyntaxKind.PrivateKeyword);
      const isReadonly = prop.isReadonly();

      properties.push({
        name,
        type: this.extractTypeName(type),
        isPrivate,
        isReadonly,
      });
    }

    return properties;
  }

  private extractMethods(classDeclaration: ClassDeclaration): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const methodDeclarations = classDeclaration.getMethods();

    for (const method of methodDeclarations) {
      const name = method.getName();
      
      if (name === 'constructor') continue;

      const isPrivate = method.hasModifier(SyntaxKind.PrivateKeyword);
      
      // ONLY use explicit type annotation from source code
      const returnTypeNode = method.getReturnTypeNode();
      let returnType: string;
      
      if (returnTypeNode) {
        returnType = returnTypeNode.getText();
        // Unwrap Promise<T> to just T
        const promiseMatch = returnType.match(/^Promise<(.+)>$/);
        if (promiseMatch) {
          returnType = promiseMatch[1];
        }
      } else {
        // No annotation - just say the method returns something
        returnType = 'any';
      }
      
      const parameters = method.getParameters().map(p => {
        const paramName = p.getName();
        const paramTypeNode = p.getTypeNode();
        let paramType = paramTypeNode ? paramTypeNode.getText() : 'any';
        // Escape brackets for D2
        paramType = paramType.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
        return `${paramName}: ${paramType}`;
      });

      // Escape brackets in return type
      returnType = returnType.replace(/\[/g, '\\[').replace(/\]/g, '\\]');

      methods.push({
        name,
        returnType,
        isPrivate,
        parameters,
      });
    }

    return methods;
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