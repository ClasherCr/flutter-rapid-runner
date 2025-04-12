import * as vscode from "vscode";

let terminal: vscode.Terminal | undefined;

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
}

function runFlutterApp(withDebug: boolean) {
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

  // If there's already a terminal, dispose it
  if (terminal) {
    terminal.dispose();
  }

  // Create a new terminal
  terminal = vscode.window.createTerminal("Flutter Run");
  terminal.show();

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
  vscode.commands.executeCommand(
    "setContext",
    "flutterRunnerExtension.isRunning",
    false
  );
}

export function deactivate() {
  if (terminal) {
    terminal.dispose();
  }
}
