import { OutputAreaModel, SimplifiedOutputArea } from '@jupyterlab/outputarea';

import { closeIcon, searchIcon } from '@jupyterlab/ui-components';

import { DataGrid, DataModel } from '@lumino/datagrid';

import { DockLayout, Widget } from '@lumino/widgets';

import { IVariableInspector } from './tokens';

import {
  DataGrid as WebDataGrid,
  allComponents,
  provideJupyterDesignSystem
} from '@jupyter/web-components';
provideJupyterDesignSystem().register(allComponents);

import { ViewTemplate } from '@microsoft/fast-element';

const TITLE_CLASS = 'jp-VarInspector-title';
const PANEL_CLASS = 'jp-VarInspector';
const TABLE_CLASS = 'jp-VarInspector-table';
// const TABLE_BODY_CLASS = 'jp-VarInspector-content';

/**
 * A panel that renders the variables
 */
export class VariableInspectorPanel
  extends Widget
  implements IVariableInspector
{
  private _source: IVariableInspector.IInspectable | null = null;
  private _table: WebDataGrid;
  private _title: HTMLElement;

  constructor() {
    super();
    this.addClass(PANEL_CLASS);
    this._title = Private.createTitle();
    this._title.className = TITLE_CLASS;
    this._table = Private.createTable();
    this._table.className = TABLE_CLASS;
    this.node.appendChild(this._title as HTMLElement);
    this.node.appendChild(this._table as HTMLElement);
  }

  get source(): IVariableInspector.IInspectable | null {
    return this._source;
  }

  set source(source: IVariableInspector.IInspectable | null) {
    if (this._source === source) {
      // this._source.performInspection();
      return;
    }
    //Remove old subscriptions
    if (this._source) {
      this._source.inspected.disconnect(this.onInspectorUpdate, this);
      this._source.disposed.disconnect(this.onSourceDisposed, this);
    }
    this._source = source;
    //Subscribe to new object
    if (this._source) {
      this._source.inspected.connect(this.onInspectorUpdate, this);
      this._source.disposed.connect(this.onSourceDisposed, this);
      this._source.performInspection();
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.source = null;
    super.dispose();
  }

  protected onInspectorUpdate(
    sender: any,
    allArgs: IVariableInspector.IVariableInspectorUpdate
  ): void {
    if (!this.isAttached) {
      return;
    }

    const title = allArgs.title;
    const args = allArgs.payload;

    if (title.contextName) {
      this._title.innerHTML = title.contextName;
    } else {
      this._title.innerHTML =
        "    Inspecting '" + title.kernelName + "' " + title.contextName;
    }

    //Render new variable state
    const table = [];
    for (let index = 0; index < args.length; index++) {
      const item = args[index];

      const variableObj: {
        delete: string;
        view: HTMLDivElement;
        name: string;
        varType: string;
        size: string;
        shape: string;
        content: HTMLDivElement;
      } = {
        delete: 'yep',
        view: document.createElement('div'),
        name: item.varName,
        varType: item.varType,
        size: item.varSize,
        shape: item.varShape,
        content: document.createElement('div')
      };

      // Add delete icon and onclick event
      let cell = document.createElement('div');
      cell.title = 'Delete Variable';
      cell.className = 'jp-VarInspector-deleteButton';
      const ico = closeIcon.element();
      ico.onclick = (ev: MouseEvent): any => {
        this.source?.performDelete(item.varName);
      };
      cell.append(ico);
      // variableObj.delete = cell;

      // Add onclick event for inspection
      cell = document.createElement('div');
      if (item.isMatrix) {
        cell.title = 'View Contents';
        cell.className = 'jp-VarInspector-inspectButton';
        const ico = searchIcon.element();
        ico.onclick = (ev: MouseEvent): any => {
          console.log('Click on ' + item.varName);
          this._source
            ?.performMatrixInspection(item.varName)
            .then((model: DataModel) => {
              this._showMatrix(model, item.varName, item.varType);
            });
        };
        cell.append(ico);
      } else {
        cell.innerHTML = '';
      }
      variableObj.view = cell;

      cell = document.createElement('div');
      const rendermime = this._source?.rendermime;
      if (item.isWidget && rendermime) {
        const model = new OutputAreaModel({ trusted: true });
        const output = new SimplifiedOutputArea({ model, rendermime });
        output.future = this._source!.performWidgetInspection(item.varName);
        Widget.attach(output, cell);
      } else {
        cell.innerHTML = Private.escapeHtml(item.varContent).replace(
          /\\n/g,
          '</br>'
        );
      }
      variableObj.content = cell;
      table.push(variableObj);
    }
    this._table.rowsData = table;
  }

  /**
   * Handle source disposed signals.
   */
  protected onSourceDisposed(sender: any, args: void): void {
    this.source = null;
  }

  private _showMatrix(
    dataModel: DataModel,
    name: string,
    varType: string
  ): void {
    const datagrid = new DataGrid({
      defaultSizes: {
        rowHeight: 32,
        columnWidth: 128,
        rowHeaderWidth: 64,
        columnHeaderHeight: 32
      }
    });

    datagrid.dataModel = dataModel;
    datagrid.title.label = varType + ': ' + name;
    datagrid.title.closable = true;
    const lout: DockLayout = this.parent!.layout as DockLayout;
    lout.addWidget(datagrid, { mode: 'split-right' });
    //todo activate/focus matrix widget
  }
}

namespace Private {
  const entityMap = new Map<string, string>(
    Object.entries({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    })
  );

  export function escapeHtml(source: string): string {
    return String(source).replace(
      /[&<>"'/]/g,
      (s: string) => entityMap.get(s)!
    );
  }

  export function createTable(): WebDataGrid {
    const table = document.createElement('jp-data-grid') as WebDataGrid;
    table.generateHeader = 'sticky';
    table.columnDefinitions = [
      {
        columnDataKey: 'delete',
        title: '',
        cellTemplate: new ViewTemplate(
          '<div><button onclick="()=>{this.source?.performDelete(item.varName);}">Delete</button><div>',
          []
        )
      },
      { columnDataKey: 'view', title: '' },
      { columnDataKey: 'name', title: 'Name' },
      { columnDataKey: 'varType', title: 'VarType' },
      { columnDataKey: 'size', title: 'Size' },
      { columnDataKey: 'shape', title: 'Shape' },
      { columnDataKey: 'content', title: 'Content' }
    ];
    return table;
  }

  export function createCellTemplate(table: WebDataGrid): HTMLTemplateElement {
    const template = document.createElement('template');
    const container = document.createElement('div');
    container.innerText = 'testing';
    template.appendChild(container);
    table.appendChild(template);
    return template;
  }

  export function createTitle(header = ''): HTMLParagraphElement {
    const title = document.createElement('p');
    title.innerHTML = header;
    return title;
  }
}
