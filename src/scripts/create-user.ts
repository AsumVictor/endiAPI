/**
 * Script to create a user with signup details
 * 
 * Usage:
 *   tsx src/scripts/create-user.ts
 * 
 * Or with command-line arguments:
 *   tsx src/scripts/create-user.ts --email user@example.com --password pass123 --role student --first-name John --last-name Doe
 * 
 * Interactive mode (if arguments not provided):
 *   tsx src/scripts/create-user.ts
 */

import { AuthService } from '../services/auth.js';
import logger from '../utils/logger.js';
import type { RegisterRequest } from '../models/user.js';
import * as readline from 'readline';

/**
 * Parse command-line arguments
 */
function parseArgs(): Partial<RegisterRequest> & { role?: string } {
  const args: Partial<RegisterRequest> & { role?: string } = {};
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const nextArg = process.argv[i + 1];
    
    switch (arg) {
      case '--email':
      case '-e':
        if (nextArg) args.email = nextArg;
        i++;
        break;
      case '--password':
      case '-p':
        if (nextArg) args.password = nextArg;
        i++;
        break;
      case '--confirm-password':
      case '-cp':
        if (nextArg) args.confirm_password = nextArg;
        i++;
        break;
      case '--role':
      case '-r':
        if (nextArg && ['student', 'lecturer', 'admin'].includes(nextArg)) {
          args.role = nextArg as 'student' | 'lecturer' | 'admin';
        }
        i++;
        break;
      case '--first-name':
      case '-fn':
        if (nextArg) args.first_name = nextArg;
        i++;
        break;
      case '--last-name':
      case '-ln':
        if (nextArg) args.last_name = nextArg;
        i++;
        break;
      case '--class-year':
      case '-cy':
        if (nextArg) args.class_year = parseInt(nextArg, 10);
        i++;
        break;
      case '--major':
      case '-m':
        if (nextArg) args.major = nextArg;
        i++;
        break;
      case '--classes-teaching':
      case '-ct':
        if (nextArg) {
          args.classes_teaching = nextArg.split(',').map(c => c.trim());
        }
        i++;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }
  
  return args;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Usage: tsx src/scripts/create-user.ts [OPTIONS]

Options:
  --email, -e <email>              User email address (required)
  --password, -p <password>        User password (required, min 6 characters)
  --confirm-password, -cp <pwd>    Confirm password (required, must match password)
  --role, -r <role>                User role: student, lecturer, or admin (required)
  --first-name, -fn <name>         First name (required)
  --last-name, -ln <name>          Last name (required)
  --class-year, -cy <year>         Class year (optional, for students only)
  --major, -m <major>              Major (optional, for students only)
  --classes-teaching, -ct <list>   Comma-separated list of classes (optional, for lecturers only)
  --help, -h                       Show this help message

Examples:
  # Create a student
  tsx src/scripts/create-user.ts \\
    --email student@example.com \\
    --password password123 \\
    --confirm-password password123 \\
    --role student \\
    --first-name John \\
    --last-name Doe \\
    --class-year 2024 \\
    --major "Computer Science"

  # Create a lecturer
  tsx src/scripts/create-user.ts \\
    --email lecturer@example.com \\
    --password password123 \\
    --confirm-password password123 \\
    --role lecturer \\
    --first-name Jane \\
    --last-name Smith \\
    --classes-teaching "Machine Learning,Python Programming"

  # Run in interactive mode (no arguments)
  tsx src/scripts/create-user.ts
`);
}

/**
 * Create readline interface for interactive input
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt for input
 */
function prompt(question: string): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompt for password (hidden input)
 */
function promptPassword(question: string): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Collect user input interactively
 */
async function collectUserInput(): Promise<RegisterRequest> {
  console.log('\n=== User Signup ===\n');
  
  const email = await prompt('Email: ');
  const password = await promptPassword('Password (min 6 characters): ');
  const confirm_password = await promptPassword('Confirm Password: ');
  const role = await prompt('Role (student/lecturer/admin): ') as 'student' | 'lecturer' | 'admin';
  const first_name = await prompt('First Name: ');
  const last_name = await prompt('Last Name: ');
  
  const registerData: RegisterRequest = {
    email,
    password,
    confirm_password,
    role,
    first_name,
    last_name,
  };
  
  if (role === 'student') {
    const classYearInput = await prompt('Class Year (optional, press Enter to skip): ');
    if (classYearInput) {
      registerData.class_year = parseInt(classYearInput, 10);
    }
    const majorInput = await prompt('Major (optional, press Enter to skip): ');
    if (majorInput) {
      registerData.major = majorInput;
    }
  } else if (role === 'lecturer') {
    const classesInput = await prompt('Classes Teaching (comma-separated, optional, press Enter to skip): ');
    if (classesInput) {
      registerData.classes_teaching = classesInput.split(',').map(c => c.trim());
    }
  }
  
  return registerData;
}

/**
 * Validate user input
 */
function validateInput(data: Partial<RegisterRequest>): string[] {
  const errors: string[] = [];
  
  if (!data.email || !data.email.includes('@')) {
    errors.push('Valid email is required');
  }
  
  if (!data.password || data.password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }
  
  if (data.password !== data.confirm_password) {
    errors.push('Passwords do not match');
  }
  
  if (!data.role || !['student', 'lecturer', 'admin'].includes(data.role)) {
    errors.push('Role must be student, lecturer, or admin');
  }
  
  if (!data.first_name || data.first_name.length < 2) {
    errors.push('First name must be at least 2 characters');
  }
  
  if (!data.last_name || data.last_name.length < 2) {
    errors.push('Last name must be at least 2 characters');
  }
  
  if (data.class_year && isNaN(data.class_year)) {
    errors.push('Class year must be a valid number');
  }
  
  return errors;
}

/**
 * Main execution
 */
async function main() {
  try {
    let userData: RegisterRequest;
    
    // Parse command-line arguments
    const args = parseArgs();
    
  // Check if we have all required arguments
  const hasRequiredArgs = args.email && args.password && args.confirm_password && 
                           args.role && args.first_name && args.last_name;
  
  if (hasRequiredArgs) {
    // Use command-line arguments
    const registerData: RegisterRequest = {
      email: args.email!,
      password: args.password!,
      confirm_password: args.confirm_password || args.password!,
      role: args.role!,
      first_name: args.first_name!,
      last_name: args.last_name!,
    };
    
    // Only include optional fields if they are defined
    if (args.class_year !== undefined) {
      registerData.class_year = args.class_year;
    }
    if (args.major) {
      registerData.major = args.major;
    }
    if (args.classes_teaching) {
      registerData.classes_teaching = args.classes_teaching;
    }
    
    userData = registerData;
  } else {
    // Interactive mode - collect input
    userData = await collectUserInput();
  }
    
    // Validate input
    const validationErrors = validateInput(userData);
    if (validationErrors.length > 0) {
      logger.error('Validation errors:');
      validationErrors.forEach(error => logger.error(`  - ${error}`));
      process.exit(1);
    }
    
    // Create the user
    logger.info(`Creating user: ${userData.email} (${userData.role})...`);
    
    const result = await AuthService.register(userData);
    
    if (result.success) {
      if (result.data?.user) {
        logger.info('✓ User created successfully!');
        logger.info(`  User ID: ${result.data.user.id}`);
        logger.info(`  Email: ${result.data.user.email}`);
        logger.info(`  Role: ${result.data.user.role}`);
        
        if (result.data.profile) {
          logger.info(`  Name: ${result.data.profile.first_name} ${result.data.profile.last_name}`);
        }
        
        process.exit(0);
      } else if (result.message.includes('check your email')) {
        // Email confirmation required
        logger.info('✓ User created successfully!');
        logger.info('  Note: Email confirmation is required. User should check their email to confirm their account.');
        process.exit(0);
      } else {
        logger.warn('User creation may have succeeded, but no user data returned.');
        logger.info(`Message: ${result.message}`);
        process.exit(0);
      }
    } else {
      logger.error('Failed to create user');
      logger.error(`Message: ${result.message}`);
      process.exit(1);
    }
  } catch (error) {
    logger.error('Error creating user:', error);
    
    if (error instanceof Error) {
      logger.error(`Message: ${error.message}`);
      
      // Check for specific Supabase errors
      if (error.message.includes('already exists') || error.message.includes('already registered')) {
        logger.error('User with this email already exists');
      }
    }
    
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('create-user')) {
  main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main as createUser };

