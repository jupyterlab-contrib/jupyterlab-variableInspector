import {
    IClientSession
} from "@jupyterlab/apputils";

import {
    DataConnector, nbformat
} from "@jupyterlab/coreutils";

import {
    KernelMessage, Kernel
} from "@jupyterlab/services";

import {
    ISignal, Signal
} from "@phosphor/signaling";


/**
 * Connector class that handles execute request to a kernel
 */ 
export
class KernelConnector extends DataConnector<KernelMessage.IExecuteReplyMsg, void, KernelMessage.IExecuteRequest>{
       
    private _session: IClientSession;
    /**
     *  Signal is emitted on 'execute_result' from the kernel
     */  
    private _queryResponse = new Signal<this, nbformat.IExecuteResult>( this );

    constructor( options: KernelConnector.IOptions ) {
        super();
        this._session = options.session;
    }

    /**
     *  A Promise that is fulfilled when the session associated w/ the connector is ready.
     */      
    get ready(): Promise<void>{ 
        return this._session.ready;
    }
    
    /**
     *  A signal emitted for iopub messages of the kernel associated with the kernel.
     */  
    get iopubMessage(): ISignal<IClientSession, KernelMessage.IMessage>{
        return this._session.iopubMessage;
    }
    
    /**
     * A signal emitted for 'execute_result' messages from the kernel.
     */
    get queryResponse(): ISignal<KernelConnector, nbformat.IExecuteResult> {
        return this._queryResponse;
    }

    /**
     * Executes the given request on the kernel associated with the connector.
     * @param request: IExecuteRequest to forward to the kernel.
     * @returns Promise<KernelMessage.IExecuteReplyMsg>
     */
    fetch( request: KernelMessage.IExecuteRequest ): Promise<KernelMessage.IExecuteReplyMsg> {

        const kernel = this._session.kernel;

        if ( !kernel ) {
            return Promise.reject( new Error( "Require kernel to perform variable inspection!" ) );
        }

        return kernel.ready.then(() => {
            let future: Kernel.IFuture = kernel.requestExecute( request );
            future.onIOPub = ( ( msg: KernelMessage.IIOPubMessage ) => {
                let msgType = msg.header.msg_type;
                switch ( msgType ) {
                    case "execute_result":
                        this._queryResponse.emit( msg.content as nbformat.IExecuteResult );
                        break;

                    default:
                        break;
                }
            } );
            return future.done as Promise<KernelMessage.IExecuteReplyMsg>;
        } );
    }

}

export
namespace KernelConnector {
    export
        interface IOptions {
        session: IClientSession;

    }
}