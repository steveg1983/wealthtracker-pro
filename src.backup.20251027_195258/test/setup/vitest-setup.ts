import './test-env'; // Must be first to set environment variables
import '@testing-library/jest-dom/vitest';
import '../mocks/appServices';
import { cleanup } from '@testing-library/react';
import { configureVitestEnvironment } from '@wealthtracker/testing/vitest-setup';

configureVitestEnvironment({ cleanup });
