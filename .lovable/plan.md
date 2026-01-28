

# Fix Syntax Error in Funnels.tsx

## Problem Identified

The build is failing due to a syntax error at line 244 in `src/pages/Funnels.tsx`. The error is "Unexpected `}`".

## Root Cause

During the previous code edit, orphaned code was accidentally left in the file. Specifically, lines 241-244 contain a fragment that doesn't belong:

```typescript
// Lines 241-244 - ORPHANED CODE (needs to be removed)
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
```

This fragment appears to be a duplicate from a mutation definition that was already properly closed at line 139 (the `createMutation`'s `onError` handler).

## Current Structure (Broken)

```text
Line 225-229: orgLoading check
Line 231-240: !currentOrganization check with EmptyState return
Line 241-244: ORPHANED CODE ← This breaks the syntax
Line 246+: filteredFunnels and rest of component
```

## Fix Required

Remove lines 241-244 entirely. The file structure will then be:

```text
Line 225-229: orgLoading check
Line 231-240: !currentOrganization check with EmptyState return
Line 242+: filteredFunnels and rest of component (renumbered)
```

## Technical Details

### File: `src/pages/Funnels.tsx`

**Delete lines 241-244:**
```typescript
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
```

This will fix the syntax error and allow the build to succeed.

## Impact

- Fixes the build error immediately
- No functionality is lost (this was duplicate/orphaned code)
- The mutations are already properly defined with their onError handlers earlier in the file

