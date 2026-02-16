

# Remove Sign-Up Option from Login Page

## Summary

Remove the Sign Up tab and form from the Auth page so that only the login form is shown. Since only the Super Admin can add new users, self-registration should not be available.

## What Changes

### File: `src/pages/Auth.tsx`

- Remove the `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` wrapper -- replace with just the login form directly
- Remove all signup-related state (`fullName`, `isLogin`) and logic (the `signupSchema`, the `else` branch in `handleSubmit`)
- Remove the `signUp` import from `useAuth`
- Keep the login form, validation, and card layout exactly as they are today

The result will be a clean login-only page with email and password fields and a "Sign In" button -- no tabs, no sign-up option.

## What Does NOT Change

- The `signUp` function stays in `useAuth.tsx` (the `manage-users` edge function or Super Admin flow may still use it internally)
- No database, backend, or any other page is touched
- All existing login behavior remains identical

