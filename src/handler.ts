import {
    IDisposable
} from '@phosphor/disposable';

import {
    IVariableInspector
} from './variableinspector';

import {
    KernelConnector
} from "./kernelconnector";

import {
    IClientSession
} from "@jupyterlab/apputils";

import {
    KernelMessage
} from "@jupyterlab/services";

import {
    Signal, ISignal
} from "@phosphor/signaling"

import {
    nbformat
} from "@jupyterlab/coreutils"

import {
    JSONModel, DataGrid
}from "@phosphor/datagrid";

/**
 * An object that handles code inspection.
 */
export
    class VariableInspectionHandler implements IDisposable, IVariableInspector.IInspectable {

    private _connector: KernelConnector;
    private _queryCommand: string;
    private _initScript: string;
    private _matrixQueryCommand : string;
    private _disposed = new Signal<this, void>( this );
    private _inspected = new Signal<this, IVariableInspector.IVariableInspectorUpdate>( this );
    private _isDisposed = false;

    constructor( options: VariableInspectionHandler.IOptions ) {
        this._connector = options.connector;
        this._queryCommand = options.queryCommand;
        this._initScript = options.initScript;
        this._connector.ready.then(() => {
            this._initOnKernel().then(( msg ) => {
                this._connector.iopubMessage.connect( this._queryCall );
            } );
        } );
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
    
    /**
     * A signal emitted when an inspector value is generated.
     */
    get inspected(): ISignal<VariableInspectionHandler, IVariableInspector.IVariableInspectorUpdate> {
        return this._inspected;
    }
    
    /**
     * Performs an inspection by sending an execute request with the query command to the kernel.
     */
    public performInspection(): void {
        let request: KernelMessage.IExecuteRequest = {
            code: this._queryCommand,
            stop_on_error: false,
            store_history: false,
        };
        this._connector.fetch( request, this._handleQueryResponse );
    }

    /**
     * Performs an inspection of the specified matrix.
     */
    public performMatrixInspection(varName:string):void{
        let request: KernelMessage.IExecuteRequest = {
                code: this._matrixQueryCommand + "(" + varName + ")",
                stop_on_error : false,
                store_history: false,
        };
        this._connector.fetch(request, this._handleMatrixInspectionResponse );
    }
    
    /*
     * Disposes the kernel connector.
     */
    dispose(): void {
        if ( this.isDisposed ) {
            return;
        }
        this._isDisposed = true;
        this._disposed.emit( void 0 );
        Signal.clearData( this );
    }

  

    /**
     * Initializes the kernel by running the set up script located at _initScriptPath.
     * TODO: Use script based on kernel language.
     */
    private _initOnKernel(): Promise<KernelMessage.IExecuteReplyMsg> {
        let request: KernelMessage.IExecuteRequest = {
            code: this._initScript,
            stop_on_error: false,
            store_history: false,
        };

        let reply: Promise<KernelMessage.IExecuteReplyMsg> = this._connector.fetch( request );
        return reply;
   
    }



    /*
     * Handle query response. Emit new signal containing the IVariableInspector.IInspectorUpdate object.
     * (TODO: query resp. could be forwarded to panel directly)
     */
    private _handleQueryResponse = ( response: KernelMessage.IIOPubMessage ) : void => {
        
        let msgType = response.header.msg_type;
        switch (msgType){
            case "execute_result":
                let payload = respose.content as nbformat.IExecuteResult;
                let content: string = <string>payload.data["text/plain"];
                content = content.replace( /^'|'$/g, '' );
    
                let update: IVariableInspector.IVariableInspectorUpdate;
                update = <IVariableInspector.IVariableInspectorUpdate>JSON.parse( content );
    
                this._inspected.emit( update );
                break;
             default:
                 break;     
        }        
    };
    
    
    private _handleMatrixInspectionResponse = (response : KernelMessage.IIOPubMessage) : void =>{
        let msgType = response.header.msg_type;
        switch(msgType){
        case "execute_result":
            let payload = response.content as nbformat.IExecuteResult;
            let content : string = <sting> payload.data["text/plain"];
            content = content.replace(/^'|'$/g, "");
            
            let model : JSONModel;
            model = <JSONModel> JSON.parse(content);
            
            
            let grid5 = new DataGrid({
                style: {
                    ...DataGrid.defaultStyle,
                    rowBackgroundColor: i => i % 2 === 0 ? 'rgba(138, 172, 200, 0.3)' : '',
                    columnBackgroundColor: i => i % 2 === 0 ? 'rgba(100, 100, 100, 0.1)' : ''
                },
                baseRowSize: 32,
                baseColumnSize: 128,
                baseRowHeaderSize: 64,
                baseColumnHeaderSize: 32
              });
            grid5.model = model
            //TODO add response to JSON grid.
            //TODO: How to refresh the datagrid.
            break;
        default:
            break;
        }
    };

    /*
     * Invokes a inspection if the signal emitted from specified session is an 'execute_input' msg.
     */       
    private _queryCall = ( sess: IClientSession, msg: KernelMessage.IMessage ) => {
        let msgType = msg.header.msg_type;
        switch ( msgType ) {
            case 'execute_input':
                let code = msg.content.code;
                if ( !( code == this._queryCommand ) ) {
                    this.performInspection();
                }
                break;
            default:
                break;
        }
    };


}

/**
 * A name space for inspection handler statics.
 */
export
namespace VariableInspectionHandler {
    /**
     * The instantiation options for an inspection handler.
     */
    export
        interface IOptions {
        connector: KernelConnector;
        queryCommand: string;
        initScript: string;
    }
}



