/* eslint-disable @typescript-eslint/camelcase */
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { IDisposable } from '@lumino/disposable';

import { IVariableInspector } from './variableinspector';

import { KernelConnector } from './kernelconnector';

import { ISessionContext } from '@jupyterlab/apputils';

import { KernelMessage, Kernel } from '@jupyterlab/services';

import { Signal, ISignal } from '@lumino/signaling';

import { IExecuteResult } from '@jupyterlab/nbformat';

import { JSONModel, DataModel } from '@lumino/datagrid';
import {
  IExecuteInputMsg,
  IExecuteReplyMsg,
  IExecuteRequestMsg
} from '@jupyterlab/services/lib/kernel/messages';

/**
 * An object that handles code inspection.
 */
export class VariableInspectionHandler
  implements IDisposable, IVariableInspector.IInspectable {
  private _connector: KernelConnector;
  private _rendermime: IRenderMimeRegistry;
  private _initScript: string;
  private _queryCommand: string;
  private _matrixQueryCommand: string;
  private _widgetQueryCommand: string;
  private _deleteCommand: string;
  private _disposed = new Signal<this, void>(this);
  private _inspected = new Signal<
    this,
    IVariableInspector.IVariableInspectorUpdate
  >(this);
  private _isDisposed = false;
  private _ready: Promise<void>;
  private _id: string;

  constructor(options: VariableInspectionHandler.IOptions) {
    this._id = options.id;
    this._connector = options.connector;
    this._rendermime = options.rendermime;
    this._queryCommand = options.queryCommand;
    this._matrixQueryCommand = options.matrixQueryCommand;
    this._widgetQueryCommand = options.widgetQueryCommand;
    this._deleteCommand = options.deleteCommand;
    this._initScript = options.initScript;

    this._ready = this._connector.ready.then(() => {
      this._initOnKernel().then((msg: KernelMessage.IExecuteReplyMsg) => {
        this._connector.iopubMessage.connect(this._queryCall);
        return;
      });
    });

    this._connector.kernelRestarted.connect(
      (sender, kernelReady: Promise<void>) => {
        const title: IVariableInspector.IVariableTitle = {
          contextName: '<b>Restarting kernel...</b> '
        };
        this._inspected.emit({
          title: title,
          payload: []
        } as IVariableInspector.IVariableInspectorUpdate);

        this._ready = kernelReady.then(() => {
          this._initOnKernel().then((msg: KernelMessage.IExecuteReplyMsg) => {
            this._connector.iopubMessage.connect(this._queryCall);
            this.performInspection();
          });
        });
      }
    );
  }

  get id(): string {
    return this._id;
  }

  get rendermime(): IRenderMimeRegistry {
    return this._rendermime;
  }

  /**
   * A signal emitted when the handler is disposed.
   */
  get disposed(): ISignal<VariableInspectionHandler, void> {
    return this._disposed;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get ready(): Promise<void> {
    return this._ready;
  }

  /**
   * A signal emitted when an inspector value is generated.
   */
  get inspected(): ISignal<
    VariableInspectionHandler,
    IVariableInspector.IVariableInspectorUpdate
  > {
    return this._inspected;
  }

  /**
   * Performs an inspection by sending an execute request with the query command to the kernel.
   */
  public performInspection(): void {
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._queryCommand,
      stop_on_error: false,
      store_history: false
    };
    this._connector.fetch(content, this._handleQueryResponse);
  }

  /**
   * Performs an inspection of a Jupyter Widget
   */
  public performWidgetInspection(
    varName: string
  ): Kernel.IShellFuture<IExecuteRequestMsg, IExecuteReplyMsg> {
    const request: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._widgetQueryCommand + '(' + varName + ')',
      stop_on_error: false,
      store_history: false
    };
    return this._connector.execute(request);
  }

  /**
   * Performs an inspection of the specified matrix.
   */
  public performMatrixInspection(
    varName: string,
    maxRows = 100000
  ): Promise<DataModel> {
    const request: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._matrixQueryCommand + '(' + varName + ', ' + maxRows + ')',
      stop_on_error: false,
      store_history: false
    };
    const con = this._connector;
    return new Promise((resolve, reject) => {
      con.fetch(request, (response: KernelMessage.IIOPubMessage) => {
        const msgType = response.header.msg_type;
        switch (msgType) {
          case 'execute_result': {
            const payload = response.content as IExecuteResult;
            let content: string = payload.data['text/plain'] as string;
            content = content.replace(/^'|'$/g, '');
            content = content.replace(/\\"/g, '"');
            content = content.replace(/\\'/g, "\\\\'");

            const modelOptions = JSON.parse(content) as JSONModel.IOptions;
            const jsonModel = new JSONModel(modelOptions);
            resolve(jsonModel);
            break;
          }
          case 'error':
            console.log(response);
            reject("Kernel error on 'matrixQuery' call!");
            break;
          default:
            break;
        }
      });
    });
  }

  /**
   * Send a kernel request to delete a variable from the global environment
   */
  public performDelete(varName: string): void {
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._deleteCommand + "('" + varName + "')",
      stop_on_error: false,
      store_history: false
    };

    this._connector.fetch(content, this._handleQueryResponse);
  }

  /*
   * Disposes the kernel connector.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._disposed.emit(void 0);
    Signal.clearData(this);
  }

  /**
   * Initializes the kernel by running the set up script located at _initScriptPath.
   */
  private _initOnKernel(): Promise<KernelMessage.IExecuteReplyMsg> {
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._initScript,
      stop_on_error: false,
      silent: true
    };

    return this._connector.fetch(content, () => {
      //no op
    });
  }

  /*
   * Handle query response. Emit new signal containing the IVariableInspector.IInspectorUpdate object.
   * (TODO: query resp. could be forwarded to panel directly)
   */
  private _handleQueryResponse = (
    response: KernelMessage.IIOPubMessage
  ): void => {
    const msgType = response.header.msg_type;
    switch (msgType) {
      case 'execute_result': {
        const payload = response.content as IExecuteResult;
        let content: string = payload.data['text/plain'] as string;
        if (content.slice(0, 1) === "'" || content.slice(0, 1) === '"') {
          content = content.slice(1, -1);
          content = content.replace(/\\"/g, '"').replace(/\\'/g, "'");
        }

        const update = JSON.parse(content) as IVariableInspector.IVariable[];
        const title = {
          contextName: '',
          kernelName: this._connector.kernelName || ''
        };

        this._inspected.emit({ title: title, payload: update });
        break;
      }
      case 'display_data': {
        const payloadDisplay = response.content as IExecuteResult;
        let contentDisplay: string = payloadDisplay.data[
          'text/plain'
        ] as string;
        if (
          contentDisplay.slice(0, 1) === "'" ||
          contentDisplay.slice(0, 1) === '"'
        ) {
          contentDisplay = contentDisplay.slice(1, -1);
          contentDisplay = contentDisplay
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'");
        }

        const updateDisplay = JSON.parse(
          contentDisplay
        ) as IVariableInspector.IVariable[];

        const titleDisplay = {
          contextName: '',
          kernelName: this._connector.kernelName || ''
        };

        this._inspected.emit({ title: titleDisplay, payload: updateDisplay });
        break;
      }
      default:
        break;
    }
  };

  /*
   * Invokes a inspection if the signal emitted from specified session is an 'execute_input' msg.
   */
  private _queryCall = (
    sess: ISessionContext,
    msg: KernelMessage.IMessage
  ): void => {
    const msgType = msg.header.msg_type;
    switch (msgType) {
      case 'execute_input': {
        const code = (msg as IExecuteInputMsg).content.code;
        if (
          !(code === this._queryCommand) &&
          !(code === this._matrixQueryCommand) &&
          !code.startsWith(this._widgetQueryCommand)
        ) {
          this.performInspection();
        }
        break;
      }
      default:
        break;
    }
  };
}

