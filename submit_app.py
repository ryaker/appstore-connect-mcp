#!/usr/bin/env python3
"""
Unified App Submission Tool
Combines IPA building and App Store Connect submission into a single tool.
Based on Codemagic CLI Tools implementation.
"""

import argparse
import pathlib
import subprocess
import sys
import json
import time
from typing import Optional, Dict, Any, List


class SubmitAppException(Exception):
    """Custom exception for app submission errors"""
    pass


class SubmitApp:
    """
    Unified tool for building IPA and submitting to App Store Connect
    """
    
    def __init__(self):
        self.verbose = False
        
    def log(self, message: str, level: str = "INFO"):
        """Simple logging function"""
        if self.verbose or level == "ERROR":
            print(f"[{level}] {message}")
    
    def run_command(self, command: List[str], capture_output: bool = True) -> subprocess.CompletedProcess:
        """Run a shell command and return the result"""
        self.log(f"Running command: {' '.join(command)}")
        try:
            result = subprocess.run(
                command, 
                capture_output=capture_output, 
                text=True, 
                check=True
            )
            return result
        except subprocess.CalledProcessError as e:
            self.log(f"Command failed: {e}", "ERROR")
            self.log(f"stdout: {e.stdout}", "ERROR")
            self.log(f"stderr: {e.stderr}", "ERROR")
            raise SubmitAppException(f"Command failed: {' '.join(command)}")
    
    def build_ipa(self, args: argparse.Namespace) -> pathlib.Path:
        """Build IPA using xcode-project build-ipa"""
        self.log("Building IPA...")
        
        # Build the xcode-project command
        cmd = ["python3", "-m", "codemagic.tools.xcode_project", "build-ipa"]
        
        # Add project/workspace path
        if args.xcode_project:
            cmd.extend(["--project", str(args.xcode_project)])
        elif args.xcode_workspace:
            cmd.extend(["--workspace", str(args.xcode_workspace)])
        else:
            raise SubmitAppException("Either --xcode-project or --xcode-workspace must be specified")
        
        # Add optional parameters
        if args.scheme:
            cmd.extend(["--scheme", args.scheme])
        if args.target:
            cmd.extend(["--target", args.target])
        if args.configuration:
            cmd.extend(["--configuration", args.configuration])
        if args.clean:
            cmd.append("--clean")
        if args.archive_directory:
            cmd.extend(["--archive-directory", str(args.archive_directory)])
        if args.ipa_directory:
            cmd.extend(["--ipa-directory", str(args.ipa_directory)])
        if args.export_options_plist:
            cmd.extend(["--export-options-plist", str(args.export_options_plist)])
        if args.remove_xcarchive:
            cmd.append("--remove-xcarchive")
        
        # Set PYTHONPATH to include the cli-tools src directory
        env = {
            "PYTHONPATH": str(pathlib.Path(__file__).parent / "cli-tools" / "src")
        }
        
        try:
            # Change to cli-tools directory and run the command
            result = subprocess.run(
                cmd,
                cwd=pathlib.Path(__file__).parent / "cli-tools",
                env={**subprocess.os.environ, **env},
                capture_output=True,
                text=True,
                check=True
            )
            
            # Parse the output to find the IPA path
            # The build-ipa command typically outputs the path to the built IPA
            output_lines = result.stdout.strip().split('\n')
            ipa_path = None
            
            # Look for IPA file in the output or use default location
            for line in output_lines:
                if line.endswith('.ipa') and pathlib.Path(line).exists():
                    ipa_path = pathlib.Path(line)
                    break
            
            if not ipa_path:
                # Default IPA location
                ipa_dir = args.ipa_directory or pathlib.Path("build/ios/ipa")
                ipa_files = list(ipa_dir.glob("*.ipa"))
                if ipa_files:
                    ipa_path = ipa_files[0]  # Take the first IPA found
                else:
                    raise SubmitAppException("Could not find built IPA file")
            
            self.log(f"Successfully built IPA: {ipa_path}")
            return ipa_path
            
        except subprocess.CalledProcessError as e:
            self.log(f"IPA build failed: {e}", "ERROR")
            self.log(f"stdout: {e.stdout}", "ERROR")
            self.log(f"stderr: {e.stderr}", "ERROR")
            raise SubmitAppException("IPA build failed")
    
    def submit_to_app_store(self, ipa_path: pathlib.Path, args: argparse.Namespace) -> None:
        """Submit IPA to App Store Connect using the publish action"""
        self.log(f"Submitting IPA to App Store Connect: {ipa_path}")
        
        # Build the app-store-connect publish command
        cmd = ["python3", "-m", "codemagic.tools.app_store_connect", "publish", str(ipa_path)]
        
        # Add authentication parameters
        if args.key_identifier:
            cmd.extend(["--key-id", args.key_identifier])
        if args.issuer_id:
            cmd.extend(["--issuer-id", args.issuer_id])
        if args.private_key:
            cmd.extend(["--private-key", args.private_key])
        elif args.private_key_path:
            cmd.extend(["--private-key", f"@file:{args.private_key_path}"])
        
        # Alternative authentication (username/password)
        if args.apple_id:
            cmd.extend(["--apple-id", args.apple_id])
        if args.app_specific_password:
            cmd.extend(["--app-specific-password", args.app_specific_password])
        
        # App Store submission parameters
        if args.submit_to_app_store:
            cmd.append("--submit-to-app-store")
        if args.version_string:
            cmd.extend(["--version-string", args.version_string])
        if args.whats_new:
            cmd.extend(["--whats-new", args.whats_new])
        if args.description:
            cmd.extend(["--description", args.description])
        if args.keywords:
            cmd.extend(["--keywords", args.keywords])
        if args.marketing_url:
            cmd.extend(["--marketing-url", args.marketing_url])
        if args.support_url:
            cmd.extend(["--support-url", args.support_url])
        if args.copyright:
            cmd.extend(["--copyright", args.copyright])
        if args.earliest_release_date:
            cmd.extend(["--earliest-release-date", args.earliest_release_date])
        if args.phased_release:
            cmd.append("--enable-phased-release")
        if args.cancel_previous_submissions:
            cmd.append("--cancel-previous-submissions")
        
        # Processing wait parameters
        if args.max_build_processing_wait:
            cmd.extend(["--max-build-processing-wait", str(args.max_build_processing_wait)])
        
        # Set PYTHONPATH to include the cli-tools src directory
        env = {
            "PYTHONPATH": str(pathlib.Path(__file__).parent / "cli-tools" / "src")
        }
        
        try:
            # Change to cli-tools directory and run the command
            result = subprocess.run(
                cmd,
                cwd=pathlib.Path(__file__).parent / "cli-tools",
                env={**subprocess.os.environ, **env},
                capture_output=True,
                text=True,
                check=True
            )
            
            self.log("Successfully submitted to App Store Connect")
            if self.verbose:
                self.log(f"Output: {result.stdout}")
                
        except subprocess.CalledProcessError as e:
            self.log(f"App Store Connect submission failed: {e}", "ERROR")
            self.log(f"stdout: {e.stdout}", "ERROR")
            self.log(f"stderr: {e.stderr}", "ERROR")
            raise SubmitAppException("App Store Connect submission failed")
    
    def submit_app(self, args: argparse.Namespace) -> None:
        """Main method that builds IPA and submits to App Store Connect"""
        try:
            # Step 1: Build IPA
            ipa_path = self.build_ipa(args)
            
            # Step 2: Submit to App Store Connect
            self.submit_to_app_store(ipa_path, args)
            
            self.log("App submission completed successfully!")
            
        except SubmitAppException as e:
            self.log(f"App submission failed: {e}", "ERROR")
            sys.exit(1)
        except Exception as e:
            self.log(f"Unexpected error: {e}", "ERROR")
            sys.exit(1)


