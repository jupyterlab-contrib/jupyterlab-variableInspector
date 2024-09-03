import { ISessionContext } from '@jupyterlab/apputils';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { IExecuteResult } from '@jupyterlab/nbformat';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { KernelMessage, Kernel } from '@jupyterlab/services';

import {
  IExecuteInputMsg,
  IExecuteReplyMsg,
  IExecuteRequestMsg
} from '@jupyterlab/services/lib/kernel/messages';

import { Signal, ISignal } from '@lumino/signaling';

import { JSONModel, DataModel } from '@lumino/datagrid';

import { IVariableInspector } from './tokens';

import { KernelConnector } from './kernelconnector';

abstract class AbstractHandler implements IVariableInspector.IInspectable {
  private _isDisposed = false;
  private _disposed = new Signal<this, void>(this);
  protected _inspected = new Signal<
    IVariableInspector.IInspectable,
    IVariableInspector.IVariableInspectorUpdate
  >(this);
  protected _connector: KernelConnector;
  protected _rendermime: IRenderMimeRegistry | null = null;
  private _enabled: boolean;

  constructor(connector: KernelConnector) {
    this._connector = connector;
    this._enabled = false;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
  }

  get disposed(): ISignal<this, void> {
    return this._disposed;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get inspected(): ISignal<
    IVariableInspector.IInspectable,
    IVariableInspector.IVariableInspectorUpdate
  > {
    return this._inspected;
  }

  get rendermime(): IRenderMimeRegistry | null {
    return this._rendermime;
  }

  abstract performInspection(): void;

  abstract performMatrixInspection(
    varName: string,
    maxRows: number
  ): Promise<DataModel>;

  abstract performWidgetInspection(
    varName: string
  ): Kernel.IShellFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  >;

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._disposed.emit();
    Signal.clearData(this);
  }

  performDelete(varName: string): void {
    //noop
  }
}

/**
 * An object that handles code inspection.
 */
export class VariableInspectionHandler extends AbstractHandler {
  private _initScript: string;
  private _queryCommand: string;
  private _matrixQueryCommand: string;
  private _widgetQueryCommand: string;
  private _deleteCommand: string;
  private _changeSettingsCommand:
    | ((settings: IVariableInspector.ISettings) => string)
    | undefined;
  private _ready: Promise<void>;
  private _id: string;
  private _setting: ISettingRegistry.ISettings;

  constructor(options: VariableInspectionHandler.IOptions) {
    super(options.connector);
    this._id = options.id;
    this._rendermime = options.rendermime ?? null;
    this._queryCommand = options.queryCommand;
    this._matrixQueryCommand = options.matrixQueryCommand;
    this._widgetQueryCommand = options.widgetQueryCommand;
    this._changeSettingsCommand = options.changeSettingsCommand;
    this._deleteCommand = options.deleteCommand;
    this._initScript = options.initScript;
    this._setting = options.setting;

    this._ready = this._connector.ready.then(() => {
      this._initOnKernel().then((msg: KernelMessage.IExecuteReplyMsg) => {
        this.performSettingsChange();
        this._connector.iopubMessage.connect(this._queryCall);
        return;
      });
    });

    const onKernelReset = (sender: unknown, kernelReady: Promise<void>) => {
      const title: IVariableInspector.IVariableTitle = {
        contextName: '<b>Waiting for kernel...</b> '
      };
      this._inspected.emit({
        title: title,
        payload: []
      } as IVariableInspector.IVariableInspectorUpdate);

      this._ready = kernelReady.then(() => {
        this._initOnKernel().then((msg: KernelMessage.IExecuteReplyMsg) => {
          this.performSettingsChange();
          this._connector.iopubMessage.connect(this._queryCall);
          this.performInspection();
        });
      });
    };

    this._setting.changed.connect(async () => {
      await this._ready;

      this.performSettingsChange();
      this.performInspection();
    });

    this._connector.kernelRestarted.connect(onKernelReset);
    this._connector.kernelChanged.connect(onKernelReset);
  }

  get id(): string {
    return this._id;
  }

  get ready(): Promise<void> {
    return this._ready;
  }

  /**
   * Performs an inspection by sending an execute request with the query command to the kernel.
   */
  performInspection(): void {
    if (!this.enabled) {
      return;
    }

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
  performWidgetInspection(
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
  performMatrixInspection(
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
  performDelete(varName: string): void {
    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._deleteCommand + "('" + varName + "')",
      stop_on_error: false,
      store_history: false
    };

    this._connector.fetch(content, this._handleQueryResponse);
  }

  /**
   * Send a kernel request to change settings
   */
  performSettingsChange(): void {
    if (!this._changeSettingsCommand) {
      return;
    }

    const settings: IVariableInspector.ISettings = {
      maxItems: this._setting.get('maxItems').composite as number
    };

    const content: KernelMessage.IExecuteRequestMsg['content'] = {
      code: this._changeSettingsCommand(settings),
      stop_on_error: false,
      store_history: false
    };

    this._connector.fetch(content, this._handleQueryResponse);
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
    changeSettingsCommand?(settings: IVariableInspector.ISettings): string;
    deleteCommand: string;
    initScript: string;
    id: string;
    setting: ISettingRegistry.ISettings;
  }
}

export class DummyHandler extends AbstractHandler {
  constructor(connector: KernelConnector) {
    super(connector);
  }

  performInspection(): void {
    const title: IVariableInspector.IVariableTitle = {
      contextName: '. <b>Language currently not supported.</b> ',
      kernelName: this._connector.kernelName || ''
    };
    this._inspected.emit({
      title: title,
      payload: []
    } as IVariableInspector.IVariableInspectorUpdate);
  }

  performMatrixInspection(
    varName: string,
    maxRows: number
  ): Promise<DataModel> {
    return new Promise((resolve, reject) => {
      reject('Cannot inspect matrices w/ the DummyHandler!');
    });
  }

  performWidgetInspection(
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
}
