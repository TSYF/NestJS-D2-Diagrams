import { ClassInfo, ModuleInfo } from '../types';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

export class ClassDiagramGenerator {
  private includeAttributes: boolean;
  private includeMethods: boolean;

  constructor(includeAttributes: boolean = true, includeMethods: boolean = true) {
    this.includeAttributes = includeAttributes;
    this.includeMethods = includeMethods;
  }

  generateAll(classes: ClassInfo[], modules: ModuleInfo[], outputDir: string): void {
    // Create class-diagrams subdirectory
    const classDiagramsDir = `${outputDir}/class-diagrams`;
    if (!existsSync(classDiagramsDir)) {
      mkdirSync(classDiagramsDir, { recursive: true });
    }

    // Generate global diagram
    const globalD2 = this.generateGlobal(classes, modules);
    writeFileSync(`${outputDir}/class-diagram-global.d2`, globalD2);

    // Generate per-component diagrams
    for (const module of modules) {
      const componentD2 = this.generateForComponent(module, classes, modules);
      const sanitizedModuleName = this.sanitizeName(module.name);
      writeFileSync(`${classDiagramsDir}/${sanitizedModuleName}.d2`, componentD2);
    }
  }

  generateGlobal(classes: ClassInfo[], modules: ModuleInfo[]): string {
    const lines: string[] = [];
    
    lines.push('# NestJS Class Diagram - Global');
    lines.push('');
    lines.push('direction: down');
    lines.push('');
    this.addClassDefinitions(lines);
    lines.push('');

    // Group classes by module
    const moduleMap = new Map<string, ClassInfo[]>();
    const ungrouped: ClassInfo[] = [];

    for (const classInfo of classes) {
      if (classInfo.moduleContext) {
        if (!moduleMap.has(classInfo.moduleContext)) {
          moduleMap.set(classInfo.moduleContext, []);
        }
        moduleMap.get(classInfo.moduleContext)!.push(classInfo);
      } else {
        ungrouped.push(classInfo);
      }
    }

    // Create expanded containers for each module
    for (const [moduleName, moduleClasses] of moduleMap) {
      const sanitizedModuleName = this.sanitizeName(moduleName);
      
      lines.push(`${sanitizedModuleName}: ${moduleName} {`);
      lines.push('  class: [container-expanded]');
      lines.push('');

      for (const classInfo of moduleClasses) {
        this.addClassNode(lines, classInfo, '  ');
      }

      lines.push('}');
      lines.push('');
    }

    // Add ungrouped classes
    for (const classInfo of ungrouped) {
      this.addClassNode(lines, classInfo, '');
    }

    // Add all edges with full paths
    for (const classInfo of classes) {
      const className = this.sanitizeName(classInfo.name);
      const sourceFullPath = classInfo.moduleContext 
        ? `${this.sanitizeName(classInfo.moduleContext)}.${className}`
        : className;
      
      for (const dep of classInfo.dependencies) {
        const depClassName = this.sanitizeName(dep.type);
        const depClass = classes.find(c => c.name === dep.type);
        if (!depClass) continue;
        
        const targetFullPath = depClass.moduleContext
          ? `${this.sanitizeName(depClass.moduleContext)}.${depClassName}`
          : depClassName;
        
        const style = dep.isOptional ? ' {style.stroke-dash: 3}' : '';
        lines.push(`${sourceFullPath} -> ${targetFullPath}: depends on${style}`);
      }
    }

    return lines.join('\n');
  }

