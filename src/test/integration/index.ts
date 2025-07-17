// Integration test suite entry point
// This file imports all integration tests to ensure they run together

import './AppFlow.test';
import './ComponentInteraction.test';
import './DataFlow.test';

export * from './AppFlow.test';
export * from './ComponentInteraction.test';
export * from './DataFlow.test';