import {
    VariableInspectorPanel, IVariableInspector
} from "./variableinspector"



/**
 * A class that manages variable inspector widget instances and offers persistent
 * `IVariableInspector` instance that other plugins can communicate with.
 */
export
    class VariableInspectorManager implements IVariableInspector {

    private _source: IVariableInspector.IInspectable = null;
    private _panel: VariableInspectorPanel = null;

    /**
     * The current inspector panel.
     */
    get panel(): VariableInspectorPanel {
        return this._panel;
    }

    set panel( panel: VariableInspectorPanel ) {

        if ( this.panel === panel ) {
            return;
        }
        this._panel = panel;

        if ( panel && !panel.source ) {
            panel.source = this._source;
        }
    }
    
    /**
     * The source of events the inspector panel listens for.
     */
    get source(): IVariableInspector.IInspectable {
        return this._source;
    }

    set source( source: IVariableInspector.IInspectable ) {

        if ( this._source === source ) {
            return;
        }

        // remove subscriptions
        if ( this._source ) {
            this._source.disposed.disconnect( this._onSourceDisposed, this );
        }

        this._source = source;

        if ( this._panel && !this._panel.isDisposed ) {
            this._panel.source = this._source;
        }
        // Subscribe to new source
        if ( this._source ) {
            this._source.disposed.connect( this._onSourceDisposed, this );
        }
    }

    private _onSourceDisposed() {
        this._source = null;
    }

}