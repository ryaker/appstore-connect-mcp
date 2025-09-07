// /**
//  * Unified App Submission Tool
//  * Pure TypeScript implementation for building IPA and submitting to App Store Connect
//  * Export as function only - no CLI
//  */

// const { spawn } = require('child_process');
// const fs = require('fs').promises;
// const path = require('path');

// export interface SubmitAppOptions {
//   // Xcode project parameters
//   xcodeProject?: string;
//   xcodeWorkspace?: string;
//   scheme?: string;
//   target?: string;
//   configuration?: string;
//   clean?: boolean;
  
//   // Build directories
//   archiveDirectory?: string;
//   ipaDirectory?: string;
//   exportOptionsPlist?: string;
//   removeXcarchive?: boolean;
  
//   // App Store Connect API authentication
//   keyIdentifier?: string;
//   issuerId?: string;
//   privateKey?: string;
//   privateKeyPath?: string;
//   teamId?: string;
  
//   // Alternative authentication
//   appleId?: string;
//   appSpecificPassword?: string;
  
//   // App Store submission parameters
//   submitToAppStore?: boolean;
//   versionString?: string;
//   whatsNew?: string;
//   description?: string;
//   keywords?: string;
//   marketingUrl?: string;
//   supportUrl?: string;
//   copyright?: string;
//   earliestReleaseDate?: string;
//   phasedRelease?: boolean;
//   cancelPreviousSubmissions?: boolean;
  
//   // Processing options
//   maxBuildProcessingWait?: number;
  
//   // General options
//   verbose?: boolean;
// }

// export class SubmitAppException extends Error {
//   constructor(message: string) {
//     super(message);
//     this.name = 'SubmitAppException';
//   }
// }

// class SubmitApp {
//   private verbose: boolean = false;

//   constructor(verbose: boolean = false) {
//     this.verbose = verbose;
//   }

//   private log(message: string, level: 'INFO' | 'ERROR' | 'DEBUG' = 'INFO'): void {
//     if (this.verbose || level === 'ERROR') {
//       console.log(`[${level}] ${message}`);
//     }
//   }

//   private async runCommand(
//     command: string,
//     args: string[],
//     options: { cwd?: string; env?: Record<string, string> } = {}
//   ): Promise<{ stdout: string; stderr: string; code: number }> {
//     return new Promise((resolve) => {
//       this.log(`Running command: ${command} ${args.join(' ')}`);
      
//       const child = spawn(command, args, {
//         cwd: options.cwd || process.cwd(),
//         env: { ...process.env, ...options.env },
//         stdio: ['pipe', 'pipe', 'pipe']
//       });

//       let stdout = '';
//       let stderr = '';

//       child.stdout?.on('data', (data) => {
//         stdout += data.toString();
//         if (this.verbose) {
//           process.stdout.write(data);
//         }
//       });

//       child.stderr?.on('data', (data) => {
//         stderr += data.toString();
//         if (this.verbose) {
//           process.stderr.write(data);
//         }
//       });

//       child.on('close', (code) => {
//         resolve({ stdout, stderr, code: code || 0 });
//       });

//       child.on('error', (error) => {
//         resolve({ stdout, stderr: error.message, code: -1 });
//       });
//     });
//   }

//   private async buildXcodeArchive(options: SubmitAppOptions): Promise<string> {
//     this.log('Building Xcode archive...');

//     const archiveDirectory = options.archiveDirectory || './build/archives';
//     const archiveName = `${options.scheme || 'App'}-${Date.now()}.xcarchive`;
//     const archivePath = path.join(archiveDirectory, archiveName);

//     // Ensure archive directory exists
//     await fs.mkdir(archiveDirectory, { recursive: true });

//     // Build xcodebuild archive command
//     const cmd = ['xcodebuild', 'archive'];

//     // Add project/workspace
//     if (options.xcodeProject) {
//       cmd.push('-project', options.xcodeProject);
//     } else if (options.xcodeWorkspace) {
//       cmd.push('-workspace', options.xcodeWorkspace);
//     }

//     // Add build parameters
//     if (options.scheme) cmd.push('-scheme', options.scheme);
//     if (options.configuration) cmd.push('-configuration', options.configuration);
//     if (options.target) cmd.push('-target', options.target);

//     // Add archive path
//     cmd.push('-archivePath', archivePath);

//     // Add build settings
//     cmd.push('-destination', 'generic/platform=iOS');
//     cmd.push('SKIP_INSTALL=NO');
//     cmd.push('BUILD_LIBRARY_FOR_DISTRIBUTION=YES');

