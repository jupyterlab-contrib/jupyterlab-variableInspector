import {
    OutputAreaModel,
    SimplifiedOutputArea
} from '@jupyterlab/outputarea';

import {
    IRenderMimeRegistry
} from '@jupyterlab/rendermime';

import {
    Kernel, 
    KernelMessage 
} from '@jupyterlab/services';

import {
    ISignal
} from '@lumino/signaling';

import {
    Token
} from '@lumino/coreutils';

import {
     DockLayout, Widget,
} from '@lumino/widgets';

import {
    DataGrid, DataModel
} from "@lumino/datagrid";

import '../style/index.css';

const TITLE_CLASS = "jp-VarInspector-title";
const PANEL_CLASS = "jp-VarInspector";
const TABLE_CLASS = "jp-VarInspector-table";
const TABLE_BODY_CLASS = "jp-VarInspector-content";

/**
 * The inspector panel token.
 */
export
    const IVariableInspector = new Token<IVariableInspector>( "jupyterlab_extension/variableinspector:IVariableInspector" );

/**
 * An interface for an inspector.
 */
export
    interface IVariableInspector {
    source: IVariableInspector.IInspectable | null;

}

/**
 * A namespace for inspector interfaces.
 */
export
namespace IVariableInspector {

    export
        interface IInspectable {
        disposed: ISignal<any, void>;
        inspected: ISignal<any, IVariableInspectorUpdate>;
        rendermime: IRenderMimeRegistry;
        performInspection(): void;
        performMatrixInspection( varName: string, maxRows? : number ): Promise<DataModel>;
        performWidgetInspection( varName: string ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg>;
        performDelete( varName: string ): void;
    }

    export
        interface IVariableInspectorUpdate {
        title: IVariableTitle;
        payload: Array<IVariable>;
    } 

    export
        interface IVariable {
        varName: string;
        varSize: string;
        varShape: string;
        varContent: string;
        varType: string;
        isMatrix: boolean;
        isWidget: boolean;
    }
    export
        interface IVariableTitle {
        kernelName?: string;
        contextName?: string; //Context currently reserved for special information.
        }
}


/**
 * A panel that renders the variables
 */
export
    class VariableInspectorPanel extends Widget implements IVariableInspector {

    private _source: IVariableInspector.IInspectable | null = null;
    private _table: HTMLTableElement;
    private _title: HTMLElement;


    constructor() {
        super();
        this.addClass( PANEL_CLASS );
        this._title = Private.createTitle();
        this._title.className = TITLE_CLASS;
        this._table = Private.createTable();
        this._table.className = TABLE_CLASS;
        this.node.appendChild( this._title as HTMLElement );
        this.node.appendChild( this._table as HTMLElement );
    }

    get source(): IVariableInspector.IInspectable | null {
        return this._source;
    }

    set source( source: IVariableInspector.IInspectable | null ) {

        if ( this._source === source ) {
           // this._source.performInspection();
            return;
        }
        //Remove old subscriptions
        if ( this._source ) {
            this._source.inspected.disconnect( this.onInspectorUpdate, this );
            this._source.disposed.disconnect( this.onSourceDisposed, this );
        }
        this._source = source;
        //Subscribe to new object
        if ( this._source ) {
            this._source.inspected.connect( this.onInspectorUpdate, this );
            this._source.disposed.connect( this.onSourceDisposed, this );
            this._source.performInspection();
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if ( this.isDisposed ) {
            return;
        }
        this.source = null;
        super.dispose();
    }

    protected onInspectorUpdate( sender: any, allArgs: IVariableInspector.IVariableInspectorUpdate): void {
        if (!this.isAttached) {
            return;
        }

        let title = allArgs.title;
        let args = allArgs.payload;
        
        if (title.contextName){
            this._title.innerHTML = title.contextName;            
        }else{
            this._title.innerHTML = "    Inspecting '" + title.kernelName + "' "+title.contextName;
        }
        
        //Render new variable state
        let row: HTMLTableRowElement;
        this._table.deleteTFoot();
        this._table.createTFoot();
        this._table.tFoot.className = TABLE_BODY_CLASS;
        for ( let index = 0; index < args.length; index++ ) {
            const item = args[index];
            let name = item.varName;
            let varType = item.varType;

            row = this._table.tFoot.insertRow();

            // Add delete icon and onclick event
            let cell = row.insertCell( 0 );
            cell.innerHTML = "&#128465;";
            cell.className = "jp-VarInspector-deleteButton";
            cell.title = "Delete";
            cell.onclick = ( ev: MouseEvent ): any => {
                this.source.performDelete( name );
            };
            
            // Add name cell and onclick event for inspection
            cell = row.insertCell( 1 );
            cell.innerHTML = name;
            
            if ( item.isMatrix ) {
              cell.className = "jp-VarInspector-varName";
              cell.title = "View Contents";

              cell.onclick = ( ev: MouseEvent ): any => {
                  this._source.performMatrixInspection( name ).then(( model: DataModel ) => {
                      this._showMatrix( model, name, varType )
                  } );
              }
            }

            // Add remaining cells
            cell = row.insertCell( 2 );
            cell.innerHTML = varType;
            cell = row.insertCell( 3 );
            cell.innerHTML = item.varSize;
            cell = row.insertCell( 4 );
            cell.innerHTML = item.varShape;
            cell = row.insertCell( 5 );

            const rendermime = this._source.rendermime;
            if (item.isWidget && rendermime) {
                const model = new OutputAreaModel({trusted: true});
                const output = new SimplifiedOutputArea({ model, rendermime });
                output.future = this._source.performWidgetInspection(item.varName);
                Widget.attach(output, cell);
            } else {
                cell.innerHTML = item.varContent.replace(/\\n/g,  "</br>");
            }
        }
    }

    /**
     * Handle source disposed signals.
     */
    protected onSourceDisposed( sender: any, args: void ): void {
        this.source = null;
    }



    private _showMatrix( dataModel: DataModel, name: string, varType: string ): void {
        let datagrid = new DataGrid( {defaultSizes : {
            rowHeight: 32,
            columnWidth: 128,
            rowHeaderWidth: 64,
            columnHeaderHeight: 32
        } 
        } );

        datagrid.dataModel = dataModel;
        datagrid.title.label = varType + ": " + name;
        datagrid.title.closable = true;
        let lout: DockLayout = <DockLayout>this.parent.layout;
        lout.addWidget( datagrid , {mode: "split-right"});
        //todo activate/focus matrix widget
    }

}


namespace Private {

    export
        function createTable(): HTMLTableElement {
        let table = document.createElement( "table" );
        table.createTHead();
        let hrow = <HTMLTableRowElement>table.tHead.insertRow( 0 );

        let cell1 = hrow.insertCell( 0 );
        cell1.innerHTML = "";
        let cell2 = hrow.insertCell( 1 );
        cell2.innerHTML = "Name";
        let cell3 = hrow.insertCell( 2 );
        cell3.innerHTML = "Type";
        let cell4 = hrow.insertCell( 3 );
        cell4.innerHTML = "Size";
        let cell5 = hrow.insertCell( 4 );
        cell5.innerHTML = "Shape";
        let cell6 = hrow.insertCell( 5 );
        cell6.innerHTML = "Content";
        return table;
    }

    export
        function createTitle(header="") {
        let title = document.createElement( "p" );
        title.innerHTML = header;
        return title;
    }
}
