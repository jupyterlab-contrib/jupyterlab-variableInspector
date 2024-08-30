import { OutputAreaModel, SimplifiedOutputArea } from '@jupyterlab/outputarea';

import { closeIcon, searchIcon } from '@jupyterlab/ui-components';

import { DataGrid, DataModel } from '@lumino/datagrid';

import { DockLayout, Widget } from '@lumino/widgets';

import { IVariableInspector } from './tokens';

import {
  DataGrid as WebDataGrid,
  DataGridRow,
  DataGridCell,
  provideJupyterDesignSystem,
  Select,
  Option,
  TextField,
  Button,
  jpDataGrid,
  jpDataGridRow,
  jpDataGridCell,
  jpTextField,
  jpOption,
  jpSelect,
  jpButton
} from '@jupyter/web-components';
provideJupyterDesignSystem().register(
  jpDataGrid(),
  jpDataGridRow(),
  jpDataGridCell(),
  jpTextField(),
  jpOption(),
  jpSelect(),
  jpButton()
);

import wildcardMatch from 'wildcard-match';
import { Message } from '@lumino/messaging';

const TITLE_CLASS = 'jp-VarInspector-title';
const PANEL_CLASS = 'jp-VarInspector';
const TABLE_CLASS = 'jp-VarInspector-table';
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
  private _table: WebDataGrid;
  private _filteredTable: HTMLDivElement;
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

  //Sets up the filter table so when the filter button is pressed, a new filter is created
  protected intializeFilteredTable() {
    const filterType = this._filteredTable.querySelector(
      '.' + FILTER_TYPE_CLASS
    ) as Select;
    const filterInput = this._filteredTable.querySelector(
      '.' + FILTER_INPUT_CLASS
    ) as TextField;
    const filterButton = this._filteredTable.querySelector(
      '.' + FILTER_BUTTON_CLASS
    ) as Button;
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
  /*
    Either adds a new filter or removes a previously existing filter based
    Params:
    filterType: By what type the varName is filtering on
    varName: The name of the variable we are trying to filter out
    isAdding: If we are adding a new filter or removing a previous filter
  */

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

  /*
  Goes through each filtered out row and checks if they should still be filtered
  If not, the row becomes visible again
  */
  protected addFilteredOutRows() {
    const rows = this._table.querySelectorAll(
      '.' + TABLE_ROW_HIDDEN_CLASS
    ) as NodeListOf<DataGridRow>;
    for (let i = 0; i < rows.length; i++) {
      const rowName = rows[i].querySelector(
        '.' + TABLE_NAME_CLASS
      ) as DataGridCell;
      const rowType = rows[i].querySelector(
        '.' + TABLE_TYPE_CLASS
      ) as DataGridCell;
      if (
        !this.stringInFilter(rowName.innerHTML, 'name') &&
        !this._filtered['type'].includes(rowType.innerHTML)
      ) {
        rows[i].className = TABLE_ROW_CLASS;
      }
    }
  }

  /*
  Goes through each row and checks if the row should be filtered out
  A row is filtered out if it matches any of the values in the _filtered object
  */
  protected filterOutTable() {
    const rows = this._table.querySelectorAll(
      '.' + TABLE_ROW_CLASS
    ) as NodeListOf<DataGridRow>;
    for (let i = 0; i < rows.length; i++) {
      const rowName = rows[i].querySelector(
        '.' + TABLE_NAME_CLASS
      ) as DataGridCell;
      const rowType = rows[i].querySelector(
        '.' + TABLE_TYPE_CLASS
      ) as DataGridCell;
      if (
        this.stringInFilter(rowName.innerHTML, 'name') ||
        this._filtered['type'].includes(rowType.innerHTML)
      ) {
        rows[i].className = TABLE_ROW_HIDDEN_CLASS;
      }
    }
  }

  /*
  Goes through each row and if it finds a variable with name 'name', then it deletes it
  */
  protected removeRow(name: string) {
    const rows = this._table.querySelectorAll(
      '.' + TABLE_ROW_CLASS
    ) as NodeListOf<DataGridRow>;
    for (let i = 0; i < rows.length; i++) {
      const cell = rows[i].querySelector(
        '.' + TABLE_NAME_CLASS
      ) as DataGridCell;
      if (cell.innerHTML === name) {
        rows[i].remove();
        return;
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
      this._source.enabled = false;
      this._source.inspected.disconnect(this.onInspectorUpdate, this);
      this._source.disposed.disconnect(this.onSourceDisposed, this);
    }
    this._source = source;
    //Subscribe to new object
    if (this._source) {
      this._source.enabled = true;
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
    if (this.source) {
      this.source.enabled = false;
    }
    this.source = null;
    super.dispose();
  }

  protected onCloseRequest(msg: Message): void {
    super.onCloseRequest(msg);
    if (this._source) {
      this._source.enabled = false;
    }
  }

  protected onAfterShow(msg: Message): void {
    super.onAfterShow(msg);
    if (this._source) {
      this._source.enabled = true;
      this._source.performInspection();
    }
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

    this._table.innerHTML = '';
    const headerRow = document.createElement('jp-data-grid-row') as DataGridRow;
    headerRow.className = 'sticky-header';
    const columns = [' ', ' ', 'NAME', 'TYPE', 'SIZE', 'SHAPE', 'CONTENT'];
    for (let i = 0; i < columns.length; i++) {
      const headerCell = document.createElement(
        'jp-data-grid-cell'
      ) as DataGridCell;
      headerCell.className = 'column-header';
      headerCell.textContent = columns[i];
      headerCell.gridColumn = (i + 1).toString();
      headerRow.appendChild(headerCell);
    }
    this._table.appendChild(headerRow);

    //Render new variable state
    for (let index = 0; index < args.length; index++) {
      const item = args[index];
      const name = item.varName;
      const varType = item.varType;

      const row = document.createElement('jp-data-grid-row') as DataGridRow;
      row.className = TABLE_ROW_CLASS;
      if (this._filtered['type'].includes(varType)) {
        row.className = TABLE_ROW_HIDDEN_CLASS;
      } else if (this.stringInFilter(name, 'name')) {
        row.className = TABLE_ROW_HIDDEN_CLASS;
      }

      // Add delete icon and onclick event
      let cell = document.createElement('jp-data-grid-cell') as DataGridCell;
      cell.title = 'Delete Variable';
      cell.className = 'jp-VarInspector-deleteButton';
      cell.gridColumn = '1';
      const closeButton = document.createElement('jp-button') as Button;
      closeButton.appearance = 'stealth';
      const ico = closeIcon.element();
      ico.className = 'icon-button';
      ico.onclick = (ev: MouseEvent): any => {
        this.removeRow(name);
      };
      closeButton.append(ico);
      cell.append(closeButton);
      row.appendChild(cell);

      // Add onclick event for inspection
      cell = document.createElement('jp-data-grid-cell') as DataGridCell;
      if (item.isMatrix) {
        cell.title = 'View Contents';
        cell.className = 'jp-VarInspector-inspectButton';
        const searchButton = document.createElement('jp-button') as Button;
        searchButton.appearance = 'stealth';
        const ico = searchIcon.element();
        ico.className = 'icon-button';
        ico.onclick = (ev: MouseEvent): any => {
          this._source
            ?.performMatrixInspection(item.varName)
            .then((model: DataModel) => {
              this._showMatrix(model, item.varName, item.varType);
            });
        };
        searchButton.append(ico);
        cell.append(searchButton);
      } else {
        cell.innerHTML = '';
      }
      cell.gridColumn = '2';
      row.appendChild(cell);

      cell = document.createElement('jp-data-grid-cell') as DataGridCell;
      cell.className = TABLE_NAME_CLASS;
      cell.innerHTML = name;
      cell.gridColumn = '3';
      row.appendChild(cell);

      // Add remaining cells
      cell = document.createElement('jp-data-grid-cell') as DataGridCell;
      cell.innerHTML = varType;
      cell.className = TABLE_TYPE_CLASS;
      cell.gridColumn = '4';
      row.appendChild(cell);
      cell = document.createElement('jp-data-grid-cell') as DataGridCell;
      cell.innerHTML = item.varSize;
      cell.gridColumn = '5';
      row.appendChild(cell);
      cell = document.createElement('jp-data-grid-cell') as DataGridCell;
      cell.innerHTML = item.varShape;
      cell.gridColumn = '6';
      row.appendChild(cell);

      cell = document.createElement('jp-data-grid-cell') as DataGridCell;
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
      cell.gridColumn = '7';
      row.appendChild(cell);
      this._table.appendChild(row);
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

  export function createTable(): WebDataGrid {
    const table = document.createElement('jp-data-grid') as WebDataGrid;
    table.generateHeader = 'sticky';
    table.gridTemplateColumns = '1fr 1fr 6fr 4fr 4fr 5fr 16fr';
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
    const filterType = document.createElement('jp-select') as Select;
    filterType.className = FILTER_TYPE_CLASS;
    filterType.selectedIndex = 0;
    const varTypeOption = document.createElement('jp-option') as Option;
    varTypeOption.value = 'type';
    varTypeOption.innerHTML = 'Type';
    const nameOption = document.createElement('jp-option') as Option;
    nameOption.value = 'name';
    nameOption.innerHTML = 'Name';
    filterType.appendChild(varTypeOption);
    filterType.appendChild(nameOption);
    const searchContainer = document.createElement('div');
    searchContainer.className = 'filter-search-container';
    const input = document.createElement('jp-text-field') as TextField;
    input.setAttribute('type', 'text');
    input.setAttribute('placeholder', 'Filter out variable');
    input.className = FILTER_INPUT_CLASS;
    const filterButton = document.createElement('jp-button') as Button;
    filterButton.textContent = 'Filter';
    filterButton.className = FILTER_BUTTON_CLASS;
    filterButton.appearance = 'accent';
    const list = document.createElement('ul');
    list.className = FILTER_LIST_CLASS;

    searchContainer.appendChild(filterType);
    searchContainer.appendChild(input);
    searchContainer.appendChild(filterButton);
    container.appendChild(searchContainer);
    container.appendChild(list);
    return container;
  }

  //Creates a button with given filter information displayed on the button
  export function createFilteredButton(
    filterName: string,
    filterType: FILTER_TYPES
  ): Button {
    const filteredButton = document.createElement('jp-button') as Button;
    filteredButton.value = filterType;
    filteredButton.title = filterType;
    filteredButton.className = FILTERED_BUTTON_CLASS;
    const filterButtonContent = document.createElement('div');
    filterButtonContent.className = 'filter-button-content';
    const buttonText = document.createElement('div');
    buttonText.className = 'filtered-variable-button-text';
    buttonText.innerHTML = filterName;
    closeIcon.element({
      container: filterButtonContent
    });
    filterButtonContent.insertAdjacentElement('afterbegin', buttonText);
    filteredButton.appendChild(filterButtonContent);
    filteredButton.className = FILTERED_BUTTON_CLASS;
    return filteredButton;
  }
}
