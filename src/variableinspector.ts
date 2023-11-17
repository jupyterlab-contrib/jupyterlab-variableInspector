import { OutputAreaModel, SimplifiedOutputArea } from '@jupyterlab/outputarea';

import { closeIcon, searchIcon } from '@jupyterlab/ui-components';

import { DataGrid, DataModel } from '@lumino/datagrid';

import { DockLayout, Widget } from '@lumino/widgets';

import { IVariableInspector } from './tokens';

import wildcardMatch from 'wildcard-match';

const TITLE_CLASS = 'jp-VarInspector-title';
const PANEL_CLASS = 'jp-VarInspector';
const TABLE_CLASS = 'jp-VarInspector-table';
const TABLE_BODY_CLASS = 'jp-VarInspector-content';
const TABLE_ROW_CLASS = 'jp-VarInspector-table-row';
const TABLE_ROW_HIDDEN_CLASS = 'jp-VarInspector-table-row-hidden';
const TABLE_TYPE_CLASS = 'jp-VarInspector-type';
const TABLE_NAME_CLASS = 'jp-VarInspector-varName';
const FILTER_TYPE_CLASS = 'filter-type';
const FILTER_INPUT_CLASS = 'filter-input';
const FILTER_BUTTON_CLASS = 'filter-button';
const FILTER_LIST_CLASS = 'filter-list';
const FILTERED_BUTTON_CLASS = 'filtered-variable-button';

type FILTER_TYPES = 'type' | 'name';

/**
 * A panel that renders the variables
 */
