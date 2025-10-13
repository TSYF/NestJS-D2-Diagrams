export interface ModuleInfo {
  name: string;
  filePath: string;
  imports: string[];
  providers: string[];
  controllers: string[];
  exports: string[];
  technology?: string;
  description?: string;
}

export interface ClassInfo {
  name: string;
  filePath: string;
  dependencies: DependencyInfo[];
  isInjectable: boolean;
}

export interface DependencyInfo {
  name: string;
  type: string;
  isOptional: boolean;
  token?: string; // For @Inject() tokens
}

export interface AnalysisResult {
  modules: ModuleInfo[];
  classes: ClassInfo[];
}

export interface DiagramOptions {
  outputDir: string;
  projectPath: string;
  includePrivate?: boolean;
  interactive?: boolean;
  defaultTechnology?: string;
}