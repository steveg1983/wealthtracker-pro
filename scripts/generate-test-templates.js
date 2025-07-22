#!/usr/bin/env node

/**
 * Test Template Generator
 * Automatically generates basic test file templates for missing tests
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Priority mapping for test generation
const PRIORITY_FILES = {
  high: [
    // Critical services
    'services/storageAdapter.ts',
    'services/enhancedCsvImportService.ts',
    'services/exportService.ts',
    'services/notificationService.ts',
    'services/securityService.ts',
    'services/errorHandlingService.ts',
    'services/indexedDBService.ts',
    'services/baseService.ts',
    
    // State management
    'store/slices/accountsSlice.ts',
    'store/slices/transactionsSlice.ts',
    'store/slices/budgetsSlice.ts',
    'store/slices/goalsSlice.ts',
    'store/slices/categoriesSlice.ts',
    'store/slices/preferencesSlice.ts',
    'contexts/AppContext.tsx',
    'contexts/PreferencesContext.tsx',
    
    // Critical components
    'components/EditTransactionModal.tsx',
    'components/BudgetModal.tsx',
    'components/GoalModal.tsx',
    'components/common/Modal.tsx',
    'components/ErrorBoundary.tsx',
    'components/Layout.tsx',
    
    // Core utilities
    'utils/formatters.ts',
    'utils/csvImport.ts',
    'utils/reconciliation.ts',
    'utils/decimal-converters.ts',
    'hooks/useLocalStorage.ts',
  ]
};

function getTestTemplate(filePath, fileContent) {
  const fileName = path.basename(filePath, path.extname(filePath));
  const isComponent = filePath.includes('components/') || filePath.endsWith('.tsx');
  const isHook = filePath.includes('hooks/') || fileName.startsWith('use');
  const isService = filePath.includes('services/');
  const isContext = filePath.includes('contexts/');
  const isSlice = filePath.includes('slices/');
  const isUtil = filePath.includes('utils/');

  let template = '';

  // Header
  template += `/**\n`;
  template += ` * ${fileName} Tests\n`;
  template += ` * ${getTestDescription(filePath)}\n`;
  template += ` */\n\n`;

  // Imports
  if (isComponent) {
    template += `import React from 'react';\n`;
    template += `import { describe, it, expect, beforeEach, vi } from 'vitest';\n`;
    template += `import { screen, fireEvent, waitFor } from '@testing-library/react';\n`;
    template += `import userEvent from '@testing-library/user-event';\n`;
    template += `import { renderWithProviders } from '../../test/testUtils';\n`;
    template += `import { ${fileName} } from '../${fileName}';\n\n`;
  } else if (isHook) {
    template += `import { renderHook, act } from '@testing-library/react';\n`;
    template += `import { describe, it, expect, beforeEach, vi } from 'vitest';\n`;
    template += `import { ${fileName} } from '../${fileName}';\n\n`;
  } else {
    template += `import { describe, it, expect, beforeEach, vi } from 'vitest';\n`;
    const importPath = isService || isUtil ? `../${fileName}` : `../src/${filePath.replace(/\.(ts|tsx)$/, '')}`;
    template += `import { ${getExportName(fileName, fileContent)} } from '${importPath}';\n\n`;
  }

  // Mock section
  template += generateMockSection(filePath, fileContent);

  // Test suite
  template += `describe('${fileName}', () => {\n`;
  
  if (isComponent) {
    template += generateComponentTests(fileName, fileContent);
  } else if (isHook) {
    template += generateHookTests(fileName, fileContent);
  } else if (isService) {
    template += generateServiceTests(fileName, fileContent);
  } else if (isContext) {
    template += generateContextTests(fileName, fileContent);
  } else if (isSlice) {
    template += generateSliceTests(fileName, fileContent);
  } else if (isUtil) {
    template += generateUtilTests(fileName, fileContent);
  } else {
    template += generateGenericTests(fileName, fileContent);
  }

  template += `});\n`;

  return template;
}

function getTestDescription(filePath) {
  if (filePath.includes('services/')) return 'Service functionality and error handling';
  if (filePath.includes('components/')) return 'Component rendering and user interactions';
  if (filePath.includes('hooks/')) return 'Hook behavior and state management';
  if (filePath.includes('contexts/')) return 'Context provider and consumer behavior';
  if (filePath.includes('slices/')) return 'Redux slice actions and reducers';
  if (filePath.includes('utils/')) return 'Utility functions and edge cases';
  return 'Module functionality and behavior';
}

function generateMockSection(filePath, fileContent) {
  let mocks = '';

  // Common mocks based on content
  if (fileContent.includes('localStorage')) {
    mocks += `// Mock localStorage\n`;
    mocks += `const mockLocalStorage = {\n`;
    mocks += `  getItem: vi.fn(),\n`;
    mocks += `  setItem: vi.fn(),\n`;
    mocks += `  removeItem: vi.fn(),\n`;
    mocks += `  clear: vi.fn(),\n`;
    mocks += `};\n`;
    mocks += `global.localStorage = mockLocalStorage as any;\n\n`;
  }

  if (fileContent.includes('fetch') || fileContent.includes('api')) {
    mocks += `// Mock fetch\n`;
    mocks += `global.fetch = vi.fn();\n\n`;
  }

  if (fileContent.includes('crypto') || fileContent.includes('encrypt')) {
    mocks += `// Mock crypto\n`;
    mocks += `const mockCrypto = {\n`;
    mocks += `  getRandomValues: vi.fn(),\n`;
    mocks += `  subtle: {\n`;
    mocks += `    encrypt: vi.fn(),\n`;
    mocks += `    decrypt: vi.fn(),\n`;
    mocks += `  },\n`;
    mocks += `};\n`;
    mocks += `global.crypto = mockCrypto as any;\n\n`;
  }

  return mocks;
}

