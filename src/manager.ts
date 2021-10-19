import {
  VariableInspectorPanel,
  IVariableInspector,
} from './variableinspector';

import { Token } from '@lumino/coreutils';

import { VariableInspectionHandler } from './handler';

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
 * A class that manages variable inspector widget instances and offers persistent
 * `IVariableInspector` instance that other plugins can communicate with.
 */
export class VariableInspectorManager implements IVariableInspectorManager {
  private _source: IVariableInspector.IInspectable = null;
  private _panel: VariableInspectorPanel = null;
  private _handlers: { [id: string]: VariableInspectionHandler } = {};

  public hasHandler(id: string): boolean {
    if (this._handlers[id]) {
      return true;
    } else {
      return false;
    }
  }

  public getHandler(id: string): VariableInspectionHandler {
    return this._handlers[id];
  }

  public addHandler(handler: VariableInspectionHandler): void {
    this._handlers[handler.id] = handler;
  }

  /**
   * The current inspector panel.
   */
  get panel(): VariableInspectorPanel {
    return this._panel;
  }

  set panel(panel: VariableInspectorPanel) {
    if (this.panel === panel) {
      return;
    }
    this._panel = panel;

    if (panel && !panel.source) {
      panel.source = this._source;
    }
  }

  /**
   * The source of events the inspector panel listens for.
   */
  get source(): IVariableInspector.IInspectable {
    return this._source;
  }

  set source(source: IVariableInspector.IInspectable) {
    if (this._source === source) {
      return;
    }

    // remove subscriptions
    if (this._source) {
      this._source.disposed.disconnect(this._onSourceDisposed, this);
    }

    this._source = source;

    if (this._panel && !this._panel.isDisposed) {
      this._panel.source = this._source;
    }
    // Subscribe to new source
    if (this._source) {
      this._source.disposed.connect(this._onSourceDisposed, this);
    }
  }

  private _onSourceDisposed(): void {
    this._source = null;
  }
}
