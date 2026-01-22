/**
 * Script to create beta users and send welcome emails
 * 
 * Usage:
 *   tsx src/scripts/create-beta-users
 * 
 * Or import and use programmatically:
 *   import { createBetaUsers } from './scripts/create-beta-users';
 *   await createBetaUsers(users);
 */

import { AuthService } from '../services/auth.js';
import { EmailService } from '../utils/email.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export interface BetaUserData {
  first_name: string;
  last_name: string;
  email: string;
  role: 'student' | 'lecturer' | 'admin';
  password: string;
}

/**
 * User data in array format: [first_name, last_name, email, role, password]
 * Password can be omitted (will be auto-generated)
 */
export type BetaUserArray = [string, string, string, 'student' | 'lecturer' | 'admin', string?];

/**
 * Auto-generate password in format: TestBETA-1-{FirstLetterFirstName}{First3LettersLastName}
 * Example: John Doe -> TestBETA-1-JDoe
 * Example: Jane Smith -> TestBETA-1-JSmi
 */
export function generateBetaPassword(firstName: string, lastName: string): string {
  const firstLetter = firstName.charAt(0).toUpperCase();
  const lastThree = lastName.substring(0, 3);
  const betaVersion = process.env['BETA_VERSION'] || '1';
  return `TestBETA-${betaVersion}-${firstLetter}.${lastThree}`;
}

export interface CreateUserResult {
  email: string;
  success: boolean;
  message: string;
  userId?: string;
  emailSent?: boolean;
  error?: string;
  password?: string; // Include generated password in result
}

/**
 * Convert array format to BetaUserData object
 */
export function parseUserArray(userArray: BetaUserArray): BetaUserData {
  const [first_name, last_name, email, role] = userArray;

  return {
    first_name,
    last_name,
    email,
    role,
    password: generateBetaPassword(first_name, last_name),
  };
}

/**
 * Create a single beta user and send welcome email
 */
export async function createBetaUser(userData: BetaUserData | BetaUserArray): Promise<CreateUserResult> {
  // Convert array format to object if needed
  const user = Array.isArray(userData) ? parseUserArray(userData) : userData;

  const result: CreateUserResult = {
    email: user.email,
    success: false,
    message: '',
    password: user.password, // Include password in result
  };

  try {
    // Register the user
    logger.info(`Creating user: ${user.email}`);

    const authResponse = await AuthService.register({
      email: user.email,
      password: user.password,
      confirm_password: user.password,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
    });

    if (!authResponse.success || !authResponse.data?.user) {
      result.message = 'Failed to create user account';
      result.error = 'No user data returned';
      return result;
    }

    result.userId = authResponse.data.user.id;

    result.success = true;
    result.message = 'User created successfully';

    // Send beta confirmation email
    try {
      const fullName = `${user.first_name} ${user.last_name}`;
      const url = user.role === 'student' ? 'student' : 'instructor';
      const appURL = `https://codeendelea.app/${url}`;

      await EmailService.sendBetaConfirmationEmail(
        user.email,
        fullName,
        user.email,
        user.password,
        appURL
      );

      result.emailSent = true;
      result.message = 'User created and email sent successfully';
      logger.info(`✓ User created and email sent: ${user.email}`);
    } catch (emailError) {
      result.emailSent = false;
      result.error = emailError instanceof Error ? emailError.message : 'Unknown error';
      logger.warn(`User created but email failed: ${user.email}`, { error: emailError });
      // Don't fail the whole operation if email fails
    }

    return result;
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.message = `Failed to create user: ${result.error}`;
    logger.error(`✗ Failed to create user: ${user.email}`, { error });
    return result;
  }
}

/**
 * Create multiple beta users and send welcome emails
 * Processes users sequentially to avoid rate limits and maintain order
 * 
 * @param users - Array of users in array format [first_name, last_name, email, role, password?]
 *                or object format BetaUserData[]
 */
