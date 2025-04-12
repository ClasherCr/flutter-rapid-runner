import * as vscode from "vscode";

let terminal: vscode.Terminal | undefined;
let terminalFocusDisposable: vscode.Disposable | undefined;
let statusBarColorResetTimeout: NodeJS.Timeout | undefined;
let originalStatusBarColor: string | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("Flutter Rapid Runner is now active!");

  // Register the commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flutter-rapid-runner.runWithOptions",
      async () => {
        const options = [
          { label: "Run", description: "Run without debugging" },
          { label: "Debug", description: "Run with debugging" },
        ];

        const selectedOption = await vscode.window.showQuickPick(options, {
          placeHolder: "Select run mode",
        });

        if (selectedOption) {
          if (selectedOption.label === "Debug") {
            runFlutterApp(true);
          } else {
            runFlutterApp(false);
          }
        }
      }
    ),

    vscode.commands.registerCommand("flutter-rapid-runner.run", () => {
      runFlutterApp(false);
    }),

    vscode.commands.registerCommand("flutter-rapid-runner.debug", () => {
      runFlutterApp(true);
    }),

    vscode.commands.registerCommand("flutter-rapid-runner.stop", () => {
      stopFlutterApp();
    }),

    // Register the toggle command
    vscode.commands.registerCommand(
      "flutter-rapid-runner.toggleRunLocation",
      () => {
        // Get current config
        const config = vscode.workspace.getConfiguration("flutterRunner");
        const currentRunIn = config.get<string>("runIn", "terminal");

        // Toggle between terminal and debugConsole
        const newRunIn =
          currentRunIn === "terminal" ? "debugConsole" : "terminal";

        // Update config
        config
          .update("runIn", newRunIn, vscode.ConfigurationTarget.Global)
          .then(() => {
            vscode.window.showInformationMessage(
              `Flutter Run Location set to: ${newRunIn}`
            );
          });
      }
    ),

    // Cleanup when extension is deactivated
    {
      dispose: () => {
        if (terminal) {
          terminal.dispose();
        }
      },
    }
  );

  // Set initial state for menu visibility
  vscode.commands.executeCommand(
    "setContext",
    "flutterRunnerExtension.isRunning",
    false
  );

  // Add a listener for VS Code's debug sessions
  context.subscriptions.push(
    vscode.debug.onDidStartDebugSession((session) => {
      // Check if this is a Dart/Flutter debug session
      if (
        session.type === "dart" ||
        session.configuration.name?.includes("Flutter")
      ) {
        // Update our UI to show the stop button
        vscode.commands.executeCommand(
          "setContext",
          "flutterRunnerExtension.isRunning",
          true
        );
      }
    }),

    vscode.debug.onDidTerminateDebugSession((session) => {
      // Check if this is a Dart/Flutter debug session
      if (
        session.type === "dart" ||
        session.configuration.name?.includes("Flutter")
      ) {
        // Update our UI to hide the stop button
        vscode.commands.executeCommand(
          "setContext",
          "flutterRunnerExtension.isRunning",
          false
        );
      }
    })
  );

  // Also listen for terminal closed events
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      // Check if this terminal had "Flutter" in its name
      if (closedTerminal.name.includes("Flutter")) {
        vscode.commands.executeCommand(
          "setContext",
          "flutterRunnerExtension.isRunning",
          false
        );
      }
    })
  );

  // Set up terminal color handling
  const terminalColorDisposable = setupTerminalColorHandling(context);
  if (terminalColorDisposable) {
    context.subscriptions.push(terminalColorDisposable);
  }
}

function runFlutterApp(withDebug: boolean) {
  // Get user preference for terminal highlighting first
  const config = vscode.workspace.getConfiguration("flutterRapidRunner");
  const disableHighlighting = config.get<boolean>(
    "disableTerminalHighlighting",
    false
  );

  if (withDebug) {
    // Get workspace folder path
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage(
        "No workspace folder found. Please open a Flutter project."
      );
      return;
    }

    // Verify this is a Flutter project
    try {
      const flutterProjectPath = workspaceFolder.uri.fsPath;

      // Launch debugging using Dart extension
      vscode.debug.startDebugging(
        vscode.workspace.getWorkspaceFolder(
          vscode.Uri.file(flutterProjectPath)
        ),
        {
          name: "Flutter",
          request: "launch",
          type: "dart",
          program: "lib/main.dart",
        }
      );

      // Set context
      vscode.commands.executeCommand(
        "setContext",
        "flutterRunnerExtension.isRunning",
        true
      );
    } catch (error) {
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
    debugConfig.update(
      "enableStatusBarColor",
      false,
      vscode.ConfigurationTarget.Workspace
    );
  }

  // Get workspace folder path
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage(
      "No workspace folder found. Please open a Flutter project."
    );
    return;
  }

  // Run flutter command
  terminal.sendText("cd " + workspaceFolder.uri.fsPath);
  terminal.sendText("flutter run -t lib/main.dart");

  // Set context
  vscode.commands.executeCommand(
    "setContext",
    "flutterRunnerExtension.isRunning",
    true
  );

  // Watch for terminal close to reset state
  if (terminalFocusDisposable) {
    terminalFocusDisposable.dispose();
  }

  // Listen for terminal close events
  terminalFocusDisposable = vscode.window.onDidCloseTerminal(
    (closedTerminal) => {
      if (closedTerminal === terminal) {
        terminal = undefined;
        vscode.commands.executeCommand(
          "setContext",
          "flutterRunnerExtension.isRunning",
          false
        );

        // Also clean up the disposable
        if (terminalFocusDisposable) {
          terminalFocusDisposable.dispose();
          terminalFocusDisposable = undefined;
        }
      }
    }
  );
}

