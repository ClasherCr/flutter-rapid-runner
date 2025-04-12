# Flutter Rapid Runner

A Visual Studio Code extension that brings Android Studio-like toolbar functionality to Flutter development in VS Code. Run and debug your Flutter apps with convenient buttons in the editor toolbar.

## Features

- **Quick Access Buttons**: Run and debug buttons in the editor title area
- **Run Options**: Choose between different run modes (debug, run)
- **Stop Button**: Easily terminate running Flutter apps
- **Terminal Integration**: Run Flutter commands in the integrated terminal
- **Flutter-focused UI**: Tailored specifically for Flutter development


## Requirements

- Visual Studio Code 1.60.0 or higher
- Flutter SDK installed and in your PATH
- Dart extension for VS Code

## Installation

1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "Flutter Rapid Runner"
4. Click Install

## How to Use

1. Open a Flutter project in VS Code
2. Edit any Dart file
3. Look for the rocket icon (🚀) in the editor title bar
4. Click the rocket to run with options:
   - **Run**: Start your app without debugging
   - **Debug**: Run with debugging enabled
5. When your app is running, a stop button will appear to terminate it

## Command Palette

All functions are also available through the Command Palette (Ctrl+Shift+P):

- `Flutter: Run` - Run Flutter app without debugging
- `Flutter: Debug` - Run Flutter app with debugging
- `Flutter: Run With Options` - Show run options
- `Flutter: Stop` - Stop running Flutter app
- `Flutter: Toggle Run Location` - Switch between terminal and debug console

## Configuration

This extension contributes the following settings:

* `flutterRunner.runIn`: Choose where to run Flutter (Terminal or Debug Console)
* `flutterRunner.runMode`: Default mode to run Flutter app (run, debug, profile, release)

## Known Issues

None at this time. Please report any issues on the [GitHub repository](https://github.com/ClasherCr/flutter-rapid-runner/issues).

## Release Notes

### 0.1.3

- Initial release
- Run and debug buttons in editor toolbar
- Run options dialog
- Stop functionality
- Terminal integration

---

## About the Author

Created by Jashkumar Bakul Solanki - a Flutter developer passionate about improving the development experience.

## License

This extension is licensed under the [MIT License](LICENSE).