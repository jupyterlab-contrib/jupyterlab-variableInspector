import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { Token } from '@lumino/coreutils';
import { DataModel } from '@lumino/datagrid';
import { IObservableDisposable } from '@lumino/disposable';
import { ISignal } from '@lumino/signaling';
import type { VariableInspectionHandler } from './handler';

export const IVariableInspectorManager = new Token<IVariableInspectorManager>(
  'jupyterlab_extension/variableinspector:IVariableInspectorManager'
);

export interface IVariableInspectorManager {
  source: IVariableInspector.IInspectable | null;
  hasHandler(id: string): boolean;
  getHandler(id: string): VariableInspectionHandler;
  addHandler(handler: VariableInspectionHandler): void;
}

/**
 * The inspector panel token.
 */
export const IVariableInspector = new Token<IVariableInspector>(
  'jupyterlab_extension/variableinspector:IVariableInspector'
);

/**
 * An interface for an inspector.
 */
export interface IVariableInspector {
  source: IVariableInspector.IInspectable | null;
}

/**
 * A namespace for inspector interfaces.
 */
export namespace IVariableInspector {
  export interface IInspectable extends IObservableDisposable {
    inspected: ISignal<IInspectable, IVariableInspectorUpdate>;
    rendermime: IRenderMimeRegistry | null;
    enabled: boolean;
    performInspection(): void;
    performMatrixInspection(
      varName: string,
      maxRows?: number
    ): Promise<DataModel>;
    performWidgetInspection(
      varName: string
    ): Kernel.IShellFuture<
      KernelMessage.IExecuteRequestMsg,
      KernelMessage.IExecuteReplyMsg
    >;
    performDelete(varName: string): void;
  }

  export interface ISettings {
    maxItems: number;
  }

  export interface IVariableInspectorUpdate {
    title: IVariableTitle;
    payload: Array<IVariable>;
  }

  export interface IVariable {
    varName: string;
    varSize: string;
    varShape: string;
    varContent: string;
    varType: string;
    isMatrix: boolean;
    isWidget: boolean;
  }

  export interface IVariableTitle {
    kernelName?: string;
    contextName?: string; //Context currently reserved for special information.
  }
}
