import {
    IVariableInspector, VariableInspectorPanel
} from "./variableinspector";

import {
    KernelConnector
} from "./kernelconnector";

import {
    VariableInspectionHandler, DummyHandler
} from "./handler";

import {
    VariableInspectorManager
} from "./manager";

import {
    Languages
} from "./inspectorscripts";

import {
    ICommandPalette, InstanceTracker
} from '@jupyterlab/apputils';

import {
    ILayoutRestorer, JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application'

import {
    IConsoleTracker
} from '@jupyterlab/console';

import {
    INotebookTracker, NotebookPanel
} from '@jupyterlab/notebook';




namespace CommandIDs {
    export
        const open = "variableinspector:open";
}

/**
 * A service providing variable introspection.
 */
const variableinspector: JupyterLabPlugin<IVariableInspector> = {
    id: "jupyterlab-extension:variableinspector",
    requires: [ICommandPalette, ILayoutRestorer],
    provides: IVariableInspector,
    autoStart: true,
    activate: ( app: JupyterLab, palette: ICommandPalette, restorer: ILayoutRestorer ): IVariableInspector => {


        const manager = new VariableInspectorManager();
        const category = "Variable Inspector";
        const command = CommandIDs.open;
        const label = "Open Variable Inspector";
        const namespace = "variableinspector";
        const tracker = new InstanceTracker<VariableInspectorPanel>( { namespace } );


        /**
         * Create and track a new inspector.
         */
        function newPanel(): VariableInspectorPanel {
           const panel = new VariableInspectorPanel();
        
            panel.id = "jp-variableinspector";
            panel.title.label = "Variable Inspector";
            panel.title.closable = true;
            panel.disposed.connect(() => {
                if ( manager.panel === panel ) {
                    manager.panel = null;
                }
            } );

            //Track the inspector panel
            tracker.add( panel );
            return panel;
        }

        // Enable state restoration
        restorer.restore( tracker, {
            command,
            args: () => null,
            name: () => "variableinspector"
        } );

        // Add command to palette
        app.commands.addCommand( command, {
            label,
            execute: () => {
                if ( !manager.panel || manager.panel.isDisposed ) {
                    manager.panel = newPanel();
                }
                if ( !manager.panel.isAttached ) {
                    app.shell.addToMainArea( manager.panel, {mode: "split-right"} );
                }
                if ( manager.source ) {
                    manager.source.performInspection();
                }
                app.shell.activateById( manager.panel.id );
            }
        } );
        palette.addItem( { command, category } );
        return manager;
    }
}

/**
 * An extension that registers consoles for variable inspection.
 */
const consoles: JupyterLabPlugin<void> = {
    id: "jupyterlab-extension:variableinspector:consoles",
    requires: [IVariableInspector, IConsoleTracker],
    autoStart: true,
    activate: ( app: JupyterLab, manager: IVariableInspector, consoles: IConsoleTracker ): void => {
        const handlers: { [id: string]: Promise<IVariableInspector.IInspectable> } = {};
        
        /**
         * Subscribes to the creation of new consoles. If a new notebook is created, build a new handler for the consoles.
         * Adds a promise for a instanced handler to the 'handlers' collection.
         */
        consoles.widgetAdded.connect(( sender, consolePanel ) => {
            
            handlers[consolePanel.id] = new Promise( function( resolve, reject ) {
                const session = consolePanel.session;
                const connector = new KernelConnector( { session: session } );

                
                connector.ready.then(() => { // Create connector and init w script if it exists for kernel type.
                    let kerneltype: string = connector.kerneltype;
                    let scripts: Promise<Languages.LanguageModel> = Languages.getScript( kerneltype );
                
                    scripts.then(( result: Languages.LanguageModel ) => {
                        let initScript = result.initScript;
                        let queryCommand = result.queryCommand;
                        let matrixQueryCommand = result.matrixQueryCommand;

                        const options: VariableInspectionHandler.IOptions = {
                            queryCommand: queryCommand,
                            matrixQueryCommand: matrixQueryCommand,
                            connector: connector,
                            initScript: initScript
                        };
                        const handler = new VariableInspectionHandler( options );

                        consolePanel.disposed.connect(() => {
                            delete handlers[consolePanel.id];
                            handler.dispose();
                        } );

                        handler.ready.then(() => {
                            resolve( handler );
                        } );
                    } );


                    //Otherwise log error message.
                    scripts.catch(( result: string ) => {
                        console.log(result);
                        const handler = new DummyHandler(connector);
                        consolePanel.disposed.connect(() => {
                            delete handlers[consolePanel.id];
                            handler.dispose();
                        } );
                        resolve( handler );
                    } )
                } );
            } );
        } );

        /**
         * If focus window changes, checks whether new focus widget is a console.
         * In that case, retrieves the handler associated to the console after it has been
         * initialized and updates the manager with it. 
         */
        app.shell.currentChanged.connect(( sender, args ) => {
            let widget = args.newValue;
            if ( !widget || !consoles.has( widget ) ) {
                return;
            }
            let future = handlers[widget.id];
            future.then((source :IVariableInspector.IInspectable ) => {
                if ( source ) {
                    manager.source = source;
                    manager.source.performInspection();
                }
            });
        } );;

        app.contextMenu.addItem( {
            command: CommandIDs.open,
            selector: ".jp-CodeConsole"
        } );



    }
}

/**
 * An extension that registers notebooks for variable inspection.
 */
const notebooks: JupyterLabPlugin<void> = {
    id: "jupyterlab-extension:variableinspector:notebooks",
    requires: [IVariableInspector, INotebookTracker],
    autoStart: true,
    activate: ( app: JupyterLab, manager: IVariableInspector, notebooks: INotebookTracker ): void => {
        const handlers: { [id: string]: Promise<VariableInspectionHandler> } = {};

        /**
         * Subscribes to the creation of new notebooks. If a new notebook is created, build a new handler for the notebook.
         * Adds a promise for a instanced handler to the 'handlers' collection.
         */
        notebooks.widgetAdded.connect(( sender, nbPanel: NotebookPanel ) => {

            //A promise that resolves after the initialization of the handler is done.
            handlers[nbPanel.id] = new Promise( function( resolve, reject ) {

                const session = nbPanel.session;
                const connector = new KernelConnector( { session: session } );
                
                connector.ready.then(() => { // Create connector and init w script if it exists for kernel type.
                    let kerneltype: string = connector.kerneltype;
                    let scripts: Promise<Languages.LanguageModel> = Languages.getScript( kerneltype );
                
                    scripts.then(( result: Languages.LanguageModel ) => {
                        let initScript = result.initScript;
                        let queryCommand = result.queryCommand;
                        let matrixQueryCommand = result.matrixQueryCommand;

                        const options: VariableInspectionHandler.IOptions = {
                            queryCommand: queryCommand,
                            matrixQueryCommand: matrixQueryCommand,
                            connector: connector,
                            initScript: initScript
                        };
                        const handler = new VariableInspectionHandler( options );

                        nbPanel.disposed.connect(() => {
                            delete handlers[nbPanel.id];
                            handler.dispose();
                        } );

                        handler.ready.then(() => {
                            resolve( handler );
                        } );
                    } );


                    //Otherwise log error message.
                    scripts.catch(( result: string ) => {
                        reject( result );
                    } )
                } );
            } );
        } );

        /**
         * If focus window changes, checks whether new focus widget is a notebook.
         * In that case, retrieves the handler associated to the notebook after it has been
         * initialized and updates the manager with it. 
         */
        app.shell.currentChanged.connect(( sender, args ) => {
            let widget = args.newValue;
            if ( !widget || !notebooks.has( widget ) ) {
                return;
            }
            let future = handlers[widget.id];
            future.then((source :VariableInspectionHandler ) => {
                if ( source ) {
                    manager.source = source;
                    manager.source.performInspection();
                }
            });
        } );

        app.contextMenu.addItem( {
            command: CommandIDs.open,
            selector: ".jp-Notebook"
        } );
    }
}


/**
 * Export the plugins as default.
 */
const plugins: JupyterLabPlugin<any>[] = [variableinspector, consoles, notebooks];
export default plugins;