//     // Clean if requested
//     if (options.clean) {
//       const cleanCmd = ['xcodebuild', 'clean'];
//       if (options.xcodeProject) {
//         cleanCmd.push('-project', options.xcodeProject);
//       } else if (options.xcodeWorkspace) {
//         cleanCmd.push('-workspace', options.xcodeWorkspace);
//       }
//       if (options.scheme) cleanCmd.push('-scheme', options.scheme);

//       const cleanResult = await this.runCommand('xcodebuild', cleanCmd.slice(1));
//       if (cleanResult.code !== 0) {
//         throw new SubmitAppException(`Clean failed: ${cleanResult.stderr}`);
//       }
//     }

//     const result = await this.runCommand('xcodebuild', cmd.slice(1));
//     if (result.code !== 0) {
//       throw new SubmitAppException(`Archive build failed: ${result.stderr}`);
//     }

//     this.log(`Successfully created archive: ${archivePath}`);
//     return archivePath;
//   }

//   private async exportIpaFromArchive(archivePath: string, options: SubmitAppOptions): Promise<string> {
//     this.log('Exporting IPA from archive...');

//     const ipaDirectory = options.ipaDirectory || './build/ipa';
//     await fs.mkdir(ipaDirectory, { recursive: true });

//     // Create export options plist if not provided
//     let exportOptionsPlist = options.exportOptionsPlist;
//     if (!exportOptionsPlist) {
//       exportOptionsPlist = path.join(ipaDirectory, 'ExportOptions.plist');
//       const exportOptions = {
//         method: 'app-store',
//         uploadBitcode: false,
//         uploadSymbols: true,
//         compileBitcode: false,
//         teamID: '', // Will be filled by Xcode automatically
//         destination: 'export'
//       };

//       const plistContent = this.createPlistContent(exportOptions);
//       await fs.writeFile(exportOptionsPlist, plistContent);
//       this.log(`Created export options plist: ${exportOptionsPlist}`);
//     }

//     // Build export command
//     const cmd = [
//       'xcodebuild',
//       '-exportArchive',
//       '-archivePath', archivePath,
//       '-exportPath', ipaDirectory,
//       '-exportOptionsPlist', exportOptionsPlist
//     ];

//     const result = await this.runCommand('xcodebuild', cmd.slice(1));
//     if (result.code !== 0) {
//       throw new SubmitAppException(`IPA export failed: ${result.stderr}`);
//     }

//     // Find the exported IPA
//     const files = await fs.readdir(ipaDirectory);
//     const ipaFiles = files.filter((file: string) => file.endsWith('.ipa'));
    
//     if (ipaFiles.length === 0) {
//       throw new SubmitAppException('No IPA file found after export');
//     }

//     const ipaPath = path.join(ipaDirectory, ipaFiles[0]);
//     this.log(`Successfully exported IPA: ${ipaPath}`);

//     // Clean up archive if requested
//     if (options.removeXcarchive) {
//       await fs.rmdir(archivePath, { recursive: true });
//       this.log(`Removed archive: ${archivePath}`);
//     }

//     return ipaPath;
//   }

//   private createPlistContent(options: any): string {
//     return `<?xml version="1.0" encoding="UTF-8"?>
// <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
// <plist version="1.0">
// <dict>
//     <key>method</key>
//     <string>${options.method}</string>
//     <key>uploadBitcode</key>
//     <${options.uploadBitcode}/>
//     <key>uploadSymbols</key>
//     <${options.uploadSymbols}/>
//     <key>compileBitcode</key>
//     <${options.compileBitcode}/>
//     <key>destination</key>
//     <string>${options.destination}</string>
// </dict>
// </plist>`;
//   }

//   private async uploadIpaWithNotarytool(ipaPath: string, options: SubmitAppOptions): Promise<void> {
//     this.log(`Uploading IPA to App Store Connect: ${ipaPath}`);

//     // Build notarytool command
//     const cmd = ['xcrun', 'notarytool', 'submit', ipaPath];

//     // Add authentication
//     if (options.keyIdentifier && options.issuerId) {
//       cmd.push('--key-id', options.keyIdentifier);
//       cmd.push('--issuer-id', options.issuerId);
      
//       // Handle private key
//       if (options.privateKeyPath) {
//         cmd.push('--key', options.privateKeyPath);
//       } else if (options.privateKey) {
//         // Write private key to temporary file
//         const tempKeyPath = path.join(process.cwd(), `temp_key_${Date.now()}.p8`);
//         await fs.writeFile(tempKeyPath, options.privateKey);
//         cmd.push('--key', tempKeyPath);
        
