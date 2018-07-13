import {
    ISignal
} from '@phosphor/signaling';

import {
    Token
} from '@phosphor/coreutils';

import {
     DockLayout
} from '@phosphor/widgets';

import {
    DataGrid, DataModel
} from "@phosphor/datagrid";

import {
    MainAreaWidget, IClientSession, Toolbar
} from "@jupyterlab/apputils";

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
        session: IClientSession;
        disposed: ISignal<any, void>;
        inspected: ISignal<any, IVariableInspectorUpdate>;
        performInspection(): void;
        performMatrixInspection( varName: string, maxRows? : number ): Promise<DataModel>;
    }

    export
        interface IVariableInspectorUpdate {
        title: IVariableKernelInfo;
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
    }
    export
        interface IVariableKernelInfo {
        kernelName?: string;
        languageName?: string;
        contextName?: string; //Context currently reserved for special information.
        }
}


/**
 * A panel that renders the variables
 */
export
    class VariableInspectorPanel extends MainAreaWidget implements IVariableInspector {

    private _source: IVariableInspector.IInspectable | null = null;
    private _table: HTMLTableElement;
    private _title: HTMLElement;
    private _kernelInfo : IVariableInspector.IVariableKernelInfo;


    constructor() {
        super();
        this.addClass( PANEL_CLASS );
        this._title = Private.createTitle();
        this._title.className = TITLE_CLASS;
        this._table = Private.createTable();
        this._table.className = TABLE_CLASS;
        this.node.appendChild( this._title as HTMLElement );
        this.node.appendChild( this._table as HTMLElement );
        this._kernelInfo = {contextName : "FOO" ,kernelName : "BAR", languageName : "BAZ"};
            
    }
    
    get session(): IClientSession {
        return this._source.session;
    }
    
    get kernelinfo(): IVariableInspector.IVariableKernelInfo{
        return this._kernelInfo;
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
            this.toolbar = new Toolbar();
            this.toolbar.addItem("kernelname", Toolbar.createKernelNameItem(this._source.session));
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

        let title = allArgs.title;
        let args = allArgs.payload;

        this._title.innerHTML = "    Inspecting " + title.languageName + "-kernel '"+title.kernelName + "'"+title.contextName;

        //Render new variable state
        let row: HTMLTableRowElement;
        this._table.deleteTFoot();
        this._table.createTFoot();
        this._table.tFoot.className = TABLE_BODY_CLASS;
        for ( var index = 0; index < args.length; index++ ) {
            row = this._table.tFoot.insertRow();
            if ( args[index].isMatrix ) {
                let name = args[index].varName;
                row.onclick = ( ev: MouseEvent ): any => {
                    this._source.performMatrixInspection( name ).then(( model: DataModel ) => {
                        this._showMatrix( model, name )
                    } );
                }
            }
            let cell = row.insertCell( 0 );
            cell.innerHTML = args[index].varName;
            cell = row.insertCell( 1 );
            cell.innerHTML = args[index].varType;
            cell = row.insertCell( 2 );
            cell.innerHTML = args[index].varSize;
            cell = row.insertCell( 3 );
            cell.innerHTML = args[index].varShape;
            cell = row.insertCell( 4 );
            cell.innerHTML = args[index].varContent.replace(/\\n/g,  "</br>");
        }
    }

    /**
     * Handle source disposed signals.
     */
    protected onSourceDisposed( sender: any, args: void ): void {
        this.source = null;
    }



    private _showMatrix( dataModel: DataModel, name: string ): void {
        let datagrid = new DataGrid( {
            baseRowSize: 32,
            baseColumnSize: 128,
            baseRowHeaderSize: 64,
            baseColumnHeaderSize: 32
        } );
        datagrid.model = dataModel;
        datagrid.title.label = "Matrix: " + name;
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
        cell1.innerHTML = "Name";
        let cell2 = hrow.insertCell( 1 );
        cell2.innerHTML = "Type";
        let cell3 = hrow.insertCell( 2 );
        cell3.innerHTML = "Size";
        let cell4 = hrow.insertCell( 3 );
        cell4.innerHTML = "Shape";
        let cell5 = hrow.insertCell( 4 );
        cell5.innerHTML = "Content";
        return table;
    }

    export
        function createTitle(header="") {
        let title = document.createElement( "p" );
        title.innerHTML = header;
        return title;
    }   
  }