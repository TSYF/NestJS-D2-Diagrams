import prompts from 'prompts';
import { ModuleInfo } from './types';

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

export async function enrichModuleWithMetadata(
  module: ModuleInfo,
  defaultTechnology: string
): Promise<ModuleInfo> {
  console.log(`\n--- ${module.name} ---`);

  const questions: prompts.PromptObject[] = [];

  // Technology question
  if (defaultTechnology) {
    questions.push({
      type: 'text',
      name: 'technology',
      message: `Technology (press Enter for "${defaultTechnology}"):`,
      initial: defaultTechnology,
    });
  } else {
    questions.push({
      type: 'text',
      name: 'technology',
      message: 'Technology (e.g., NestJS, Spring Boot):',
      initial: 'NestJS',
    });
  }

  // Description question
  questions.push({
    type: 'text',
    name: 'description',
    message: 'Description (what does this module do?):',
    initial: '',
  });

  const answers = await prompts(questions);

  return {
    ...module,
    technology: answers.technology || defaultTechnology || 'NestJS',
    description: answers.description || '',
  };
}