export class VariableInspectorPanel
  extends Widget
  implements IVariableInspector
{
  private _source: IVariableInspector.IInspectable | null = null;
  private _filteredTable: HTMLDivElement;
  private _table: HTMLTableElement;
  private _title: HTMLElement;
  private _filtered: { type: Array<string>; name: Array<string> };

  constructor() {
    super();
    this.addClass(PANEL_CLASS);
    this._title = Private.createTitle();
    this._title.className = TITLE_CLASS;
    this._table = Private.createTable();
    this._table.className = TABLE_CLASS;
    this._filteredTable = Private.createFilterTable();
    this.node.appendChild(this._title as HTMLElement);
    this.node.appendChild(this._filteredTable as HTMLElement);
    this.node.appendChild(this._table as HTMLElement);
    this._filtered = { type: [], name: [] };
    this.intializeFilteredTable();
  }

  protected intializeFilteredTable() {
    const filterType = this._filteredTable.querySelector(
      '.' + FILTER_TYPE_CLASS
    ) as HTMLSelectElement;
    const filterInput = this._filteredTable.querySelector(
      '.' + FILTER_INPUT_CLASS
    ) as HTMLInputElement;
    const filterButton = this._filteredTable.querySelector(
      '.' + FILTER_BUTTON_CLASS
    ) as HTMLButtonElement;
    filterButton.addEventListener('click', () => {
      this.onFilterChange(
        filterType.value as FILTER_TYPES,
        filterInput.value,
        true
      );
    });
  }

  // Checks if string is in the filtered array
  protected stringInFilter(string: string, filterType: FILTER_TYPES) {
    // console.log(this._filtered[filterType]);
    for (let i = 0; i < this._filtered[filterType].length; i++) {
      const isMatch = wildcardMatch(this._filtered[filterType][i]);
      if (isMatch(string)) {
        return true;
      }
    }
    return false;
  }

  protected onFilterChange(
    filterType: FILTER_TYPES,
    varName: string,
    isAdding: boolean
  ) {
    if (varName === '') {
      return;
    }
    if (isAdding) {
      if (this._filtered[filterType].includes(varName)) {
        return;
      }
      this._filtered[filterType].push(varName);
      const filterList = this._filteredTable.querySelector(
        '.' + FILTER_LIST_CLASS
      ) as HTMLUListElement;
      const newFilteredButton = Private.createFilteredButton(
        varName,
        filterType
      );
      newFilteredButton.addEventListener('click', () => {
        const filterText = newFilteredButton.querySelector(
          '.filtered-variable-button-text'
        ) as HTMLDivElement;
        this.onFilterChange(filterType, filterText.innerHTML, false);
        this.addFilteredOutRows();
        newFilteredButton.remove();
      });
      filterList.appendChild(newFilteredButton);
      this.filterOutTable();
    } else {
      this._filtered[filterType] = this._filtered[filterType].filter(
        filter => filter !== varName
      );
    }
  }

  protected addFilteredOutRows() {
    const rows = this._table.querySelectorAll(
      '.' + TABLE_ROW_HIDDEN_CLASS
    ) as NodeListOf<HTMLTableRowElement>;
    for (let i = 0; i < rows.length; i++) {
      const rowName = rows[i].querySelector(
        '.' + TABLE_NAME_CLASS
      ) as HTMLTableCellElement;
      const rowType = rows[i].querySelector(
        '.' + TABLE_TYPE_CLASS
      ) as HTMLTableCellElement;
      if (
        !this.stringInFilter(rowName.innerHTML, 'name') &&
        !this._filtered['type'].includes(rowType.innerHTML)
      ) {
        rows[i].className = TABLE_ROW_CLASS;
      }
    }
  }

  protected filterOutTable() {
    const rows = this._table.querySelectorAll(
      '.' + TABLE_ROW_CLASS
    ) as NodeListOf<HTMLTableRowElement>;
    for (let i = 0; i < rows.length; i++) {
      const rowName = rows[i].querySelector(
        '.' + TABLE_NAME_CLASS
      ) as HTMLTableCellElement;
      const rowType = rows[i].querySelector(
        '.' + TABLE_TYPE_CLASS
      ) as HTMLTableCellElement;
      if (
        this.stringInFilter(rowName.innerHTML, 'name') ||
        this._filtered['type'].includes(rowType.innerHTML)
      ) {
        rows[i].className = TABLE_ROW_HIDDEN_CLASS;
      }
    }
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
    let row: HTMLTableRowElement;
    this._table.deleteTFoot();
    this._table.createTFoot();
    this._table.tFoot!.className = TABLE_BODY_CLASS;
    for (let index = 0; index < args.length; index++) {
      const item = args[index];

      const name = item.varName;
      const varType = item.varType;

      row = this._table.tFoot!.insertRow();
      row.className = TABLE_ROW_CLASS;
      if (this._filtered['type'].includes(varType)) {
        row.className = TABLE_ROW_HIDDEN_CLASS;
      } else if (this.stringInFilter(name, 'name')) {
        row.className = TABLE_ROW_HIDDEN_CLASS;
      }

      // Add delete icon and onclick event
      let cell = row.insertCell(0);
      cell.title = 'Delete Variable';
      cell.className = 'jp-VarInspector-deleteButton';
      const ico = closeIcon.element();
      ico.onclick = (ev: MouseEvent): any => {
        this.source?.performDelete(name);
      };
      cell.append(ico);

      // Add onclick event for inspection
      cell = row.insertCell(1);
      if (item.isMatrix) {
        cell.title = 'View Contents';
        cell.className = 'jp-VarInspector-inspectButton';
        const ico = searchIcon.element();
        ico.onclick = (ev: MouseEvent): any => {
          console.log('Click on ' + name);
          this._source
            ?.performMatrixInspection(name)
            .then((model: DataModel) => {
              this._showMatrix(model, name, varType);
            });
        };
        cell.append(ico);
      } else {
        cell.innerHTML = '';
      }

      cell = row.insertCell(2);
      cell.className = TABLE_NAME_CLASS;
      cell.innerHTML = name;

      // Add remaining cells
      cell = row.insertCell(3);
      cell.innerHTML = varType;
      cell.className = TABLE_TYPE_CLASS;
      cell = row.insertCell(4);
      cell.innerHTML = item.varSize;
      cell = row.insertCell(5);
      cell.innerHTML = item.varShape;
      cell = row.insertCell(6);

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
    }
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

  export function createTable(): HTMLTableElement {
    const table = document.createElement('table');
    table.createTHead();
    const hrow = table.tHead!.insertRow(0) as HTMLTableRowElement;

    const cell1 = hrow.insertCell(0);
    cell1.innerHTML = '';
    const cell2 = hrow.insertCell(1);
    cell2.innerHTML = '';
    const cell3 = hrow.insertCell(2);
    cell3.innerHTML = 'Name';
    const cell4 = hrow.insertCell(3);
    cell4.innerHTML = 'Type';
    const cell5 = hrow.insertCell(4);
    cell5.innerHTML = 'Size';
    const cell6 = hrow.insertCell(5);
    cell6.innerHTML = 'Shape';
    const cell7 = hrow.insertCell(6);
    cell7.innerHTML = 'Content';
    return table;
  }

  export function createTitle(header = ''): HTMLParagraphElement {
    const title = document.createElement('p');
    title.innerHTML = header;
    return title;
  }

  export function createFilterTable(): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'filter-container';
    const filterType = document.createElement('select');
    filterType.className = FILTER_TYPE_CLASS;
    const varTypeOption = document.createElement('option');
    varTypeOption.value = 'type';
    varTypeOption.innerHTML = 'Type';
    const nameOption = document.createElement('option');
    nameOption.value = 'name';
    nameOption.innerHTML = 'Name';
    filterType.appendChild(varTypeOption);
    filterType.appendChild(nameOption);
    const searchContainer = document.createElement('div');
    searchContainer.className = 'jp-InputGroup filter-search-container';
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.setAttribute('placeholder', 'Filter out variable');
    input.className = FILTER_INPUT_CLASS;
    const filterButton = document.createElement('button');
    const buttonText = document.createTextNode('Filter');
    filterButton.appendChild(buttonText);
    filterButton.className = FILTER_BUTTON_CLASS;
    const list = document.createElement('ul');
    list.className = FILTER_LIST_CLASS;

    searchContainer.appendChild(filterType);
    searchContainer.appendChild(input);
    searchContainer.appendChild(filterButton);
    container.appendChild(searchContainer);
    container.appendChild(list);
    return container;
  }

  export function createFilteredButton(
    filterName: string,
    filterType: FILTER_TYPES
  ): HTMLButtonElement {
    const filteredButton = document.createElement('button');
    filteredButton.value = filterType;
    filteredButton.title = filterType;
    const buttonText = document.createElement('div');
    buttonText.className = 'filtered-variable-button-text';
    buttonText.innerHTML = filterName;
    const icon = closeIcon.element({
      container: filteredButton
    });
    filteredButton.appendChild(buttonText);
    filteredButton.appendChild(icon);
    filteredButton.className = FILTERED_BUTTON_CLASS;
    return filteredButton;
  }
}
