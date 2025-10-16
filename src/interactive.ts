import prompts from 'prompts';
import { ModuleInfo } from './types';
import { readFileSync, existsSync } from 'fs';

interface ExistingMetadata {
  technology?: string;
  description?: string;
}

export function parseExistingD2File(filePath: string, containerName: string): Map<string, ExistingMetadata> {
  const metadataMap = new Map<string, ExistingMetadata>();

  if (!existsSync(filePath)) {
    return metadataMap;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Sanitize container name to match D2 identifier format
    const sanitizedContainer = containerName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
    
    let insideContainerExpanded = false;
    let currentModule: string | null = null;
    let inModuleBlock = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if we're entering the container-expanded block
      if (trimmed.startsWith(`${sanitizedContainer}:`) && trimmed.includes('|md')) {
        insideContainerExpanded = true;
        braceDepth = 0;
        continue;
      }

      // Track brace depth to know when we exit the container
      if (insideContainerExpanded) {
        if (trimmed === '{') braceDepth++;
        if (trimmed === '}') {
          braceDepth--;
          if (braceDepth === 0) {
            insideContainerExpanded = false;
            inModuleBlock = false;
            currentModule = null;
          }
        }
      }

      // Only parse modules inside the container-expanded block
      if (!insideContainerExpanded) continue;

      // Detect module block start: Container.ModuleName: |md
      if (trimmed.includes(': |md') && trimmed.startsWith(`${sanitizedContainer}.`)) {
        const match = trimmed.match(new RegExp(`^${sanitizedContainer}\\.([^:]+):`));
        if (match) {
          currentModule = match[1].trim();
          inModuleBlock = true;
          continue;
        }
      }

      // Inside module block, look for metadata
      if (inModuleBlock && currentModule) {
        // Extract module name from markdown header (### ModuleName)
        if (trimmed.startsWith('###')) {
          const moduleName = trimmed.replace(/^###\s*/, '').trim();
          if (!metadataMap.has(moduleName)) {
            metadataMap.set(moduleName, {});
          }
          currentModule = moduleName;
        }

        // Extract technology: **[Component: NestJS]**
        if (trimmed.includes('[Component:')) {
          const match = trimmed.match(/\[Component:\s*([^\]]+)\]/);
          if (match && currentModule) {
            const metadata = metadataMap.get(currentModule) || {};
            metadata.technology = match[1].trim();
            metadataMap.set(currentModule, metadata);
          }
        }

        // Extract description (any line after technology that's not formatting)
        if (currentModule && !trimmed.startsWith('###') && 
            !trimmed.includes('[Component:') && 
            !trimmed.includes('---') &&
            !trimmed.includes('|') &&
            !trimmed.includes('{') &&
            !trimmed.includes('}') &&
            !trimmed.includes('class:') &&
            trimmed.length > 0) {
          const metadata = metadataMap.get(currentModule) || {};
          if (!metadata.description) {
            metadata.description = trimmed;
            metadataMap.set(currentModule, metadata);
          }
        }

        // End of module block
        if (trimmed === '| {') {
          inModuleBlock = false;
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not parse existing D2 file:', error);
  }

  return metadataMap;
}

export async function promptForContainerTitle(): Promise<string> {
  const response = await prompts({
    type: 'text',
    name: 'container',
    message: 'Please name the container that represents this project',
    initial: '',
  });

  return response.container;
}

export async function promptForInteractiveMode(): Promise<boolean> {
  const response = await prompts({
    type: 'confirm',
    name: 'interactive',
    message: 'Do you want to add metadata (technology, descriptions) to components?',
    initial: false,
  });

  return response.interactive;
}

export async function promptForDefaultTechnology(): Promise<string> {
  const response = await prompts({
    type: 'text',
    name: 'technology',
    message: 'Enter default technology for all components (leave empty to prompt for each):',
    initial: 'NestJS',
  });

  return response.technology || '';
}

export async function promptForClassDiagramOptions(): Promise<{includeAttributes: boolean, includeMethods: boolean}> {
  const responses = await prompts([
    {
      type: 'confirm',
      name: 'includeAttributes',
      message: 'Include class attributes/properties in diagrams?',
      initial: true,
    },
    {
      type: 'confirm',
      name: 'includeMethods',
      message: 'Include class methods in diagrams?',
      initial: true,
    }
  ]);

  return {
    includeAttributes: responses.includeAttributes ?? true,
    includeMethods: responses.includeMethods ?? true,
  };
}

export async function enrichModuleWithMetadata(
  module: ModuleInfo,
  defaultTechnology: string,
  existingMetadata?: ExistingMetadata
): Promise<ModuleInfo> {
  console.log(`\n--- ${module.name} ---`);

  // Use existing metadata as fallback
  const existingTech = existingMetadata?.technology || defaultTechnology || 'NestJS';
  const existingDesc = existingMetadata?.description || '';

  const questions: prompts.PromptObject[] = [];

  // Technology question with existing value as initial
  questions.push({
    type: 'text',
    name: 'technology',
    message: existingMetadata?.technology 
      ? `Technology (press Enter to keep "${existingTech}"):`
      : `Technology (press Enter for "${existingTech}"):`,
    initial: existingTech,
  });

  // Description question with existing value as initial
  questions.push({
    type: 'text',
    name: 'description',
    message: existingMetadata?.description
      ? `Description (press Enter to keep current):`
      : 'Description (what does this module do?):',
    initial: existingDesc,
  });

  const answers = await prompts(questions);

  return {
    ...module,
    technology: answers.technology || existingTech,
    description: answers.description || existingDesc || '',
  };
}