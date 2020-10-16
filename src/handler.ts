import {
    IRenderMimeRegistry
} from '@jupyterlab/rendermime';

import {
    IDisposable
} from '@lumino/disposable';

import {
    IVariableInspector
} from './variableinspector';

import {
    KernelConnector
} from "./kernelconnector";

import {
    ISessionContext
} from "@jupyterlab/apputils";

import {
    KernelMessage, Kernel
} from "@jupyterlab/services";

import {
    Signal, ISignal
} from "@lumino/signaling"

import {
   IExecuteResult
} from "@jupyterlab/nbformat"

import {
    JSONModel, DataModel
} from "@lumino/datagrid";

/**
 * An object that handles code inspection.
 */
export
    class VariableInspectionHandler implements IDisposable, IVariableInspector.IInspectable {

    private _connector: KernelConnector;
    private _rendermime: IRenderMimeRegistry;
    private _initScript: string;
    private _queryCommand: string;
    private _matrixQueryCommand: string;
    private _widgetQueryCommand: string;
    private _deleteCommand: string;
    private _disposed = new Signal<this, void>( this );
    private _inspected = new Signal<this, IVariableInspector.IVariableInspectorUpdate>( this );
    private _isDisposed = false;
    private _ready : Promise<void>;
    private _id : string;
    

    constructor( options: VariableInspectionHandler.IOptions ) {
        this._id = options.id;
        this._connector = options.connector;
        this._rendermime = options.rendermime;
        this._queryCommand = options.queryCommand;
        this._matrixQueryCommand = options.matrixQueryCommand;
        this._widgetQueryCommand = options.widgetQueryCommand;
        this._deleteCommand = options.deleteCommand;
        this._initScript = options.initScript;
        
        this._ready =  this._connector.ready.then(() => {
            this._initOnKernel().then(( msg:KernelMessage.IExecuteReplyMsg ) => {
                this._connector.iopubMessage.connect( this._queryCall );
                return;

            } );
        } );
        
        this._connector.kernelRestarted.connect(( sender, kernelReady: Promise<void> ) => {
            
            const title: IVariableInspector.IVariableTitle = {
                    contextName: "<b>Restarting kernel...</b> "
            };
            this._inspected.emit( <IVariableInspector.IVariableInspectorUpdate>{title : title, payload : []});          

            this._ready = kernelReady.then(() => {
                this._initOnKernel().then(( msg: KernelMessage.IExecuteReplyMsg ) => {
                    this._connector.iopubMessage.connect( this._queryCall );
                    this.performInspection();
                } );         
            } );
        } );

    }

    get id():string{
        return this._id;
    }

    get rendermime() {
        return this._rendermime;
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
        let content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._queryCommand,
            stop_on_error: false,
            store_history: false
        };
        this._connector.fetch( content, this._handleQueryResponse );
    }

    /**
     * Performs an inspection of a Jupyter Widget
     */
    public performWidgetInspection(varName: string) {
        const request: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._widgetQueryCommand + "(" + varName + ")",
            stop_on_error: false,
            store_history: false
        };
        return this._connector.execute(request);
    }

    /**
     * Performs an inspection of the specified matrix.
     */
    public performMatrixInspection( varName: string, maxRows=100000 ): Promise<DataModel> {
        let request: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._matrixQueryCommand + "(" + varName + ", " + maxRows + ")",
            stop_on_error: false,
            store_history: false
        };
        let con = this._connector;
        return new Promise( function( resolve, reject ) {
            con.fetch( request,
                ( response: KernelMessage.IIOPubMessage ) => {
                    let msgType = response.header.msg_type;
                    switch ( msgType ) {
                        case "execute_result":
                            let payload = response.content as IExecuteResult;
                            let content: string = <string>payload.data["text/plain"];
                            let content_clean = content.replace(/^'|'$/g, "");
                            content_clean = content_clean.replace(/\\"/g, '"');
                            content_clean = content_clean.replace(/\\'/g, "\\\\'");

                            let modelOptions = <JSONModel.IOptions>JSON.parse(content_clean);
                            let jsonModel = new JSONModel( modelOptions );
                            resolve( jsonModel );
                            break;
                        case "error":
                            console.log(response);
                            reject( "Kernel error on 'matrixQuery' call!" );
                            break;
                        default:
                            break;
                    }
                }
            );
        } );
    }

    /**
     * Send a kernel request to delete a variable from the global environment
     */
    public performDelete(varName: string): void {
      let content: KernelMessage.IExecuteRequestMsg['content'] = {
        code: this._deleteCommand + "('" + varName + "')",
        stop_on_error: false,
        store_history: false,
    };
    
    this._connector.fetch( content, this._handleQueryResponse );
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
     */
    private _initOnKernel(): Promise<KernelMessage.IExecuteReplyMsg> {
        let content: KernelMessage.IExecuteRequestMsg['content'] = {
            code: this._initScript,
            stop_on_error: false,
            silent: true,
        };

        return this._connector.fetch( content, ( () => { } ) );
    }
    
    /*
     * Handle query response. Emit new signal containing the IVariableInspector.IInspectorUpdate object.
     * (TODO: query resp. could be forwarded to panel directly)
     */
    private _handleQueryResponse = ( response: KernelMessage.IIOPubMessage ): void => {
        let msgType = response.header.msg_type;
        switch ( msgType ) {
            case "execute_result":
                let payload = response.content as IExecuteResult;
                let content: string = <string>payload.data["text/plain"];
                if (content.slice(0, 1) == "'" || content.slice(0, 1) == "\""){
                    content = content.slice(1,-1);
                    content = content.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
                }

                let update: IVariableInspector.IVariable[];
                update = <IVariableInspector.IVariable[]>JSON.parse( content );

                let title: IVariableInspector.IVariableTitle;
                title = {
                    contextName: "",
                    kernelName : this._connector.kernelName || ""
                };

                this._inspected.emit( {title: title, payload: update} );
                break;
            case "display_data":
                let payload_display = response.content as IExecuteResult;
                let content_display: string = <string>payload_display.data["text/plain"];
                if (content_display.slice(0, 1) == "'" || content_display.slice(0, 1) == "\""){
                    content_display = content_display.slice(1,-1);
                    content_display = content_display.replace( /\\"/g, "\"" ).replace( /\\'/g, "\'" );
                }

                let update_display: IVariableInspector.IVariable[];
                update_display = <IVariableInspector.IVariable[]>JSON.parse( content_display );

                let title_display: IVariableInspector.IVariableTitle;
                title_display = {
                    contextName: "",
                    kernelName : this._connector.kernelName || ""
                };

                this._inspected.emit( {title: title_display, payload: update_display} );
                break;
            default:
                break;
        }
    };

    /*
     * Invokes a inspection if the signal emitted from specified session is an 'execute_input' msg.
     */
    private _queryCall = ( sess: ISessionContext, msg: KernelMessage.IExecuteInputMsg ) => {
        let msgType = msg.header.msg_type;
        switch ( msgType ) {
            case 'execute_input':
                let code = msg.content.code;
                if ( !( code == this._queryCommand ) && !( code == this._matrixQueryCommand ) && !(this._widgetQueryCommand.length > 0 && code.startsWith(this._widgetQueryCommand) ) ) {
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
        rendermime?: IRenderMimeRegistry;
        queryCommand: string;
        matrixQueryCommand: string;
        widgetQueryCommand: string;
        deleteCommand: string;
        initScript: string;
        id : string;
    }
}

export
    class DummyHandler implements IDisposable, IVariableInspector.IInspectable{
        private _isDisposed = false;
        private _disposed = new Signal<this,void>( this );
        private _inspected = new Signal<this, IVariableInspector.IVariableInspectorUpdate>( this );
        private _connector : KernelConnector;
        private _rendermime : IRenderMimeRegistry = null;
        
        constructor(connector : KernelConnector) {
            this._connector = connector;
        }
                
        get disposed() : ISignal<DummyHandler, void>{
            return this._disposed;
        }
       
        get isDisposed() : boolean {
            return this._isDisposed;
        }
       
        get inspected() : ISignal<DummyHandler, IVariableInspector.IVariableInspectorUpdate>{
            return this._inspected;
        }

        get rendermime(): IRenderMimeRegistry {
            return this._rendermime;
        }
       
        dispose(): void {
            if ( this.isDisposed ) {
                return;
            }
            this._isDisposed = true;
            this._disposed.emit( void 0 );
            Signal.clearData( this );
        }
       
        public performInspection(): void{
            let title: IVariableInspector.IVariableTitle;
            title = {
                contextName: ". <b>Language currently not supported.</b> ",
                kernelName : this._connector.kernelName || ""
            };
            this._inspected.emit( <IVariableInspector.IVariableInspectorUpdate>{title : title, payload : []});
        }
        
        public performMatrixInspection(varName : string, maxRows : number): Promise<DataModel>{
            return new Promise(function(resolve, reject) { reject("Cannot inspect matrices w/ the DummyHandler!") });
        }

        public performWidgetInspection( varName: string ): Kernel.IShellFuture<KernelMessage.IExecuteRequestMsg, KernelMessage.IExecuteReplyMsg> {
            const request: KernelMessage.IExecuteRequestMsg['content'] = {
                code: "",
                stop_on_error: false,
                store_history: false
            };
            return this._connector.execute(request);
        }

        public performDelete(varName: string){}
}
