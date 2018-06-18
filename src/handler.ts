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


/**
 * An object that handles code inspection.
 */
export
    class VariableInspectionHandler implements IDisposable, IVariableInspector.IInspectable {

    private _connector: KernelConnector;
    private _queryCommand: string;
    private _initScript: string;
    private _disposed = new Signal<this, void>( this );
    private _inspected = new Signal<this, IVariableInspector.IVariableInspectorUpdate>( this );
    private _isDisposed = false;
    private _ready : Promise<void>;
    

    constructor( options: VariableInspectionHandler.IOptions ) {
        this._connector = options.connector;
        this._queryCommand = options.queryCommand;
        this._initScript = options.initScript;
        this._ready =  this._connector.ready.then(() => {
            this._initOnKernel().then(( msg:KernelMessage.IExecuteReplyMsg ) => {
            this._connector.iopubMessage.connect( this._queryCall );
            this._connector.queryResponse.connect( this._handleQueryResponse );
            return;
    
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
    
    get ready():Promise<void>{
        return this._ready;
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
        this._connector.fetch( request );
    }

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
    private _handleQueryResponse = ( sender: KernelConnector, response: nbformat.IExecuteResult ) => {
        let content: string = <string>response.data["text/plain"];
        content = content.replace( /^'|'$/g, '' ).replace(/\\"/g,"\"").replace(/\\'/g,"\'");

        let update: IVariableInspector.IVariableInspectorUpdate;
        update = <IVariableInspector.IVariableInspectorUpdate>JSON.parse( content );

        this._inspected.emit( update );

    }

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
 * A namespace for inspection handler statics.
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