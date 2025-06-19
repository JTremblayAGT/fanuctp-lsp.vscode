import * as vscode from 'vscode';
import { workspace, ExtensionContext } from 'vscode';
import * as cp from 'child_process';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    Trace,
    ErrorAction,
    CloseAction,
    Executable,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext) {
    const outputChannel = vscode.window.createOutputChannel('Fanuc TP Language Server');

    const serverExecutable: Executable = {
        command: 'FanucTpLSP.exe',
        transport: TransportKind.stdio,
        options: {
            cwd: workspace.workspaceFolders?.[0]?.uri.fsPath
        }
    };
    const serverOptions: ServerOptions = serverExecutable;

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'fanuctp' }],
        outputChannel: outputChannel,
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