//         // Clean up temp file after upload
//         setTimeout(async () => {
//           try {
//             await fs.unlink(tempKeyPath);
//           } catch (error) {
//             this.log(`Warning: Could not delete temporary key file: ${error}`, 'DEBUG');
//           }
//         }, 5000);
//       } else {
//         throw new SubmitAppException('Private key required: either privateKeyPath or privateKey must be provided');
//       }
//     } else if (options.appleId && options.appSpecificPassword) {
//       cmd.push('--apple-id', options.appleId);
//       cmd.push('--password', options.appSpecificPassword);
//       if (options.teamId) {
//         cmd.push('--team-id', options.teamId);
//       }
//     } else {
//       throw new SubmitAppException('Authentication required: either API key (keyIdentifier + issuerId + privateKey) or Apple ID credentials');
//     }

//     // Add output format
//     cmd.push('--output-format', 'json');
//     cmd.push('--wait');

//     const result = await this.runCommand('xcrun', cmd.slice(1));
//     if (result.code !== 0) {
//       throw new SubmitAppException(`IPA upload failed: ${result.stderr}`);
//     }

//     try {
//       const response = JSON.parse(result.stdout);
//       if (response.status === 'Accepted') {
//         this.log(`Upload successful. Submission ID: ${response.id}`);
//         this.log(`Status: ${response.status}`);
//         if (response.message) {
//           this.log(`Message: ${response.message}`);
//         }
//       } else {
//         this.log(`Upload status: ${response.status}`);
//         if (response.statusSummary) {
//           this.log(`Status summary: ${response.statusSummary}`);
//         }
//       }
//     } catch {
//       // If not JSON, just log the output
//       this.log(`Upload completed: ${result.stdout}`);
//     }

//     this.log('Successfully uploaded IPA to App Store Connect');
//   }

//   private async checkNotarizationStatus(submissionId: string, options: SubmitAppOptions): Promise<any> {
//     this.log(`Checking notarization status for submission: ${submissionId}`);

//     const cmd = ['xcrun', 'notarytool', 'info', submissionId];

//     // Add authentication (same as upload)
//     if (options.keyIdentifier && options.issuerId) {
//       cmd.push('--key-id', options.keyIdentifier);
//       cmd.push('--issuer-id', options.issuerId);
      
//       if (options.privateKeyPath) {
//         cmd.push('--key', options.privateKeyPath);
//       } else if (options.privateKey) {
//         const tempKeyPath = path.join(process.cwd(), `temp_key_${Date.now()}.p8`);
//         await fs.writeFile(tempKeyPath, options.privateKey);
//         cmd.push('--key', tempKeyPath);
        
//         setTimeout(async () => {
//           try {
//             await fs.unlink(tempKeyPath);
//           } catch (error) {
//             this.log(`Warning: Could not delete temporary key file: ${error}`, 'DEBUG');
//           }
//         }, 5000);
//       }
//     } else if (options.appleId && options.appSpecificPassword) {
//       cmd.push('--apple-id', options.appleId);
//       cmd.push('--password', options.appSpecificPassword);
//       if (options.teamId) {
//         cmd.push('--team-id', options.teamId);
//       }
//     }

//     cmd.push('--output-format', 'json');

//     const result = await this.runCommand('xcrun', cmd.slice(1));
//     if (result.code !== 0) {
//       throw new SubmitAppException(`Failed to check notarization status: ${result.stderr}`);
//     }

//     try {
//       return JSON.parse(result.stdout);
//     } catch {
//       this.log(`Raw status output: ${result.stdout}`);
//       return { status: 'Unknown', message: result.stdout };
//     }
//   }

//   private async waitForBuildProcessing(
//     bundleId: string, 
//     version: string, 
//     options: SubmitAppOptions
//   ): Promise<string> {
//     this.log('Waiting for build to be processed...');
    
//     const maxWait = (options.maxBuildProcessingWait || 600) * 1000; // Convert to milliseconds
//     const startTime = Date.now();
//     const pollInterval = 30000; // 30 seconds

//     while (Date.now() - startTime < maxWait) {
//       try {
//         // This would need to be implemented with App Store Connect API calls
//         // For now, just wait a reasonable amount of time
//         await new Promise(resolve => setTimeout(resolve, pollInterval));
        