export async function createBetaUsers(
  users: (BetaUserData | BetaUserArray)[],
  options?: {
    continueOnError?: boolean; // Continue processing even if one fails (default: true)
    sendEmails?: boolean; // Whether to send emails (default: true)
    delayBetweenUsers?: number; // Delay in ms between users (default: 1000)
  }
): Promise<CreateUserResult[]> {
  const opts = {
    continueOnError: true,
    sendEmails: true,
    delayBetweenUsers: 1000,
    ...options,
  };

  const results: CreateUserResult[] = [];
  const totalUsers = users.length;

  logger.info(`Starting batch creation of ${totalUsers} beta users...`);

  for (let i = 0; i < users.length; i++) {
    const userData = users[i];
    if (!userData) {
      logger.warn(`Skipping undefined user at index ${i}`);
      continue;
    }

    // Convert array format to object if needed
    const user = Array.isArray(userData) ? parseUserArray(userData) : userData;
    logger.info(`Processing user ${i + 1}/${totalUsers}: ${user.email}`);

    try {
      let result: CreateUserResult;

      if (opts.sendEmails) {
        // Create user and send email (normal flow)
        result = await createBetaUser(userData);
      } else {
        // Create user only (skip email)
        const authResponse = await AuthService.register({
          email: user.email,
          password: user.password,
          confirm_password: user.password,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
        });

        result = {
          email: user.email,
          success: authResponse.success && !!authResponse.data?.user,
          message: authResponse.success ? 'User created successfully (email skipped)' : 'Failed to create user',
          ...(authResponse.data?.user?.id && { userId: authResponse.data.user.id }),
          emailSent: false,
          password: user.password,
          ...(authResponse.success ? {} : { error: 'Registration failed' }),
        };
      }

      results.push(result);

      // If error and continueOnError is false, stop processing
      if (!result.success && !opts.continueOnError) {
        logger.error(`Stopping batch creation due to error (continueOnError=false)`);
        break;
      }

      // Add delay between users to avoid rate limiting
      if (i < users.length - 1 && opts.delayBetweenUsers > 0) {
        await new Promise(resolve => setTimeout(resolve, opts.delayBetweenUsers));
      }
    } catch (error) {
      const errorResult: CreateUserResult = {
        email: user.email,
        success: false,
        message: 'Unexpected error during processing',
        password: user.password,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      results.push(errorResult);
      logger.error(`Unexpected error processing user: ${user.email}`, { error });

      if (!opts.continueOnError) {
        break;
      }
    }
  }

  // Print summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const emailsSent = results.filter(r => r.emailSent).length;
  const emailsFailed = results.filter(r => r.success && !r.emailSent).length;

  logger.info('\n=== Batch Creation Summary ===');
  logger.info(`Total users: ${totalUsers}`);
  logger.info(`✓ Successful: ${successful}`);
  logger.info(`✗ Failed: ${failed}`);
  if (opts.sendEmails) {
    logger.info(`📧 Emails sent: ${emailsSent}`);
    logger.info(`⚠️  Emails failed: ${emailsFailed}`);
  }
  logger.info('=============================\n');

  return results;
}

/**
 * Main execution (when run directly as a script)
 */
async function main() {
  // Initialize email service
  if (config.email.enabled) {
    EmailService.initialize();
    const verified = await EmailService.verify();
    if (!verified) {
      logger.warn('Email service verification failed. Emails may not be sent.');
    }
  } else {
    logger.warn('Email service is disabled. Users will be created but no emails will be sent.');
  }

  const betaUsers: BetaUserArray[] = [
    // Example users - replace with your actual user data
    // ['Victor', 'Asum', 'victor.asum@ashesi.edu.gh', 'student'],
    // ['Eldad', 'Opare', 'eldad.opare@ashesi.edu.gh', 'student'],
    // ['Shaun', 'Esua', 'shaun.esua@ashesi.edu.gh', 'student'],
    // ['Shaun', 'Esua', 'shaunemensah@gmail.com', 'lecturer'],
    // ['Victor', 'Asum', 'iamasum369@gmail.com', 'lecturer'],
    // ['Eldad', 'Opare', 'opareeldad@gmail.com', 'lecturer'],
    // ["Marc-Etienne", "Sossou", "sossoumarc2310@gmail.com", "student"],
    // ["Nerrisa", "Abunu", "seshieabunu19357@gmail.com", "student"],
    // ["Nana", "Daasebre Kwaku Adu-Gyamfi", "nanadaasebrekwaku@gmail.com", "student"],
    // ["Jescaps", "Antwi", "antwijescaps1@gmail.com", "student"],
    // ["Edward", "Ofosu Mensah", "eddiemens0462@gmail.com", "student"],
    // ["Nana", "Kwaku Adu-Asomaning", "aduasomaningnanakwaku@gmail.com", "student"],
    // ["Anne", "Segbaya", "segbaya.anne92@gmail.com", "student"],
    // ["Hawa", "Eliasu", "hawa.eliasu@ashesi.edu.gh", "student"],
    // ["Edward", "Anokye", "edwardanokyejnr09@gmail.com", "student"],
    // ["Fadzai", "Zaranyika", "fadzai.zaranyika@ashesi.edu.gh", "student"],
    // ["Jerome", "Selorm Adedze", "jeromeadedze@gmail.com", "student"],
    // ["Shadrack", "", "shadrack.nti@ashesi.edu.gh", "student"],
    // ["Elias", "Aboagye", "eli.aboa@ashesi.edu.gh", "student"],
    // ["Elias", "Adams", "elias.adams@ashesi.edu.gh", "student"],

    // ["Gift", "Ansah Larbj", "giftansah1@gmail.com", "student"],
    // ["Kingsley", "Wunzooya Nahyi", "kingsleynahyi15@gmail.com", "student"],
    // ["Elvis", "Fosu Owusu", "esfokom@gmail.com", "student"],
    // ["Nongyin", "Awindor", "nawindor@gmail.com", "student"],
    // ["Vanessa", "Logan", "logan.anabi@gmail.com", "student"],
    // ["Frank", "Kwizera Mugwaneza", "kwizera.frank@ashesi.edu.gh", "student"],
    // ["Tyrone", "Marhguy", "tmarhguy@seas.upenn.edu", "student"],
    // ["Noah", "Adasi", "noah.adasi@alumni.ashesi.edu.gh", "student"],
    // ["Mariem", "Sall", "mariem.sall@ashesi.edu.gh", "student"],
     //["Daniel", "Tunyinko", "daniel.tunyinko@gmail.com", "student"],
    // ["Gina", "Asang", "ginagana05@gmail.com", "student"],
    // ["Bright", "Boateng", "Bright.boateng@ashesi.edu.gh", "student"],
   // ["Bright", "Boateng", "bright.boateng@ashesi.edu.gh", "student"], 
    // ["William", "Mensah", "william.mensah@ashesi.edu.gh", "student"],
    // ["Jathniel", "Olamide Alade", "jathnielalade@gmail.com", "student"],
    // ["Philemon", "Danso", "philemon.danso@ashesi.edu.gh", "student"],
    // ["Jeffery", "Adunah", "jeffery.adunah@ashesi.edu.gh", "student"]
   // ["Favour", "Amourzang Fri Fon", "famourzangfrifon@gmail.com", "student"],
   //["Micheal", "Adu", "victorasum310@gmail.com", "student"],
   ["Kelvin", "Degbotse", "kelvin@obsessiveinnovations.com", "student"],
  ];

  if (betaUsers.length === 0) {
    logger.warn('No users defined in the script. Please add users to the betaUsers array.');
    logger.info('\nExample usage (array format):');
    logger.info(`
      const betaUsers: BetaUserArray[] = [
        ['John', 'Doe', 'john.doe@example.com', 'student'],
        // Password will be auto-generated: 'TestBETA-1-JDoe'
        
        ['Jane', 'Smith', 'jane.smith@example.com', 'lecturer'],
        // Password will be auto-generated: 'TestBETA-1-JSmi'
        
        ['Bob', 'Johnson', 'bob.johnson@example.com', 'student', 'CustomPassword123!'],
        // With custom password (5th element is optional)
      ];
    `);
    logger.info('\nPassword format: TestBETA-1-{FirstLetterFirstName}{First3LettersLastName}');
    process.exit(0);
  }

  try {
    const results = await createBetaUsers(betaUsers, {
      continueOnError: true, // Continue even if one fails
      sendEmails: config.email.enabled, // Only send if email is enabled
      delayBetweenUsers: 1000, // 1 second delay between users
    });

    // Exit with error code if any failed
    const hasFailures = results.some(r => !r.success);
    if (hasFailures) {
      logger.error('Some users failed to be created. Check the logs above for details.');
      process.exit(1);
    }

    logger.info('All users created successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Fatal error during batch creation:', error);
    process.exit(1);
  } finally {
    // Close email service
    EmailService.close();
  }
}

// Run if executed directly
// This works when the script is run with: tsx src/scripts/create-beta-users
// const scriptName = process.argv[1] || '';
// if (scriptName.includes('create-beta-users')) {
//   main().catch(error => {
//     logger.error('Unhandled error:', error);
//     process.exit(1);
//   });
// }

main().catch(error => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});

