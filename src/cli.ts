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
  parseExistingD2File,
  promptForClassDiagramOptions,
} from './interactive';
import { ModuleInfo } from './types';

const program = new Command();

program
  .name('nest-d2')
  .description('Generate D2 diagrams from NestJS projects')
  .version('1.2.0');

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
      let containerTitle = '';
      let modules: ModuleInfo[] = [];

      // Analyze modules first (needed for both diagrams)
      console.log('\nAnalyzing modules...');
      const moduleAnalyzer = new ModuleAnalyzer(projectPath);
      modules = moduleAnalyzer.analyze();
      console.log(`Found ${modules.length} modules`);

      // Generate component diagram
      if (!options.classOnly) {
        containerTitle = await promptForContainerTitle();

        if (!isInteractive) {
          isInteractive = await promptForInteractiveMode();
        }

        if (isInteractive) {
          defaultTechnology = await promptForDefaultTechnology();
          
          // Check for existing component diagram and parse metadata
          const existingDiagramPath = `${outputDir}/component-diagram.d2`;
          const existingMetadataMap = parseExistingD2File(existingDiagramPath, containerTitle);
          
          if (existingMetadataMap.size > 0) {
            console.log('\n✓ Found existing component diagram with metadata');
          }
          
          console.log('\n=== Adding metadata to modules ===');
          const enrichedModules = [];
          for (const module of modules) {
            const existingMetadata = existingMetadataMap.get(module.name);
            const enriched = await enrichModuleWithMetadata(
              module, 
              defaultTechnology,
              existingMetadata
            );
            enrichedModules.push(enriched);
          }
          modules = enrichedModules;
        }
        
        const componentGen = new ComponentDiagramGenerator(containerTitle);
        // Don't show nesting in interactive mode (only show tech + desc)
        const componentD2 = componentGen.generate(modules, !isInteractive);
        
        const componentPath = `${outputDir}/component-diagram.d2`;
        writeFileSync(componentPath, componentD2);
        console.log(`\n✓ Component diagram saved to: ${componentPath}`);
      }

      // Generate class diagrams
      if (!options.componentOnly) {
        console.log('\nAnalyzing classes...');
        
        // Prompt for class diagram options
        const classOptions = await promptForClassDiagramOptions();
        
        const classAnalyzer = new ClassAnalyzer(projectPath);
        const classes = classAnalyzer.analyze(modules);
        
        console.log(`Found ${classes.length} classes`);
        
        const classGen = new ClassDiagramGenerator(
          classOptions.includeAttributes,
          classOptions.includeMethods
        );
        classGen.generateAll(classes, modules, outputDir);
        
        console.log(`✓ Global class diagram saved to: ${outputDir}/class-diagram-global.d2`);
        console.log(`✓ Component class diagrams saved to: ${outputDir}/class-diagrams/`);
      }

      console.log('\nDone! 🎉');
    } catch (error) {
      console.error('Error generating diagrams:', error);
      process.exit(1);
    }
  });

program.parse();