def create_argument_parser() -> argparse.ArgumentParser:
    """Create and configure the argument parser"""
    parser = argparse.ArgumentParser(
        description="Unified tool for building IPA and submitting to App Store Connect",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Build and submit with API key authentication
  python submit_app.py --xcode-workspace MyApp.xcworkspace --scheme MyApp \\
    --key-identifier ABC123 --issuer-id def456 --private-key-path AuthKey_ABC123.p8 \\
    --submit-to-app-store --version-string "1.0.0" --whats-new "Initial release"
  
  # Build and submit with Apple ID authentication  
  python submit_app.py --xcode-project MyApp.xcodeproj --scheme MyApp \\
    --apple-id user@example.com --app-specific-password "abcd-efgh-ijkl-mnop" \\
    --submit-to-app-store --version-string "1.0.0"
        """
    )
    
    # Xcode project parameters
    project_group = parser.add_mutually_exclusive_group(required=True)
    project_group.add_argument(
        "--xcode-project", 
        type=pathlib.Path,
        help="Path to Xcode project (.xcodeproj)"
    )
    project_group.add_argument(
        "--xcode-workspace", 
        type=pathlib.Path,
        help="Path to Xcode workspace (.xcworkspace)"
    )
    
    parser.add_argument("--scheme", help="Xcode scheme name")
    parser.add_argument("--target", help="Xcode target name")
    parser.add_argument("--configuration", help="Build configuration (Debug, Release)")
    parser.add_argument("--clean", action="store_true", help="Clean before building")
    
    # Build directories
    parser.add_argument(
        "--archive-directory", 
        type=pathlib.Path,
        help="Directory to store xcarchive"
    )
    parser.add_argument(
        "--ipa-directory", 
        type=pathlib.Path,
        help="Directory to store built IPA"
    )
    parser.add_argument(
        "--export-options-plist", 
        type=pathlib.Path,
        help="Path to export options plist"
    )
    parser.add_argument(
        "--remove-xcarchive", 
        action="store_true",
        help="Remove xcarchive after IPA export"
    )
    
    # App Store Connect API authentication
    auth_group = parser.add_argument_group("App Store Connect API Authentication")
    auth_group.add_argument("--key-identifier", help="App Store Connect API key identifier")
    auth_group.add_argument("--issuer-id", help="App Store Connect API issuer ID")
    auth_group.add_argument("--private-key", help="App Store Connect API private key content")
    auth_group.add_argument(
        "--private-key-path", 
        type=pathlib.Path,
        help="Path to App Store Connect API private key file (.p8)"
    )
    
    # Alternative authentication
    alt_auth_group = parser.add_argument_group("Alternative Authentication")
    alt_auth_group.add_argument("--apple-id", help="Apple ID for authentication")
    alt_auth_group.add_argument("--app-specific-password", help="App-specific password")
    
    # App Store submission parameters
    submission_group = parser.add_argument_group("App Store Submission")
    submission_group.add_argument(
        "--submit-to-app-store", 
        action="store_true",
        help="Submit to App Store (not just TestFlight)"
    )
    submission_group.add_argument("--version-string", help="App version string")
    submission_group.add_argument("--whats-new", help="What's new in this version")
    submission_group.add_argument("--description", help="App description")
    submission_group.add_argument("--keywords", help="App keywords")
    submission_group.add_argument("--marketing-url", help="Marketing URL")
    submission_group.add_argument("--support-url", help="Support URL")
    submission_group.add_argument("--copyright", help="Copyright information")
    submission_group.add_argument("--earliest-release-date", help="Earliest release date")
    submission_group.add_argument(
        "--phased-release", 
        action="store_true",
        help="Enable phased release"
    )
    submission_group.add_argument(
        "--cancel-previous-submissions", 
        action="store_true",
        help="Cancel previous submissions"
    )
    
    # Processing options
    parser.add_argument(
        "--max-build-processing-wait", 
        type=int, 
        default=600,
        help="Maximum time to wait for build processing (seconds)"
    )
    
    # General options
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    
    return parser


def main():
    """Main entry point"""
    parser = create_argument_parser()
    args = parser.parse_args()
    
    submit_app = SubmitApp()
    submit_app.verbose = args.verbose
    
    submit_app.submit_app(args)


if __name__ == "__main__":
    main()