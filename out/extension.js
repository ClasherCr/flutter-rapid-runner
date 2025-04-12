"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
let terminal;
function activate(context) {
    console.log("Flutter Rapid Runner is now active!");
    // Register the commands
    context.subscriptions.push(vscode.commands.registerCommand("flutter-rapid-runner.runWithOptions", () => __awaiter(this, void 0, void 0, function* () {
        const options = [
            { label: "Run", description: "Run without debugging" },
            { label: "Debug", description: "Run with debugging" },
        ];
        const selectedOption = yield vscode.window.showQuickPick(options, {
            placeHolder: "Select run mode",
        });
        if (selectedOption) {
            if (selectedOption.label === "Debug") {
                runFlutterApp(true);
            }
            else {
                runFlutterApp(false);
            }
        }
    })), vscode.commands.registerCommand("flutter-rapid-runner.run", () => {
        runFlutterApp(false);
    }), vscode.commands.registerCommand("flutter-rapid-runner.debug", () => {
        runFlutterApp(true);
    }), vscode.commands.registerCommand("flutter-rapid-runner.stop", () => {
        stopFlutterApp();
    }), 
    // Register the toggle command
    vscode.commands.registerCommand("flutter-rapid-runner.toggleRunLocation", () => {
        // Get current config
        const config = vscode.workspace.getConfiguration("flutterRunner");
        const currentRunIn = config.get("runIn", "terminal");
        // Toggle between terminal and debugConsole
        const newRunIn = currentRunIn === "terminal" ? "debugConsole" : "terminal";
        // Update config
        config
            .update("runIn", newRunIn, vscode.ConfigurationTarget.Global)
            .then(() => {
            vscode.window.showInformationMessage(`Flutter Run Location set to: ${newRunIn}`);
        });
    }), 
    // Cleanup when extension is deactivated
    {
        dispose: () => {
            if (terminal) {
                terminal.dispose();
            }
        },
    });
    // Set initial state for menu visibility
    vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", false);
}
exports.activate = activate;
function runFlutterApp(withDebug) {
    var _a, _b;
    if (withDebug) {
        // Get workspace folder path
        const workspaceFolder = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder found. Please open a Flutter project.");
            return;
        }
        // Verify this is a Flutter project
        try {
            const flutterProjectPath = workspaceFolder.uri.fsPath;
            // Launch debugging using Dart extension
            vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(vscode.Uri.file(flutterProjectPath)), {
                name: "Flutter",
                request: "launch",
                type: "dart",
                program: "lib/main.dart",
            });
            // Set context
            vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", true);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start debug session: ${error}`);
        }
        return;
    }
    // If there's already a terminal, dispose it
    if (terminal) {
        terminal.dispose();
    }
    // Create a new terminal
    terminal = vscode.window.createTerminal("Flutter Run");
    terminal.show();
    // Get workspace folder path
    const workspaceFolder = (_b = vscode.workspace.workspaceFolders) === null || _b === void 0 ? void 0 : _b[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder found. Please open a Flutter project.");
        return;
    }
    // Run flutter command
    terminal.sendText("cd " + workspaceFolder.uri.fsPath);
    terminal.sendText("flutter run -t lib/main.dart");
    // Set context
    vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", true);
}
function stopFlutterApp() {
    if (terminal) {
        terminal.sendText("q", false);
        terminal.dispose();
        terminal = undefined;
    }
    // Also try to stop any debug sessions
    vscode.commands.executeCommand("workbench.action.debug.stop");
    // Set context
    vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", false);
}
function deactivate() {
    if (terminal) {
        terminal.dispose();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map