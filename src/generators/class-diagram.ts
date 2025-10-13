import { ClassInfo } from '../types';

export class ClassDiagramGenerator {
  generate(classes: ClassInfo[]): string {
    const lines: string[] = [];
    
    lines.push('# NestJS Class Diagram');
    lines.push('');
    lines.push('direction: down');
    lines.push('');

    // Filter to only classes that have dependencies or are depended upon
    const relevantClasses = this.findRelevantClasses(classes);

    // Create nodes for each class
    for (const classInfo of relevantClasses) {
      const className = this.sanitizeName(classInfo.name);
      lines.push(`${className}: ${classInfo.name} {`);
      lines.push('  shape: class');
      
      // Add a note if it has @Injectable
      if (classInfo.isInjectable) {
        lines.push('  style.fill: "#e3f2fd"');
      }

      // List dependencies as attributes
      if (classInfo.dependencies.length > 0) {
        lines.push('  # Dependencies');
        for (const dep of classInfo.dependencies) {
          const optional = dep.isOptional ? '?' : '';
          const token = dep.token ? ` (@Inject('${dep.token}'))` : '';
          lines.push(`  ${dep.name}${optional}: ${dep.type}${token}`);
        }
      }

      lines.push('}');
      lines.push('');
    }

    // Create edges for dependencies
    for (const classInfo of relevantClasses) {
      const className = this.sanitizeName(classInfo.name);
      
      for (const dep of classInfo.dependencies) {
        const depClassName = this.sanitizeName(dep.type);
        
        // Check if the dependency class exists in our analysis
        const exists = relevantClasses.some(c => 
          this.sanitizeName(c.name) === depClassName
        );
        
        if (exists) {
          const style = dep.isOptional ? ' {style.stroke-dash: 3}' : '';
          lines.push(`${className} -> ${depClassName}: depends on${style}`);
        }
      }
    }

    return lines.join('\n');
  }

  private findRelevantClasses(classes: ClassInfo[]): ClassInfo[] {
    // Find classes that either have dependencies or are referenced as dependencies
    const classNames = new Set(classes.map(c => c.name));
    const referencedTypes = new Set<string>();

    // Collect all referenced types
    for (const classInfo of classes) {
      for (const dep of classInfo.dependencies) {
        referencedTypes.add(dep.type);
      }
    }

    // Include classes that have dependencies or are referenced
    return classes.filter(classInfo => {
      const hasDependencies = classInfo.dependencies.length > 0;
      const isReferenced = referencedTypes.has(classInfo.name);
      return hasDependencies || isReferenced;
    });
  }

  private sanitizeName(name: string): string {
    // Remove special characters and make valid D2 identifier
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1'); // D2 identifiers can't start with numbers
  }
}