function stopFlutterApp() {
  if (terminal) {
    // Get user's preference before disposing terminal
    const config = vscode.workspace.getConfiguration("flutterRapidRunner");
    const colorBehavior = config.get<string>(
      "terminalColorBehavior",
      "default"
    );

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
  vscode.commands.executeCommand(
    "setContext",
    "flutterRunnerExtension.isRunning",
    false
  );
}

function setupTerminalColorHandling(context: vscode.ExtensionContext) {
  // Get user's preferences
  const config = vscode.workspace.getConfiguration("flutterRapidRunner");
  const disableHighlighting = config.get<boolean>(
    "disableTerminalHighlighting",
    false
  );

  // If highlighting is disabled, ensure status bar color doesn't change
  if (disableHighlighting) {
    const debugConfig = vscode.workspace.getConfiguration("debug");
    debugConfig.update(
      "enableStatusBarColor",
      false,
      vscode.ConfigurationTarget.Workspace
    );
    return;
  }

  // Otherwise proceed with normal color behavior handling
  const colorBehavior = config.get<string>("terminalColorBehavior", "preserve");

  // Store original debug.enableStatusBarColor value
  const debugConfig = vscode.workspace.getConfiguration("debug");
  const originalEnableStatusBarColor = debugConfig.get<boolean>(
    "enableStatusBarColor",
    true
  );

  // Store it in extension context state
  context.workspaceState.update(
    "originalEnableStatusBarColor",
    originalEnableStatusBarColor
  );

  // Listen for terminal focus changes
  const disposable = vscode.window.onDidChangeActiveTerminal(
    async (activeTerm) => {
      if (activeTerm === terminal) {
        // When our Flutter terminal gets focus, disable the status bar color
        await debugConfig.update(
          "enableStatusBarColor",
          false,
          vscode.ConfigurationTarget.Workspace
        );

        // If custom color is desired, set it
        if (colorBehavior === "custom") {
          const customColor = config.get<string>(
            "customTerminalColor",
            "#007ACC"
          );
          setStatusBarColor(customColor);
        }
      } else if (terminal && activeTerm !== terminal) {
        // When focus moves to a different terminal, restore the original setting
        const originalValue = context.workspaceState.get<boolean>(
          "originalEnableStatusBarColor",
          true
        );
        await debugConfig.update(
          "enableStatusBarColor",
          originalValue,
          vscode.ConfigurationTarget.Workspace
        );

        // If we had set a custom color, restore original
        if (colorBehavior === "custom") {
          restoreOriginalStatusBarColor();
        }
      }
    }
  );

  // Store the disposable so we can clean it up later
  context.subscriptions.push(disposable);

  // Return the disposable for additional cleanup if needed
  return disposable;
}

// Helper function to save the original status bar color
function saveOriginalStatusBarColor() {
  const workbenchConfig = vscode.workspace.getConfiguration("workbench");
  const colorCustomizations =
    (workbenchConfig.get("colorCustomizations") as { [key: string]: string }) ||
    {};
  originalStatusBarColor = colorCustomizations["statusBar.background"];
}

// Helper function to restore the original status bar color
function restoreOriginalStatusBarColor() {
  const workbenchConfig = vscode.workspace.getConfiguration("workbench");
  const colorCustomizations =
    (workbenchConfig.get("colorCustomizations") as { [key: string]: string }) ||
    {};

  if (originalStatusBarColor) {
    colorCustomizations["statusBar.background"] = originalStatusBarColor;
  } else {
    delete colorCustomizations["statusBar.background"];
  }

  workbenchConfig.update(
    "colorCustomizations",
    colorCustomizations,
    vscode.ConfigurationTarget.Global
  );
}

// Helper function to set a specific status bar color
function setStatusBarColor(color: string) {
  const workbenchConfig = vscode.workspace.getConfiguration("workbench");
  const colorCustomizations =
    (workbenchConfig.get("colorCustomizations") as { [key: string]: string }) ||
    {};

  colorCustomizations["statusBar.background"] = color;
  workbenchConfig.update(
    "colorCustomizations",
    colorCustomizations,
    vscode.ConfigurationTarget.Global
  );
}

export function deactivate() {
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
  debugConfig.update(
    "enableStatusBarColor",
    true,
    vscode.ConfigurationTarget.Workspace
  );
}
