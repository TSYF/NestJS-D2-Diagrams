# NestJS D2 Diagrams

Generate beautiful C4-style component and class diagrams from your NestJS projects using [D2](https://d2lang.com/).

## Features

- 📦 **Component Diagrams** - Visualize your NestJS modules and their dependencies
- 🔗 **Class Diagrams** - Map out dependency injection relationships between classes
- 🎨 **C4 Model Style** - Generates diagrams following C4 architecture diagram conventions
- 🤝 **Interactive Mode** - Add rich metadata (technology stack, descriptions) to components
- 🎯 **Universal DI Support** - Detects all constructor injections, not just `@Injectable` classes

## Installation

NPM:
```bash
npm install -D nestjs-d2-diagrams
```

Yarn:
```bash
yarn add -D nestjs-d2-diagrams
```

PNPM:
```bash
pnpm add -D nestjs-d2-diagrams
```

## Quick Start

Generate both diagrams
```bash
npx nest-d2 generate
```

Interactive mode (add metadata to components)
```bash
npx nest-d2 generate -i
```

Generate only component diagram
```bash
npx nest-d2 generate --component-only
```

Generate only class diagram
```bash
npx nest-d2 generate --class-only
```

Specify custom paths
```bash
npx nest-d2 generate --project ./my-app --output ./docs/diagrams
```

## Output

The tool generates two D2 files:
- `component-diagram.d2` - Shows modules and their import relationships
- `class-diagram.d2` - Shows classes and their dependency injection relationships

## Rendering Diagrams

Use the [D2 CLI](https://github.com/terrastruct/d2) to render your diagrams:

```bash
# Install D2
curl -fsSL https://d2lang.com/install.sh | sh -s --

# Render to SVG
d2 diagrams/component-diagram.d2 diagrams/component-diagram.svg

# Render with C4 theme (recommended)
d2 --theme=c4 diagrams/component-diagram.d2 diagrams/component-diagram.svg

# Render to PNG
d2 diagrams/class-diagram.d2 diagrams/class-diagram.png
```

## Interactive Mode

When using interactive mode, you'll be prompted to add metadata to each module:

```bash
npx nest-d2 generate -i
```

**Example prompts:**
```
Do you want to add metadata (technology, descriptions) to components? › Yes
Enter default technology for all components: › NestJS

--- UserModule ---
Technology (press Enter for "NestJS"): › [Enter]
Description (what does this module do?): › Handles user authentication and authorization

--- ProductModule ---
Technology (press Enter for "NestJS"): › [Enter]
Description (what does this module do?): › Manages product catalog and inventory
```

This generates C4-style component diagrams with rich descriptions:

```d2
UserModule: |md
  ### UserModule
  ---
  **[Component: NestJS]**

  Handles user authentication and authorization
| {
  class: [component]
}
```

## Component Diagram

Analyzes `*.module.ts` files and extracts:
- Module names
- Imports (dependencies on other modules)
- Providers (services)
- Controllers
- Exports

The diagram shows module relationships and, in non-interactive mode, nested providers and controllers.

## Class Diagram

Analyzes all TypeScript classes and detects:
- Constructor parameter dependencies (typed injections)
- `@Inject()` token-based injections
- Optional dependencies (`?` or `@Optional()`)
- Classes with `@Injectable()` decorator (highlighted in blue)

**Universal DI Detection**: Unlike tools that only look for `@Injectable()` classes, this analyzer detects all constructor injections. This is especially useful for:
- Use cases in Clean/Onion Architecture
- Domain services without decorators
- Any class participating in dependency injection

## CLI Options

```
Usage: nest-d2 generate [options]

Options:
  -p, --project <path>     Path to NestJS project (default: current directory)
  -o, --output <path>      Output directory for diagrams (default: "./diagrams")
  -i, --interactive        Enable interactive mode for adding metadata
  --component-only         Generate only component diagram
  --class-only            Generate only class diagram
  -h, --help              Display help for command
```

## Requirements

- Node.js 16+
- A NestJS project with `tsconfig.json` in the root
- [D2](https://d2lang.com/) CLI for rendering diagrams (optional, for visualization)

## Examples

### Component Diagram Output
```d2
# NestJS Component Diagram

direction: right

AppModule: |md
  ### AppModule
  ---
  **[Component: NestJS]**

  Main application module
| {
  class: [component]
}

UserModule: |md
  ### UserModule
  ---
  **[Component: NestJS]**

  User management and authentication
| {
  class: [component]
}

AppModule -> UserModule: imports
```

### Class Diagram Output
```d2
# NestJS Class Diagram

direction: down

UserController: UserController {
  shape: class
  # Dependencies
  userService: UserService
}

UserService: UserService {
  shape: class
  style.fill: "#e3f2fd"
  # Dependencies
  userRepository: Repository
}

UserController -> UserService: depends on
```

## How It Works

1. **TypeScript AST Parsing** - Uses `ts-morph` to parse your TypeScript source files
2. **Module Analysis** - Extracts `@Module()` decorator metadata from `*.module.ts` files
3. **Class Analysis** - Analyzes constructor parameters to detect all dependency injections
4. **D2 Generation** - Converts the analysis into D2 diagram syntax with C4 styling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- [D2 Language](https://d2lang.com/)
- [C4 Model](https://c4model.com/)
- [NestJS](https://nestjs.com/)