import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface ListSchemesArgs {
  projectPath: string;
}

export interface SchemeInfo {
  name: string;
  isShared: boolean;
}

export class XcodeHandlers {
  async listSchemes(args: ListSchemesArgs): Promise<any> {
    const { projectPath } = args;

    if (!projectPath) {
      throw new Error('Project path is required');
    }

    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    const stats = statSync(projectPath);
    if (!stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`);
    }

    const isWorkspace = projectPath.endsWith('.xcworkspace');
    const isProject = projectPath.endsWith('.xcodeproj');

    if (!isWorkspace && !isProject) {
      throw new Error('Project path must be either a .xcworkspace or .xcodeproj file');
    }

    try {
      const command = isWorkspace 
        ? `xcodebuild -workspace "${projectPath}" -list`
        : `xcodebuild -project "${projectPath}" -list`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr && stderr.trim() !== '') {
        console.error('xcodebuild stderr:', stderr);
      }

      const schemes = this.parseXcodebuildOutput(stdout);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              projectPath,
              projectType: isWorkspace ? 'workspace' : 'project',
              schemes,
              totalSchemes: schemes.length
            }, null, 2)
          }
        ]
      };
    } catch (error: any) {
      throw new Error(`Failed to list schemes: ${error.message}`);
    }
  }

  private parseXcodebuildOutput(output: string): SchemeInfo[] {
    const lines = output.split('\n');
    const schemes: SchemeInfo[] = [];
    let inSchemesSection = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === 'Schemes:') {
        inSchemesSection = true;
        continue;
      }

      if (inSchemesSection) {
        if (trimmedLine === '' || trimmedLine.startsWith('Build Configurations:') || trimmedLine.startsWith('If no build configuration')) {
          break;
        }

        if (trimmedLine && !trimmedLine.startsWith('Information about project')) {
          const isShared = !trimmedLine.startsWith('    ');
          const schemeName = trimmedLine.trim();
          
          if (schemeName) {
            schemes.push({
              name: schemeName,
              isShared
            });
          }
        }
      }
    }

    return schemes;
  }
}