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
exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
let terminal;
let terminalFocusDisposable;
let statusBarColorResetTimeout;
let originalStatusBarColor;
let statusBarItem;
let currentRunningProcess = false;
function activate(context) {
    console.log("Flutter Rapid Runner is now active!");
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(play) Flutter";
    statusBarItem.tooltip = "Click to run Flutter app";
    statusBarItem.command = "flutter-rapid-runner.runWithOptions";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(vscode.commands.registerCommand("flutter-rapid-runner.runWithOptions", () => __awaiter(this, void 0, void 0, function* () {
        yield showRunOptionsQuickPick();
    })), vscode.commands.registerCommand("flutter-rapid-runner.run", () => __awaiter(this, void 0, void 0, function* () {
        yield runFlutterApp({ mode: "run" });
    })), vscode.commands.registerCommand("flutter-rapid-runner.debug", () => __awaiter(this, void 0, void 0, function* () {
        yield runFlutterApp({ mode: "debug" });
    })), vscode.commands.registerCommand("flutter-rapid-runner.profile", () => __awaiter(this, void 0, void 0, function* () {
        yield runFlutterApp({ mode: "profile" });
    })), vscode.commands.registerCommand("flutter-rapid-runner.release", () => __awaiter(this, void 0, void 0, function* () {
        yield runFlutterApp({ mode: "release" });
    })), vscode.commands.registerCommand("flutter-rapid-runner.stop", () => {
        stopFlutterApp();
    }), vscode.commands.registerCommand("flutter-rapid-runner.selectDevice", () => __awaiter(this, void 0, void 0, function* () {
        yield selectDevice();
    })), vscode.commands.registerCommand("flutter-rapid-runner.toggleRunLocation", () => {
        const config = vscode.workspace.getConfiguration("flutterRunner");
        const currentRunIn = config.get("runIn", "terminal");
        const newRunIn = currentRunIn === "terminal" ? "debugConsole" : "terminal";
        config
            .update("runIn", newRunIn, vscode.ConfigurationTarget.Global)
            .then(() => {
            vscode.window.showInformationMessage(`Flutter Run Location set to: ${newRunIn}`);
        });
    }), {
        dispose: () => {
            if (terminal) {
                terminal.dispose();
            }
        },
    });
    vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", false);
    context.subscriptions.push(vscode.debug.onDidStartDebugSession((session) => {
        var _a;
        if (session.type === "dart" ||
            ((_a = session.configuration.name) === null || _a === void 0 ? void 0 : _a.includes("Flutter"))) {
            currentRunningProcess = true;
            updateRunningState(true);
        }
    }), vscode.debug.onDidTerminateDebugSession((session) => {
        var _a;
        if (session.type === "dart" ||
            ((_a = session.configuration.name) === null || _a === void 0 ? void 0 : _a.includes("Flutter"))) {
            currentRunningProcess = false;
            updateRunningState(false);
        }
    }));
    context.subscriptions.push(vscode.window.onDidCloseTerminal((closedTerminal) => {
        if (closedTerminal.name.includes("Flutter")) {
            currentRunningProcess = false;
            updateRunningState(false);
        }
    }));
    const terminalColorDisposable = setupTerminalColorHandling(context);
    if (terminalColorDisposable) {
        context.subscriptions.push(terminalColorDisposable);
    }
    updateWorkspaceContext();
}
exports.activate = activate;
function showRunOptionsQuickPick() {
    return __awaiter(this, void 0, void 0, function* () {
        const options = [
            {
                label: "$(play-circle) Run",
                description: "Start Flutter app without debugging",
                detail: "Launches your Flutter app in run mode with hot reload support",
                mode: "run",
            },
            {
                label: "$(bug) Debug",
                description: "Start Flutter app with debugging enabled",
                detail: "Launches your Flutter app with debugging capabilities and breakpoint support",
                mode: "debug",
            },
            {
                label: "$(dashboard) Profile",
                description: "Start Flutter app in profile mode",
                detail: "Launches your Flutter app for performance profiling and analysis",
                mode: "profile",
            },
            {
                label: "$(package) Release",
                description: "Start Flutter app in release mode",
                detail: "Launches your Flutter app optimized for production deployment",
                mode: "release",
            },
        ];
        const selectedOption = yield vscode.window.showQuickPick(options, {
            placeHolder: "🚀 Select Flutter run mode",
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: false,
        });
        if (selectedOption) {
            const devices = yield getFlutterDevices();
            if (devices.length > 1) {
                const deviceOption = yield selectDeviceFromList(devices);
                if (deviceOption) {
                    yield runFlutterApp({
                        mode: selectedOption.mode,
                        device: deviceOption.id,
                    });
                }
            }
            else {
                yield runFlutterApp({ mode: selectedOption.mode });
            }
        }
    });
}
function selectDevice() {
    return __awaiter(this, void 0, void 0, function* () {
        const devices = yield getFlutterDevices();
        if (devices.length === 0) {
            vscode.window.showErrorMessage("❌ No Flutter devices found. Please connect a device or start an emulator.");
            return;
        }
        const deviceOption = yield selectDeviceFromList(devices);
        if (deviceOption) {
            vscode.window.showInformationMessage(`✅ Selected device: ${deviceOption.name}`);
        }
    });
}
function selectDeviceFromList(devices) {
    return __awaiter(this, void 0, void 0, function* () {
        const deviceOptions = devices.map((device) => {
            let deviceIcon = "$(device-mobile)";
            if (device.platform.toLowerCase().includes("ios")) {
                deviceIcon = "$(device-mobile)";
            }
            else if (device.platform.toLowerCase().includes("android")) {
                deviceIcon = "$(device-mobile)";
            }
            else if (device.platform.toLowerCase().includes("web")) {
                deviceIcon = "$(globe)";
            }
            else if (device.platform.toLowerCase().includes("windows")) {
                deviceIcon = "$(window)";
            }
            else if (device.platform.toLowerCase().includes("macos")) {
                deviceIcon = "$(device-desktop)";
            }
            else if (device.platform.toLowerCase().includes("linux")) {
                deviceIcon = "$(terminal-linux)";
            }
            return {
                label: `${deviceIcon} ${device.name}`,
                description: `${device.platform} • ${device.isEmulator ? "Emulator" : "Physical Device"}`,
                detail: `Device ID: ${device.id}`,
                device: device,
            };
        });
        const selectedDevice = yield vscode.window.showQuickPick(deviceOptions, {
            placeHolder: "📱 Select target device for Flutter app",
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: false,
        });
        return selectedDevice === null || selectedDevice === void 0 ? void 0 : selectedDevice.device;
    });
}
function updateWorkspaceContext() {
    var _a;
    const workspaceFolder = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0];
    if (workspaceFolder) {
        const pubspecPath = path.join(workspaceFolder.uri.fsPath, "pubspec.yaml");
        const hasFlutterProject = fs.existsSync(pubspecPath);
        vscode.commands.executeCommand("setContext", "workspaceHasFlutterProject", hasFlutterProject);
    }
}
function executeCommand(command) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            const { exec } = require("child_process");
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve({ stdout, stderr });
                }
            });
        });
    });
}
function runFlutterApp(options) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        if (!isFlutterProject()) {
            vscode.window.showErrorMessage("❌ This doesn't appear to be a Flutter project. Please open a Flutter project directory.");
            return;
        }
        const flutterAvailable = yield isFlutterAvailable();
        if (!flutterAvailable) {
            vscode.window.showErrorMessage("❌ Flutter is not installed or not in your system PATH. Please install Flutter and ensure it's accessible from the command line.");
            return;
        }
        const config = vscode.workspace.getConfiguration("flutterRapidRunner");
        const disableHighlighting = config.get("disableTerminalHighlighting", false);
        if (options.mode === "debug") {
            const workspaceFolder = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage("❌ No workspace folder found. Please open a Flutter project.");
                return;
            }
            const debugConfig = {
                name: "Flutter",
                request: "launch",
                type: "dart",
                program: options.target || "lib/main.dart",
            };
            if (options.device) {
                debugConfig.deviceId = options.device;
            }
            if (options.flavor) {
                debugConfig.args = ["--flavor", options.flavor];
            }
            vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(vscode.Uri.file(workspaceFolder.uri.fsPath)), debugConfig);
            updateRunningState(true);
            return;
        }
        if (!terminal) {
            terminal = vscode.window.createTerminal("Flutter Run");
        }
        terminal.show();
        if (disableHighlighting) {
            saveOriginalStatusBarColor();
            const debugConfig = vscode.workspace.getConfiguration("debug");
            debugConfig.update("enableStatusBarColor", false, vscode.ConfigurationTarget.Workspace);
        }
        const workspaceFolder = (_b = vscode.workspace.workspaceFolders) === null || _b === void 0 ? void 0 : _b[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage("❌ No workspace folder found. Please open a Flutter project.");
            return;
        }
        let flutterCommand = `flutter run`;
        if (options.mode === "profile") {
            flutterCommand += " --profile";
        }
        else if (options.mode === "release") {
            flutterCommand += " --release";
        }
        if (options.target) {
            flutterCommand += ` -t ${options.target}`;
        }
        else {
            flutterCommand += ` -t lib/main.dart`;
        }
        if (options.device) {
            flutterCommand += ` -d ${options.device}`;
        }
        if (options.flavor) {
            flutterCommand += ` --flavor ${options.flavor}`;
        }
        terminal.sendText(`cd "${workspaceFolder.uri.fsPath}"`);
        terminal.sendText(flutterCommand);
        updateRunningState(true);
        currentRunningProcess = true;
        if (terminalFocusDisposable) {
            terminalFocusDisposable.dispose();
        }
        terminalFocusDisposable = vscode.window.onDidCloseTerminal((closedTerminal) => {
            if (closedTerminal === terminal) {
                terminal = undefined;
                currentRunningProcess = false;
                updateRunningState(false);
                if (terminalFocusDisposable) {
                    terminalFocusDisposable.dispose();
                    terminalFocusDisposable = undefined;
                }
            }
        });
    });
}
function isFlutterProject() {
    var _a;
    const workspaceFolder = (_a = vscode.workspace.workspaceFolders) === null || _a === void 0 ? void 0 : _a[0];
    if (!workspaceFolder) {
        return false;
    }
    const pubspecPath = path.join(workspaceFolder.uri.fsPath, "pubspec.yaml");
    if (!fs.existsSync(pubspecPath)) {
        return false;
    }
    try {
        const pubspecContent = fs.readFileSync(pubspecPath, "utf8");
        return (pubspecContent.includes("flutter:") ||
            pubspecContent.includes("flutter_test:"));
    }
    catch (error) {
        return false;
    }
}
function updateRunningState(isRunning) {
    vscode.commands.executeCommand("setContext", "flutterRunnerExtension.isRunning", isRunning);
    if (statusBarItem) {
        if (isRunning) {
            statusBarItem.text = "$(debug-stop) Flutter";
            statusBarItem.tooltip = "Click to stop Flutter app";
            statusBarItem.command = "flutter-rapid-runner.stop";
        }
        else {
            statusBarItem.text = "$(play) Flutter";
            statusBarItem.tooltip = "Click to run Flutter app";
            statusBarItem.command = "flutter-rapid-runner.runWithOptions";
        }
    }
}
function stopFlutterApp() {
    if (terminal) {
        const config = vscode.workspace.getConfiguration("flutterRapidRunner");
        const colorBehavior = config.get("terminalColorBehavior", "default");
        if (colorBehavior !== "default") {
            restoreOriginalStatusBarColor();
        }
        terminal.sendText("q", false);
        setTimeout(() => {
            if (terminal) {
                terminal.dispose();
                terminal = undefined;
            }
        }, 1000);
    }
    if (terminalFocusDisposable) {
        terminalFocusDisposable.dispose();
        terminalFocusDisposable = undefined;
    }
    if (statusBarColorResetTimeout) {
        clearTimeout(statusBarColorResetTimeout);
        statusBarColorResetTimeout = undefined;
    }
    vscode.commands.executeCommand("workbench.action.debug.stop");
    currentRunningProcess = false;
    updateRunningState(false);
    vscode.window.showInformationMessage("✅ Flutter app stopped.");
}
function setupTerminalColorHandling(context) {
    const config = vscode.workspace.getConfiguration("flutterRapidRunner");
    const disableHighlighting = config.get("disableTerminalHighlighting", false);
    if (disableHighlighting) {
        const debugConfig = vscode.workspace.getConfiguration("debug");
        debugConfig.update("enableStatusBarColor", false, vscode.ConfigurationTarget.Workspace);
        return;
    }
    const colorBehavior = config.get("terminalColorBehavior", "preserve");
    const debugConfig = vscode.workspace.getConfiguration("debug");
    const originalEnableStatusBarColor = debugConfig.get("enableStatusBarColor", true);
    context.workspaceState.update("originalEnableStatusBarColor", originalEnableStatusBarColor);
    const disposable = vscode.window.onDidChangeActiveTerminal((activeTerm) => __awaiter(this, void 0, void 0, function* () {
        if (activeTerm === terminal) {
            yield debugConfig.update("enableStatusBarColor", false, vscode.ConfigurationTarget.Workspace);
            if (colorBehavior === "custom") {
                const customColor = config.get("customTerminalColor", "#007ACC");
                setStatusBarColor(customColor);
            }
        }
        else if (terminal && activeTerm !== terminal) {
            const originalValue = context.workspaceState.get("originalEnableStatusBarColor", true);
            yield debugConfig.update("enableStatusBarColor", originalValue, vscode.ConfigurationTarget.Workspace);
            if (colorBehavior === "custom") {
                restoreOriginalStatusBarColor();
            }
        }
    }));
    context.subscriptions.push(disposable);
    return disposable;
}
function saveOriginalStatusBarColor() {
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const colorCustomizations = workbenchConfig.get("colorCustomizations") ||
        {};
    originalStatusBarColor = colorCustomizations["statusBar.background"];
}
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
function setStatusBarColor(color) {
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const colorCustomizations = workbenchConfig.get("colorCustomizations") ||
        {};
    colorCustomizations["statusBar.background"] = color;
    workbenchConfig.update("colorCustomizations", colorCustomizations, vscode.ConfigurationTarget.Global);
}
function isFlutterAvailable() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield executeCommand("flutter --version");
            return true;
        }
        catch (error) {
            return false;
        }
    });
}
function getFlutterDevices() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const flutterAvailable = yield isFlutterAvailable();
            if (!flutterAvailable) {
                vscode.window.showErrorMessage("❌ Flutter is not installed or not in your system PATH. Please install Flutter and ensure it's accessible from the command line.");
                return [];
            }
            const { stdout } = yield executeCommand("flutter devices");
            const devices = [];
            const lines = stdout.split("\n");
            for (const line of lines) {
                if (line.includes("•") && !line.includes("connected device")) {
                    const parts = line.split("•").map((p) => p.trim());
                    if (parts.length >= 3) {
                        const name = parts[0];
                        const id = parts[1];
                        const platform = parts[2];
                        const isEmulator = parts.length > 3 && parts[3].includes("emulator");
                        devices.push({
                            id,
                            name,
                            platform,
                            isEmulator,
                        });
                    }
                }
            }
            return devices;
        }
        catch (error) {
            console.error("Error retrieving Flutter devices:", error);
            return [];
        }
    });
}
//# sourceMappingURL=extension.js.map