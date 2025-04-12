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
let terminalFocusDisposable;
let statusBarColorResetTimeout;
let originalStatusBarColor;
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
    // Add a listener for VS Code's debug sessions
    context.subscriptions.push(vscode.debug.onDidStartDebugSession((session) => {
        var _a;
        // Check if this is a Dart/Flutter debug session
        if (session.type === "dart" ||
            ((_a = session.configuration.name) === null || _a === void 0 ? void 0 : _a.includes("Flutter"))) {
            // Update our UI to show the stop button
            vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", true);
        }
    }), vscode.debug.onDidTerminateDebugSession((session) => {
        var _a;
        // Check if this is a Dart/Flutter debug session
        if (session.type === "dart" ||
            ((_a = session.configuration.name) === null || _a === void 0 ? void 0 : _a.includes("Flutter"))) {
            // Update our UI to hide the stop button
            vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", false);
        }
    }));
    // Also listen for terminal closed events
    context.subscriptions.push(vscode.window.onDidCloseTerminal((closedTerminal) => {
        // Check if this terminal had "Flutter" in its name
        if (closedTerminal.name.includes("Flutter")) {
            vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", false);
        }
    }));
    // Set up terminal color handling
    const terminalColorDisposable = setupTerminalColorHandling(context);
    if (terminalColorDisposable) {
        context.subscriptions.push(terminalColorDisposable);
    }
}
exports.activate = activate;
function runFlutterApp(withDebug) {
    var _a, _b;
    // Get user preference for terminal highlighting first
    const config = vscode.workspace.getConfiguration("flutterRapidRunner");
    const disableHighlighting = config.get("disableTerminalHighlighting", false);
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
    // If not in debug mode (the rest of your existing code)
    if (!terminal) {
        terminal = vscode.window.createTerminal("Flutter Run");
    }
    terminal.show();
    // Properly handle the status bar color based on user preference
    if (disableHighlighting) {
        // Save original status bar color before modifying it
        saveOriginalStatusBarColor();
        // Disable the status bar color change when terminal is focused
        const debugConfig = vscode.workspace.getConfiguration("debug");
        debugConfig.update("enableStatusBarColor", false, vscode.ConfigurationTarget.Workspace);
    }
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
    // Watch for terminal close to reset state
    if (terminalFocusDisposable) {
        terminalFocusDisposable.dispose();
    }
    // Listen for terminal close events
    terminalFocusDisposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (closedTerminal === terminal) {
            terminal = undefined;
            vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", false);
            // Also clean up the disposable
            if (terminalFocusDisposable) {
                terminalFocusDisposable.dispose();
                terminalFocusDisposable = undefined;
            }
        }
    });
}
function stopFlutterApp() {
    if (terminal) {
        // Get user's preference before disposing terminal
        const config = vscode.workspace.getConfiguration("flutterRapidRunner");
        const colorBehavior = config.get("terminalColorBehavior", "default");
        // If we were preserving or using custom color, restore original color
        if (colorBehavior !== "default") {
            restoreOriginalStatusBarColor();
        }
        terminal.sendText("q", false);
        terminal.dispose();
        terminal = undefined;
    }
    // Clean up focus listener
    if (terminalFocusDisposable) {
        terminalFocusDisposable.dispose();
        terminalFocusDisposable = undefined;
    }
    // Clean up any pending timeout
    if (statusBarColorResetTimeout) {
        clearTimeout(statusBarColorResetTimeout);
        statusBarColorResetTimeout = undefined;
    }
    // Also try to stop any debug sessions
    vscode.commands.executeCommand("workbench.action.debug.stop");
    // Set context
    vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", false);
}
function setupTerminalColorHandling(context) {
    // Get user's preferences
    const config = vscode.workspace.getConfiguration("flutterRapidRunner");
    const disableHighlighting = config.get("disableTerminalHighlighting", false);
    // If highlighting is disabled, ensure status bar color doesn't change
    if (disableHighlighting) {
        const debugConfig = vscode.workspace.getConfiguration("debug");
        debugConfig.update("enableStatusBarColor", false, vscode.ConfigurationTarget.Workspace);
        return;
    }
    // Otherwise proceed with normal color behavior handling
    const colorBehavior = config.get("terminalColorBehavior", "preserve");
    // Store original debug.enableStatusBarColor value
    const debugConfig = vscode.workspace.getConfiguration("debug");
    const originalEnableStatusBarColor = debugConfig.get("enableStatusBarColor", true);
    // Store it in extension context state
    context.workspaceState.update("originalEnableStatusBarColor", originalEnableStatusBarColor);
    // Listen for terminal focus changes
    const disposable = vscode.window.onDidChangeActiveTerminal((activeTerm) => __awaiter(this, void 0, void 0, function* () {
        if (activeTerm === terminal) {
            // When our Flutter terminal gets focus, disable the status bar color
            yield debugConfig.update("enableStatusBarColor", false, vscode.ConfigurationTarget.Workspace);
            // If custom color is desired, set it
            if (colorBehavior === "custom") {
                const customColor = config.get("customTerminalColor", "#007ACC");
                setStatusBarColor(customColor);
            }
        }
        else if (terminal && activeTerm !== terminal) {
            // When focus moves to a different terminal, restore the original setting
            const originalValue = context.workspaceState.get("originalEnableStatusBarColor", true);
            yield debugConfig.update("enableStatusBarColor", originalValue, vscode.ConfigurationTarget.Workspace);
            // If we had set a custom color, restore original
            if (colorBehavior === "custom") {
                restoreOriginalStatusBarColor();
            }
        }
    }));
    // Store the disposable so we can clean it up later
    context.subscriptions.push(disposable);
    // Return the disposable for additional cleanup if needed
    return disposable;
}
// Helper function to save the original status bar color
function saveOriginalStatusBarColor() {
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const colorCustomizations = workbenchConfig.get("colorCustomizations") ||
        {};
    originalStatusBarColor = colorCustomizations["statusBar.background"];
}
// Helper function to restore the original status bar color
function restoreOriginalStatusBarColor() {
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const colorCustomizations = workbenchConfig.get("colorCustomizations") ||
        {};
    if (originalStatusBarColor) {
        colorCustomizations["statusBar.background"] = originalStatusBarColor;
    }
    else {
        delete colorCustomizations["statusBar.background"];
    }
    workbenchConfig.update("colorCustomizations", colorCustomizations, vscode.ConfigurationTarget.Global);
}
// Helper function to set a specific status bar color
function setStatusBarColor(color) {
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const colorCustomizations = workbenchConfig.get("colorCustomizations") ||
        {};
    colorCustomizations["statusBar.background"] = color;
    workbenchConfig.update("colorCustomizations", colorCustomizations, vscode.ConfigurationTarget.Global);
}
function deactivate() {
    // Clean up terminal
    if (terminal) {
        terminal.dispose();
    }
    // Clean up focus listener
    if (terminalFocusDisposable) {
        terminalFocusDisposable.dispose();
    }
    // Clean up any pending timeout
    if (statusBarColorResetTimeout) {
        clearTimeout(statusBarColorResetTimeout);
    }
    // Restore original status bar color
    restoreOriginalStatusBarColor();
    // Restore original enableStatusBarColor setting
    const debugConfig = vscode.workspace.getConfiguration("debug");
    debugConfig.update("enableStatusBarColor", true, vscode.ConfigurationTarget.Workspace);
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map