function generateComponentTests(fileName, fileContent) {
  return `  const defaultProps = {\n` +
         `    // Add default props based on component interface\n` +
         `  };\n\n` +
         `  beforeEach(() => {\n` +
         `    vi.clearAllMocks();\n` +
         `  });\n\n` +
         `  it('renders without crashing', () => {\n` +
         `    renderWithProviders(<${fileName} {...defaultProps} />);\n` +
         `    expect(screen.getByRole('dialog')).toBeInTheDocument();\n` +
         `  });\n\n` +
         `  it('handles user interactions', async () => {\n` +
         `    const user = userEvent.setup();\n` +
         `    renderWithProviders(<${fileName} {...defaultProps} />);\n` +
         `    \n` +
         `    // Add interaction tests\n` +
         `  });\n\n` +
         `  it('validates form inputs', async () => {\n` +
         `    // Add validation tests\n` +
         `  });\n\n` +
         `  it('handles error states', () => {\n` +
         `    // Add error handling tests\n` +
         `  });\n\n`;
}

function generateHookTests(fileName, fileContent) {
  return `  beforeEach(() => {\n` +
         `    vi.clearAllMocks();\n` +
         `  });\n\n` +
         `  it('initializes with correct default state', () => {\n` +
         `    const { result } = renderHook(() => ${fileName}());\n` +
         `    \n` +
         `    expect(result.current).toBeDefined();\n` +
         `  });\n\n` +
         `  it('updates state correctly', () => {\n` +
         `    const { result } = renderHook(() => ${fileName}());\n` +
         `    \n` +
         `    act(() => {\n` +
         `      // Trigger state update\n` +
         `    });\n` +
         `    \n` +
         `    // Assert state change\n` +
         `  });\n\n` +
         `  it('handles cleanup on unmount', () => {\n` +
         `    const { unmount } = renderHook(() => ${fileName}());\n` +
         `    \n` +
         `    unmount();\n` +
         `    \n` +
         `    // Assert cleanup behavior\n` +
         `  });\n\n`;
}

function generateServiceTests(fileName, fileContent) {
  const serviceName = getExportName(fileName, fileContent);
  
  return `  beforeEach(() => {\n` +
         `    vi.clearAllMocks();\n` +
         `  });\n\n` +
         `  describe('initialization', () => {\n` +
         `    it('initializes successfully', async () => {\n` +
         `      const result = await ${serviceName}.init();\n` +
         `      expect(result).toBe(true);\n` +
         `    });\n\n` +
         `    it('handles initialization errors', async () => {\n` +
         `      // Mock initialization failure\n` +
         `      const result = await ${serviceName}.init();\n` +
         `      expect(result).toBe(false);\n` +
         `    });\n` +
         `  });\n\n` +
         `  describe('core functionality', () => {\n` +
         `    it('performs main operations correctly', async () => {\n` +
         `      // Test core service functionality\n` +
         `    });\n\n` +
         `    it('handles errors gracefully', async () => {\n` +
         `      // Test error scenarios\n` +
         `    });\n` +
         `  });\n\n` +
         `  describe('data validation', () => {\n` +
         `    it('validates input data', () => {\n` +
         `      // Test input validation\n` +
         `    });\n\n` +
         `    it('rejects invalid data', () => {\n` +
         `      // Test invalid input handling\n` +
         `    });\n` +
         `  });\n\n`;
}

function generateContextTests(fileName, fileContent) {
  return `  const TestComponent = () => {\n` +
         `    // Component that uses the context\n` +
         `    return <div>Test Component</div>;\n` +
         `  };\n\n` +
         `  it('provides context values', () => {\n` +
         `    renderWithProviders(<TestComponent />);\n` +
         `    // Test context value provision\n` +
         `  });\n\n` +
         `  it('updates context state', () => {\n` +
         `    // Test context state updates\n` +
         `  });\n\n` +
         `  it('handles context errors', () => {\n` +
         `    // Test error handling\n` +
         `  });\n\n`;
}