  generateForComponent(module: ModuleInfo, allClasses: ClassInfo[], allModules: ModuleInfo[]): string {
    const lines: string[] = [];
    
    lines.push(`# NestJS Class Diagram - ${module.name}`);
    lines.push('');
    lines.push('direction: down');
    lines.push('');
    this.addClassDefinitions(lines);
    lines.push('');

    // Get classes directly in this module
    const moduleClasses = allClasses.filter(c => c.moduleContext === module.name);
    
    // Get all dependencies of module classes
    const allDependencies = new Set<string>();
    for (const classInfo of moduleClasses) {
      for (const dep of classInfo.dependencies) {
        allDependencies.add(dep.type);
      }
    }

    // Find dependency classes and group them by module
    const dependencyClassesByModule = new Map<string, ClassInfo[]>();
    const localDependencies: ClassInfo[] = [];

    for (const depName of allDependencies) {
      const depClass = allClasses.find(c => c.name === depName);
      if (!depClass) continue;

      if (depClass.moduleContext === module.name) {
        // Already in our module, will be shown at root
        continue;
      } else if (depClass.moduleContext) {
        // From another module - group it
        if (!dependencyClassesByModule.has(depClass.moduleContext)) {
          dependencyClassesByModule.set(depClass.moduleContext, []);
        }
        dependencyClassesByModule.get(depClass.moduleContext)!.push(depClass);
      } else {
        // No module context - show at root
        localDependencies.push(depClass);
      }
    }

    // Build a set of all modules that will be rendered as containers
    const renderedModules = new Set<string>();
    renderedModules.add(module.name);
    for (const depModuleName of dependencyClassesByModule.keys()) {
      renderedModules.add(depModuleName);
    }

    // Create this module's container
    const sanitizedModuleName = this.sanitizeName(module.name);
    lines.push(`${sanitizedModuleName}: ${module.name} {`);
    lines.push('  class: [container-expanded]');
    lines.push('');

    for (const classInfo of moduleClasses) {
      this.addClassNode(lines, classInfo, '  ');
    }

    lines.push('}');
    lines.push('');

    // Create expanded containers for dependency modules
    for (const [depModuleName, depClasses] of dependencyClassesByModule) {
      const sanitizedDepModuleName = this.sanitizeName(depModuleName);
      
      lines.push(`${sanitizedDepModuleName}: ${depModuleName} {`);
      lines.push('  class: [container-expanded]');
      lines.push('');

      for (const classInfo of depClasses) {
        this.addClassNode(lines, classInfo, '  ');
      }

      lines.push('}');
      lines.push('');
    }

    // Add ungrouped dependencies
    for (const classInfo of localDependencies) {
      this.addClassNode(lines, classInfo, '');
    }

    // Add edges - NO module prefixes since classes are nested inside containers
    for (const classInfo of moduleClasses) {
      const className = this.sanitizeName(classInfo.name);
      const sourceFullPath = `${sanitizedModuleName}.${className}`;
      
      for (const dep of classInfo.dependencies) {
        const depClassName = this.sanitizeName(dep.type);
        const depClass = allClasses.find(c => c.name === dep.type);
        if (!depClass) continue;
        
        let targetFullPath: string;
        if (depClass.moduleContext && renderedModules.has(depClass.moduleContext)) {
          targetFullPath = `${this.sanitizeName(depClass.moduleContext)}.${depClassName}`;
        } else {
          targetFullPath = depClassName;
        }
        
        const style = dep.isOptional ? ' {style.stroke-dash: 3}' : '';
        lines.push(`${sourceFullPath} -> ${targetFullPath}: depends on${style}`);
      }
    }

    return lines.join('\n');
  }

  private addClassDefinitions(lines: string[]): void {
    lines.push('classes: {');
    lines.push('  container-expanded: {');
    lines.push('    shape: rectangle');
    lines.push('    style.border-radius: 32');
    lines.push('    style.stroke-dash: 3');
    lines.push('    label.near: bottom-left');
    lines.push('    style.stroke: "#666666"');
    lines.push('    style.font-color: "#333333"');
    lines.push('  }');
    lines.push('}');
  }

  private addClassNode(lines: string[], classInfo: ClassInfo, indent: string): void {
    const className = this.sanitizeName(classInfo.name);
    lines.push(`${indent}${className}: ${classInfo.name} {`);
    lines.push(`${indent}  shape: class`);
    
    if (classInfo.isInjectable) {
      lines.push(`${indent}  style.fill: "#e3f2fd"`);
    }

    // Add properties/attributes
    if (this.includeAttributes && classInfo.properties.length > 0) {
      for (const prop of classInfo.properties) {
        if (prop.isPrivate) continue;
        const readonly = prop.isReadonly ? 'readonly ' : '';
        lines.push(`${indent}  ${readonly}${prop.name}: ${prop.type}`);
      }
    }

    // Add dependency injections
    if (classInfo.dependencies.length > 0) {
      lines.push(`${indent}  # Dependencies`);
      for (const dep of classInfo.dependencies) {
        const optional = dep.isOptional ? '?' : '';
        const token = dep.token ? ` (@Inject('${dep.token}'))` : '';
        lines.push(`${indent}  ${dep.name}${optional}: ${dep.type}${token}`);
      }
    }

    // Add methods
    if (this.includeMethods && classInfo.methods.length > 0) {
      for (const method of classInfo.methods) {
        if (method.isPrivate) continue;
        const params = method.parameters.join(', ');
        lines.push(`${indent}  ${method.name}(${params}): ${method.returnType}`);
      }
    }

    lines.push(`${indent}}`);
    lines.push('');
  }

  private sanitizeName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1');
  }
}