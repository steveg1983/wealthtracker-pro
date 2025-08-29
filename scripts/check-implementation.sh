#!/bin/bash

# Feature Completeness Checker
# Run this before marking any feature as complete

echo "🔍 Checking for incomplete implementations..."
echo ""

# Check for TODO comments
echo "📝 Checking for TODO comments..."
TODO_COUNT=$(grep -r "TODO" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
if [ $TODO_COUNT -gt 0 ]; then
    echo "⚠️  Found $TODO_COUNT TODO comments:"
    grep -r "TODO" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -5
    echo ""
fi

# Check for unimplemented functions
echo "🚫 Checking for unimplemented functions..."
UNIMPL_COUNT=$(grep -r "not implemented\|Not implemented\|NOT IMPLEMENTED" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
if [ $UNIMPL_COUNT -gt 0 ]; then
    echo "⚠️  Found $UNIMPL_COUNT unimplemented functions:"
    grep -r "not implemented\|Not implemented\|NOT IMPLEMENTED" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -5
    echo ""
fi

# Check for mock data usage
echo "🎭 Checking for mock data usage..."
MOCK_COUNT=$(grep -r "mock\|Mock\|MOCK\|fake\|Fake\|FAKE\|dummy\|Dummy\|DUMMY" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "mockImplementation\|jest.mock" | wc -l)
if [ $MOCK_COUNT -gt 20 ]; then
    echo "⚠️  High usage of mock/fake/dummy data ($MOCK_COUNT occurrences)"
    echo "   Verify these are intentional test utilities, not placeholder implementations"
    echo ""
fi

# Check TypeScript compilation
echo "📦 Checking TypeScript compilation..."
npm run typecheck 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed!"
    echo ""
else
    echo "✅ TypeScript compilation successful"
    echo ""
fi

# Check build
echo "🔨 Checking build..."
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    echo ""
else
    echo "✅ Build successful"
    echo ""
fi

# Summary
echo "=" 
echo "📊 SUMMARY"
echo "="
if [ $TODO_COUNT -gt 0 ] || [ $UNIMPL_COUNT -gt 0 ]; then
    echo "⚠️  Incomplete implementation detected!"
    echo "   - TODO comments: $TODO_COUNT"
    echo "   - Unimplemented functions: $UNIMPL_COUNT"
    echo ""
    echo "❌ Feature should NOT be marked as complete"
else
    echo "✅ No obvious incomplete implementations found"
    echo "   Still verify:"
    echo "   1. Frontend connects to backend properly"
    echo "   2. Database migrations are created"
    echo "   3. Test the feature end-to-end locally"
fi