# How to Run create-beta-users.ts Script

## Option 1: Using npm script (Recommended ✅)

The easiest way - already configured in `package.json`:

```bash
npm run create-beta-users
```

## Option 2: Using npx tsx

Run directly with npx (no need to install tsx globally):

```bash
npx tsx src/scripts/create-beta-users.ts
```

## Option 3: Using tsx directly

If tsx is installed globally:

```bash
tsx src/scripts/create-beta-users.ts
```

## Option 4: Build and run with node

First compile TypeScript to JavaScript:

```bash
# Build the project
npm run build

# Then run the compiled JavaScript
node dist/scripts/create-beta-users.js
```

**Note:** This requires the imports to be fixed (`.ts` → `.js` in compiled code).

## Recommended: Use npm script

```bash
npm run create-beta-users
```

This is the simplest and most reliable method since:
- ✅ It's already configured
- ✅ Uses the correct tsx version from the project
- ✅ Works consistently across different environments
- ✅ No need to remember the full file path

## Environment Variables

Before running, ensure the `.env` file is configured:

```bash
# Required for email sending
EMAIL_ENABLED=true
EMAIL_SERVICE=Gmail
EMAIL_AUTH_USER=email@gmail.com
EMAIL_AUTH_PASSWORD=app-password
EMAIL_FROM_ADDRESS=email@gmail.com
EMAIL_FROM_NAME=CodeEndelea

# Optional: Set beta version (defaults to "1")
BETA_VERSION=1

# Frontend URL for email links
FRONTEND_URL=https://app.example.com
```

## Example Usage

1. Edit `src/scripts/create-beta-users.ts` and add users:
   ```typescript
   const betaUsers: BetaUserArray[] = [
     ['John', 'Doe', 'john@example.com', 'student'],
     ['Jane', 'Smith', 'jane@example.com', 'lecturer'],
   ];
   ```

2. Run the script:
   ```bash
   npm run create-beta-users
   ```

That's it! The script will create users and send emails automatically.

