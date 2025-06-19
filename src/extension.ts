import * as vscode from 'vscode';
import { workspace, ExtensionContext } from 'vscode';
import * as cp from 'child_process';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    StreamInfo,
    Trace,
    ErrorAction,
    CloseAction
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Fanuc TP Language Server');
    const traceChannel = vscode.window.createOutputChannel('Fanuc TP LSP Trace');
    const rawStdoutChannel = vscode.window.createOutputChannel('Fanuc TP Raw stdout');

    const serverOptions: ServerOptions = () => {
        return new Promise<StreamInfo>((resolve, reject) => {
            rawStdoutChannel.show(true);
            rawStdoutChannel.appendLine('--- Spawning FanucTpLSP.exe ---');

            // Get the path of the current workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            const cwd = workspaceFolder?.uri.fsPath;

            if (cwd) {
                rawStdoutChannel.appendLine(`Setting working directory to: ${cwd}`);
            } else {
                rawStdoutChannel.appendLine(`Warning: No workspace folder found. Using default working directory.`);
            }

            const command = 'FanucTpLSP.exe';
            // Add the `cwd` property to the spawn options
            const spawnOptions: cp.SpawnOptions = { shell: true, cwd: cwd };
            const serverProcess = cp.spawn(command, [], spawnOptions);

            if (!serverProcess || !serverProcess.pid) {
                return reject(new Error(`Failed to launch server process: ${command}`));
            }

            if (!serverProcess.stdin || !serverProcess.stdout) {
                return reject(new Error(`Server process streams are not available`));
            }

            rawStdoutChannel.appendLine(`Process spawned with PID: ${serverProcess.pid}. Attaching stream listeners...`);

            if (serverProcess.stderr) {
                serverProcess.stderr.on('data', (data) => {
                    rawStdoutChannel.appendLine(`[RAW STDERR]: ${data.toString()}`);
                });
            }

            if (serverProcess.stdout) {
                serverProcess.stdout.on('data', (data) => {
                    rawStdoutChannel.appendLine(`--- Received STDOUT Chunk ---`);
                    rawStdoutChannel.appendLine(data.toString());
                    rawStdoutChannel.appendLine(`--- End STDOUT Chunk ---`);
                });
            }
            
            serverProcess.on('exit', (code) => {
                rawStdoutChannel.appendLine(`Server process exited with code: ${code}`);
            });

            resolve({
                writer: serverProcess.stdin,
                reader: serverProcess.stdout,
            });
        });
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'fanuctp' }],
        outputChannel: outputChannel,
        traceOutputChannel: traceChannel,
        errorHandler: {
            error: (error, message, count) => {
                outputChannel.appendLine(`[Connection Error]: ${error.message}`);
                return { action: ErrorAction.Shutdown };
            },
            closed: () => {
                outputChannel.appendLine('[Connection Closed]');
                return { action: CloseAction.DoNotRestart };
            }
        },
        markdown: {
            isTrusted: true
        },
        uriConverters: {
            code2Protocol: (uri) => uri.fsPath,
            protocol2Code: (str) => vscode.Uri.file(str) 
        }
    };

    client = new LanguageClient(
        'fanuctp-lsp',
        'Fanuc TP Language Server',
        serverOptions,
        clientOptions
    );

    client.setTrace(Trace.Verbose);
    outputChannel.appendLine('Starting language client...');
    client.start();
    context.subscriptions.push(client);
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}