/**
 * A name space for inspection handler statics.
 */
export namespace VariableInspectionHandler {
  /**
   * The instantiation options for an inspection handler.
   */
  export interface IOptions {
    connector: KernelConnector;
    rendermime?: IRenderMimeRegistry;
    queryCommand: string;
    matrixQueryCommand: string;
    widgetQueryCommand: string;
    deleteCommand: string;
    initScript: string;
    id: string;
  }
}

export class DummyHandler
  implements IDisposable, IVariableInspector.IInspectable {
  private _isDisposed = false;
  private _disposed = new Signal<this, void>(this);
  private _inspected = new Signal<
    this,
    IVariableInspector.IVariableInspectorUpdate
  >(this);
  private _connector: KernelConnector;
  private _rendermime: IRenderMimeRegistry = null;

  constructor(connector: KernelConnector) {
    this._connector = connector;
  }

  get disposed(): ISignal<DummyHandler, void> {
    return this._disposed;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get inspected(): ISignal<
    DummyHandler,
    IVariableInspector.IVariableInspectorUpdate
  > {
    return this._inspected;
  }

  get rendermime(): IRenderMimeRegistry {
    return this._rendermime;
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._disposed.emit(void 0);
    Signal.clearData(this);
  }

  public performInspection(): void {
    const title = {
      contextName: '. <b>Language currently not supported.</b> ',
      kernelName: this._connector.kernelName || ''
    } as IVariableInspector.IVariableTitle;
    this._inspected.emit({
      title: title,
      payload: []
    } as IVariableInspector.IVariableInspectorUpdate);
  }

  public performMatrixInspection(
    varName: string,
    maxRows: number
  ): Promise<DataModel> {
    return new Promise((resolve, reject) => {
      reject('Cannot inspect matrices w/ the DummyHandler!');
    });
  }

  public performWidgetInspection(
    varName: string
  ): Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > {
    const request: KernelMessage.IExecuteRequestMsg['content'] = {
      code: '',
      stop_on_error: false,
      store_history: false
    };
    return this._connector.execute(request);
  }

  public performDelete(varName: string): void {
    //noop
  }
}
