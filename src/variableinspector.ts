import {
  ISignal
} from '@phosphor/signaling';

import {
    Token
  } from '@phosphor/coreutils';
  
import {
   Widget, StackedLayout
} from '@phosphor/widgets';

import {
    DataGrid, DataModel
} from "@phosphor/datagrid";

import '../style/index.css';


const PANEL_CLASS = "jp-VarInspector";
const TABLE_CLASS = "jp-VarInspector-table";

/**
 * The inspector panel token.
 */
export
const IVariableInspector = new Token<IVariableInspector>("jupyterlab_extension/variableinspector:IVariableInspector");

/**
 * An interface for an inspector.
 */
export
interface IVariableInspector{
    source: IVariableInspector.IInspectable | null;
    
}

/**
 * A namespace for inspector interfaces.
 */
export
namespace IVariableInspector{
    
    export
    interface IInspectable{
        disposed: ISignal<any,void>;
        inspected: ISignal<any, IVariableInspectorUpdate>;
        datagridSend : ISignal<any,DataModel>;
        performInspection(): void;
        performMatrixInspection(varName:string):void;
    }
    
    export
    type IVariableInspectorUpdate =  Array<IVariable>;
    
    
    export
    interface IVariable{
        varName : string;
        varSize : string;
        varShape : string;
        varContent : string;
        varType : string;
        isMatrix : Boolean;
    }
}


/**
 * A panel that renders the variables
 */
export
class VariableInspectorPanel extends Widget implements IVariableInspector{
    
    private _source : IVariableInspector.IInspectable | null = null;
    private _table : HTMLTableElement;

    
    constructor() {
        super();
        this.addClass(PANEL_CLASS);
        this._table = Private.createTable();
        this._table.className = TABLE_CLASS;
        this.node.appendChild(this._table as HTMLElement);
    }   
    
    get source(): IVariableInspector.IInspectable | null{
        return this._source;
    }
    
    set source(source: IVariableInspector.IInspectable | null){
        
        if (this._source === source){
            this._source.performInspection();
            return;
        }
        //Remove old subscriptions
        if (this._source){
            this._source.inspected.disconnect(this.onInspectorUpdate,this);
            this._source.datagridSend.disconnect(this.addDataGrid, this);
            this._source.disposed.disconnect(this.onSourceDisposed, this);
        }        
        this._source = source;
        //Subscribe to new object
        if(this._source){            
            this._source.inspected.connect(this.onInspectorUpdate,this);
            this._source.disposed.connect(this.onSourceDisposed, this);
            this._source.datagridSend.connect(this.addDataGrid, this);
            this._source.performInspection();
        }  
    }
    
    /**
     * Dispose resources
     */
    dispose():void{
        if(this.isDisposed){
            return;
        }
        this.source = null;
        super.dispose();
    }
    
    
    addDataGrid(sender: any, dataModel:DataModel):void{
        let datagrid =  new DataGrid({
            baseRowSize: 32,
            baseColumnSize: 128,
            baseRowHeaderSize: 64,
            baseColumnHeaderSize: 32            
        });
        datagrid.model = dataModel;
        datagrid.title.label = "DataGrid";
        datagrid.title.closable = true;
        let lout : StackedLayout= <StackedLayout> this.parent.layout;
        lout.addWidget(datagrid);
        
    }
    
    
    protected onInspectorUpdate(sender: any, args: IVariableInspector.IVariableInspectorUpdate ):void{
        
        
        //Render new variable state
        let row: HTMLTableRowElement;
        this._table.deleteTFoot();
        this._table.createTFoot();
        for ( var index = 0; index < args.length; index++ ) {
            row = this._table.tFoot.insertRow();
            if(args[index].isMatrix){
                let name = args[index].varName;
                row.onclick = ( ev: MouseEvent):any =>{
                    console.log("clock");
                    this._source.performMatrixInspection(name);
                }
                row.bgColor =  "#78BE20";
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
            cell.innerHTML = args[index].varContent;
        }
    }
    
    /**
     * Handle source disposed signals.
     */
    protected onSourceDisposed(sender: any, args: void): void {
      this.source = null;
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
}