export interface ModuleInfo {
  name: string;
  filePath: string;
  imports: string[];
  providers: string[];
  controllers: string[];
  exports: string[];
  guards?: string[];
  interceptors?: string[];
  pipes?: string[];
  filters?: string[];
  technology?: string;
  description?: string;
}

export interface ClassInfo {
  name: string;
  filePath: string;
  dependencies: DependencyInfo[];
  isInjectable: boolean;
  classType?: 'controller' | 'service' | 'guard' | 'interceptor' | 'pipe' | 'filter' | 'middleware' | 'other';
  moduleContext?: string; // Which module this class belongs to
  properties: PropertyInfo[];
  methods: MethodInfo[];
}

export interface PropertyInfo {
  name: string;
  type: string;
  isPrivate: boolean;
  isReadonly: boolean;
}

export interface MethodInfo {
  name: string;
  returnType: string;
  isPrivate: boolean;
  parameters: string[];
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