import { ModuleInfo } from '../types';

export class ComponentDiagramGenerator {

  constructor(private containerTitle: string) {}
  
  generate(modules: ModuleInfo[], showNesting: boolean = false): string {
    const lines: string[] = [];
    const containerTitleUpperCamelCase = this.sanitizeName(this.containerTitle.replace(/ /g, ""));
    
    lines.push('# NestJS Component Diagram');
    lines.push('');
    lines.push('direction: right');
    lines.push('');
    lines.push('vars: {');
    lines.push('  d2-config: {');
    lines.push('    theme-id: 303');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    lines.push('classes: {');
    lines.push('  component: {');
    lines.push('    shape: rectangle');
    lines.push('    style.fill: "#63BEF2"');
    lines.push('    style.border-radius: 32');
    lines.push('  }');
    lines.push('  container-expanded: {');
    lines.push('    shape: rectangle');
    lines.push('    style.border-radius: 32');
    lines.push('    style.stroke-dash: 3');
    lines.push('    label.near: bottom-left');
    lines.push('    style.stroke: "#666666"');
    lines.push('    style.font-color: "#333333"');
    lines.push('  }');
    lines.push('  container: {');
    lines.push('    shape: rectangle');
    lines.push('    style.fill: "#23A2D9"');
    lines.push('    style.border-radius: 32');
    lines.push('  }');
    lines.push('  system: {');
    lines.push('    shape: rectangle');
    lines.push('    style.fill: "#1061B0"');
    lines.push('    style.border-radius: 32');
    lines.push('  }');
    lines.push('  external-system: {');
    lines.push('    shape: rectangle');
    lines.push('    style.fill: "#8C8496"');
    lines.push('    style.border-radius: 32');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    lines.push(`${containerTitleUpperCamelCase}: |md`);
    lines.push(`  ## ${this.containerTitle}`);
    lines.push(`  **[Container: NestJS]**`);
    lines.push(`| {`);
    lines.push('  class: [container-expanded]');
    lines.push('}');
    lines.push('');

    // Create nodes for each module
    for (const module of modules) {
      const moduleName = this.sanitizeName(module.name);
      
      // Build the label in C4 markdown style
      let label = `### ${module.name}`;
      
      label += `\n  ---`;
      
      if (module.technology) {
        label += `\n  **[Component: ${module.technology}]**`;
      }
      
      if (module.description) {
        label += `\n\n  ${module.description}`;
      }
      
      // Start module block
      lines.push(`${containerTitleUpperCamelCase}.${moduleName}: |md`);
      lines.push(`  ${label}`);
      lines.push(`| {`);
      lines.push('  class: [component]');
      
      // Only show nesting if explicitly requested (non-interactive mode)
      if (showNesting) {
        // Add providers as nested elements
        if (module.providers.length > 0) {
          lines.push('');
          lines.push('  providers: Providers {');
          lines.push('    shape: rectangle');
          for (const provider of module.providers) {
            const providerName = this.sanitizeName(provider);
            lines.push(`    ${providerName}: ${provider}`);
          }
          lines.push('  }');
        }

        // Add controllers as nested elements
        if (module.controllers.length > 0) {
          lines.push('');
          lines.push('  controllers: Controllers {');
          lines.push('    shape: rectangle');
          for (const controller of module.controllers) {
            const controllerName = this.sanitizeName(controller);
            lines.push(`    ${controllerName}: ${controller}`);
          }
          lines.push('  }');
        }
      }

      lines.push('}');
      lines.push('');
    }

    // Create edges for imports
    for (const module of modules) {
      const moduleName = this.sanitizeName(module.name);
      
      for (const importedModule of module.imports) {
        const importedModuleName = this.sanitizeName(importedModule);
        
        // Check if the imported module exists in our analysis
        const exists = modules.some(m => 
          this.sanitizeName(m.name) === importedModuleName
        );
        
        if (exists) {
          lines.push(`${containerTitleUpperCamelCase}.${moduleName} -> ${containerTitleUpperCamelCase}.${importedModuleName}: imports`);
        }
      }
    }

    return lines.join('\n');
  }

  private sanitizeName(name: string): string {
    // Remove special characters and make valid D2 identifier
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^(\d)/, '_$1'); // D2 identifiers can't start with numbers
  }
}