//         // In a real implementation, you would:
//         // 1. Use App Store Connect API to check build status
//         // 2. Return build ID when processed
//         // 3. Handle different build states
        
//         this.log('Build processing check (placeholder implementation)');
//         break; // For now, just break after one check
//       } catch (error) {
//         this.log(`Error checking build status: ${error}`, 'ERROR');
//         await new Promise(resolve => setTimeout(resolve, pollInterval));
//       }
//     }

//     // Placeholder build ID - in real implementation this would come from API
//     return 'build-id-placeholder';
//   }

//   private async submitToAppStoreReview(buildId: string, options: SubmitAppOptions): Promise<void> {
//     this.log('Submitting to App Store review...');
    
//     // This would be implemented using App Store Connect API
//     // For now, this is a placeholder that shows the structure
    
//     if (!options.submitToAppStore) {
//       this.log('Skipping App Store submission (submit-to-app-store not specified)');
//       return;
//     }

//     // In a real implementation, this would:
//     // 1. Create or update App Store Version
//     // 2. Set version metadata (description, what's new, etc.)
//     // 3. Create review submission
//     // 4. Submit for review
    
//     this.log('App Store submission would be implemented here with App Store Connect API');
//     this.log(`Build ID: ${buildId}`);
//     this.log(`Version: ${options.versionString || 'Not specified'}`);
//     this.log(`What's New: ${options.whatsNew || 'Not specified'}`);
//   }

//   async buildIpa(options: SubmitAppOptions): Promise<string> {
//     this.log('Starting IPA build process...');

//     // Step 1: Build archive
//     const archivePath = await this.buildXcodeArchive(options);

//     // Step 2: Export IPA
//     const ipaPath = await this.exportIpaFromArchive(archivePath, options);

//     return ipaPath;
//   }

//   async submitToAppStore(ipaPath: string, options: SubmitAppOptions): Promise<void> {
//     this.log('Starting App Store submission process...');

//     // Step 1: Upload IPA
//     await this.uploadIpaWithNotarytool(ipaPath, options);

//     // Step 2: Wait for processing (if submitting to App Store)
//     if (options.submitToAppStore) {
//       const buildId = await this.waitForBuildProcessing(
//         'bundle-id-placeholder', // Would extract from IPA
//         options.versionString || '1.0.0',
//         options
//       );

//       // Step 3: Submit to App Store review
//       await this.submitToAppStoreReview(buildId, options);
//     }
//   }

//   async submitApp(options: SubmitAppOptions): Promise<string> {
//     try {
//       this.verbose = options.verbose || false;

//       // Validate required parameters
//       if (!options.xcodeProject && !options.xcodeWorkspace) {
//         throw new SubmitAppException('Either xcodeProject or xcodeWorkspace must be specified');
//       }

//       // Step 1: Build IPA
//       const ipaPath = await this.buildIpa(options);

//       // Step 2: Submit to App Store Connect
//       await this.submitToAppStore(ipaPath, options);

//       this.log('App submission completed successfully!');
//       return ipaPath;

//     } catch (error) {
//       if (error instanceof SubmitAppException) {
//         this.log(`App submission failed: ${error.message}`, 'ERROR');
//         throw error;
//       } else {
//         this.log(`Unexpected error: ${error}`, 'ERROR');
//         throw new SubmitAppException(`Unexpected error: ${error}`);
//       }
//     }
//   }
// }

// /**
//  * Build IPA and submit to App Store Connect
//  * @param options - Configuration options for building and submitting
//  * @returns Promise that resolves to the path of the built IPA
//  */
// export async function submitApp(options: SubmitAppOptions): Promise<string> {
//   const tool = new SubmitApp(options.verbose);
//   return await tool.submitApp(options);
// }

// /**
//  * Build IPA only (no submission)
//  * @param options - Configuration options for building
//  * @returns Promise that resolves to the path of the built IPA
//  */
// export async function buildIpa(options: SubmitAppOptions): Promise<string> {
//   const tool = new SubmitApp(options.verbose);
//   return await tool.buildIpa(options);
// }

// /**
//  * Submit existing IPA to App Store Connect
//  * @param ipaPath - Path to the IPA file
//  * @param options - Configuration options for submission
//  * @returns Promise that resolves when submission is complete
//  */
// export async function submitIpa(ipaPath: string, options: SubmitAppOptions): Promise<void> {
//   const tool = new SubmitApp(options.verbose);
//   return await tool.submitToAppStore(ipaPath, options);
// }