function generateSliceTests(fileName, fileContent) {
  const sliceName = fileName.replace('Slice', '');
  
  return `  let store: any;\n\n` +
         `  beforeEach(() => {\n` +
         `    store = configureStore({\n` +
         `      reducer: {\n` +
         `        ${sliceName}: ${fileName}.reducer,\n` +
         `      },\n` +
         `    });\n` +
         `  });\n\n` +
         `  it('has correct initial state', () => {\n` +
         `    const state = store.getState().${sliceName};\n` +
         `    expect(state).toBeDefined();\n` +
         `  });\n\n` +
         `  it('handles add action', () => {\n` +
         `    const newItem = { id: '1', name: 'Test Item' };\n` +
         `    store.dispatch(${fileName}.actions.add${sliceName.charAt(0).toUpperCase() + sliceName.slice(1)}(newItem));\n` +
         `    \n` +
         `    const state = store.getState().${sliceName};\n` +
         `    expect(state.items).toContain(newItem);\n` +
         `  });\n\n` +
         `  it('handles update action', () => {\n` +
         `    // Test update functionality\n` +
         `  });\n\n` +
         `  it('handles remove action', () => {\n` +
         `    // Test remove functionality\n` +
         `  });\n\n`;
}

function generateUtilTests(fileName, fileContent) {
  return `  describe('core functionality', () => {\n` +
         `    it('processes valid input correctly', () => {\n` +
         `      // Test main functionality\n` +
         `    });\n\n` +
         `    it('handles edge cases', () => {\n` +
         `      // Test edge cases\n` +
         `    });\n\n` +
         `    it('validates input parameters', () => {\n` +
         `      // Test input validation\n` +
         `    });\n` +
         `  });\n\n` +
         `  describe('error handling', () => {\n` +
         `    it('handles invalid input gracefully', () => {\n` +
         `      // Test error scenarios\n` +
         `    });\n\n` +
         `    it('throws appropriate errors', () => {\n` +
         `      // Test error throwing\n` +
         `    });\n` +
         `  });\n\n` +
         `  describe('performance', () => {\n` +
         `    it('performs efficiently with large datasets', () => {\n` +
         `      // Test performance\n` +
         `    });\n` +
         `  });\n\n`;
}

function generateGenericTests(fileName, fileContent) {
  return `  it('exports expected functionality', () => {\n` +
         `    // Test that module exports work correctly\n` +
         `  });\n\n` +
         `  it('handles basic operations', () => {\n` +
         `    // Test basic functionality\n` +
         `  });\n\n`;
}

function getExportName(fileName, fileContent) {
  // Try to extract the main export name from file content
  const exportMatch = fileContent.match(/export\s+(?:const|class|function)\s+(\w+)/);
  if (exportMatch) {
    return exportMatch[1];
  }
  
  // Default export pattern
  const defaultExportMatch = fileContent.match(/export\s+default\s+(\w+)/);
  if (defaultExportMatch) {
    return defaultExportMatch[1];
  }
  
  // Fall back to filename
  return fileName;
}

function generateTestFile(filePath) {
  const srcDir = path.join(__dirname, '..', 'src');
  const fullPath = path.join(srcDir, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Source file not found: ${filePath}`);
    return false;
  }
  
  const fileContent = fs.readFileSync(fullPath, 'utf8');
  const testTemplate = getTestTemplate(filePath, fileContent);
  
  // Determine test file path
  const ext = path.extname(filePath);
  const withoutExt = filePath.replace(ext, '');
  const dir = path.dirname(withoutExt);
  const filename = path.basename(withoutExt);
  
  let testPath;
  if (dir.includes('components') || dir.includes('hooks') || dir.includes('utils')) {
    testPath = path.join(srcDir, dir, '__tests__', `${filename}.test${ext === '.tsx' ? '.tsx' : '.ts'}`);
  } else {
    testPath = path.join(srcDir, `${withoutExt}.test${ext === '.tsx' ? '.tsx' : '.ts'}`);
  }
  
  // Create directory if it doesn't exist
  const testDir = path.dirname(testPath);
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  // Write test file
  fs.writeFileSync(testPath, testTemplate);
  console.log(`✅ Created test file: ${path.relative(srcDir, testPath)}`);
  return true;
}

function generateHighPriorityTests() {
  console.log('🚀 Generating High Priority Test Templates\n');
  console.log('=========================================\n');
  
  let generated = 0;
  let skipped = 0;
  
  for (const filePath of PRIORITY_FILES.high) {
    try {
      if (generateTestFile(filePath)) {
        generated++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`❌ Error generating test for ${filePath}:`, error.message);
      skipped++;
    }
  }
  
  console.log('\n📊 Generation Summary:');
  console.log(`✅ Generated: ${generated} test files`);
  console.log(`⚠️  Skipped: ${skipped} files`);
  console.log(`🎯 Total High Priority: ${PRIORITY_FILES.high.length} files`);
  
  if (generated > 0) {
    console.log('\n📝 Next Steps:');
    console.log('1. Review generated test templates');
    console.log('2. Fill in specific test logic');
    console.log('3. Add mock data and assertions');
    console.log('4. Run tests: npm run test:unit');
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'high-priority' || !command) {
    generateHighPriorityTests();
  } else if (command === 'single' && process.argv[3]) {
    generateTestFile(process.argv[3]);
  } else {
    console.log('Usage:');
    console.log('  node generate-test-templates.js high-priority  # Generate high priority tests');
    console.log('  node generate-test-templates.js single <file>  # Generate test for single file');
  }
}