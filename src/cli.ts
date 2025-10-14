#!/usr/bin/env node

import { Command } from 'commander';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { ModuleAnalyzer } from './analyzers/module-analyzer';
import { ClassAnalyzer } from './analyzers/class-analyzer';
import { ComponentDiagramGenerator } from './generators/component-diagram';
import { ClassDiagramGenerator } from './generators/class-diagram';
import {
  promptForInteractiveMode,
  promptForDefaultTechnology,
  enrichModuleWithMetadata,
  promptForContainerTitle,
} from './interactive';

const program = new Command();

program
  .name('nest-d2')
  .description('Generate D2 diagrams from NestJS projects')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate component and class diagrams')
  .option('-p, --project <path>', 'Path to NestJS project', process.cwd())
  .option('-o, --output <path>', 'Output directory for diagrams', './diagrams')
  .option('--component-only', 'Generate only component diagram')
  .option('--class-only', 'Generate only class diagram')
  .option('-i, --interactive', 'Enable interactive mode for adding metadata')
  .action(async (options) => {
    try {
      const projectPath = resolve(options.project);
      const outputDir = resolve(options.output);

      console.log(`Analyzing NestJS project at: ${projectPath}`);

      // Check if tsconfig.json exists
      if (!existsSync(`${projectPath}/tsconfig.json`)) {
        console.error('Error: tsconfig.json not found in project root');
        process.exit(1);
      }

      // Create output directory if it doesn't exist
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Check for interactive mode
      let isInteractive = options.interactive;
      let defaultTechnology = '';
      let containerTitle = await promptForContainerTitle();

      if (!isInteractive && !options.classOnly) {
        isInteractive = await promptForInteractiveMode();
      }

      if (isInteractive) {
        defaultTechnology = await promptForDefaultTechnology();
      }

      // Generate component diagram
      if (!options.classOnly) {
        console.log('\nAnalyzing modules...');
        const moduleAnalyzer = new ModuleAnalyzer(projectPath);
        let modules = moduleAnalyzer.analyze();
        
        console.log(`Found ${modules.length} modules`);

        // Enrich modules with metadata if interactive
        if (isInteractive) {
          console.log('\n=== Adding metadata to modules ===');
          const enrichedModules = [];
          for (const module of modules) {
            const enriched = await enrichModuleWithMetadata(module, defaultTechnology);
            enrichedModules.push(enriched);
          }
          modules = enrichedModules;
        }
        
        const componentGen = new ComponentDiagramGenerator(containerTitle);
        const componentD2 = componentGen.generate(modules);
        
        const componentPath = `${outputDir}/component-diagram.d2`;
        writeFileSync(componentPath, componentD2);
        console.log(`\n✓ Component diagram saved to: ${componentPath}`);
      }

      // Generate class diagram
      if (!options.componentOnly) {
        console.log('\nAnalyzing classes...');
        const classAnalyzer = new ClassAnalyzer(projectPath);
        const classes = classAnalyzer.analyze();
        
        console.log(`Found ${classes.length} classes`);
        
        const classGen = new ClassDiagramGenerator();
        const classD2 = classGen.generate(classes);
        
        const classPath = `${outputDir}/class-diagram.d2`;
        writeFileSync(classPath, classD2);
        console.log(`✓ Class diagram saved to: ${classPath}`);
      }

      console.log('\nDone! 🎉');
    } catch (error) {
      console.error('Error generating diagrams:', error);
      process.exit(1);
    }
  });

program.parse();