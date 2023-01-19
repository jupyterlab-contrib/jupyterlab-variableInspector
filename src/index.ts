import {
  IVariableInspector,
  VariableInspectorPanel,
} from './variableinspector';

import { KernelConnector } from './kernelconnector';

import { VariableInspectionHandler, DummyHandler } from './handler';

import { VariableInspectorManager, IVariableInspectorManager } from './manager';

import { Languages } from './inspectorscripts';

import { WidgetTracker } from '@jupyterlab/apputils';

import {
  ILabShell,
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
} from '@jupyterlab/application';

import { IConsoleTracker } from '@jupyterlab/console';

import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { listIcon } from '@jupyterlab/ui-components';

/**
 * A service providing variable introspection.
 */
const variableinspector: JupyterFrontEndPlugin<IVariableInspectorManager> = {
  id: '@lckr/jupyterlab_variableinspector',
  provides: IVariableInspectorManager,
  autoStart: true,
  activate: (app: JupyterFrontEnd): IVariableInspectorManager => {
    const manager = new VariableInspectorManager();
    const namespace = 'variableinspector';
    const tracker = new WidgetTracker<VariableInspectorPanel>({ namespace });

    /**
     * Create and track a new inspector.
     */
    function newPanel(): VariableInspectorPanel {
      const panel = new VariableInspectorPanel();

      panel.id = 'jp-variableinspector';
      panel.title.icon = listIcon;
      panel.title.closable = true;
      panel.disposed.connect(() => {
        if (manager.panel === panel) {
          manager.panel = null;
        }
      });

      // Track the inspector panel
      tracker.add(panel);

      return panel;
    }

    manager.panel = newPanel();
    if (manager.source) {
      manager.source.performInspection();
    }
    app.shell.add(manager.panel, 'right');

    console.log(
      'JupyterLab extension @lckr/jupyterlab_variableinspector is activated!'
    );
    return manager;
  },
};

/**
 * An extension that registers consoles for variable inspection.
 */
const consoles: JupyterFrontEndPlugin<void> = {
  id: '@lckr/jupyterlab-variableinspector:consoles',
  requires: [IVariableInspectorManager, IConsoleTracker, ILabShell],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    manager: IVariableInspectorManager,
    consoles: IConsoleTracker,
    labShell: ILabShell
  ): void => {
    const handlers: {
      [id: string]: Promise<IVariableInspector.IInspectable>;
    } = {};

    /**
     * Subscribes to the creation of new consoles. If a new notebook is created, build a new handler for the consoles.
     * Adds a promise for a instanced handler to the 'handlers' collection.
     */
    consoles.widgetAdded.connect((sender, consolePanel) => {
      if (manager.hasHandler(consolePanel.sessionContext.path)) {
        handlers[consolePanel.id] = new Promise((resolve, reject) => {
          resolve(manager.getHandler(consolePanel.sessionContext.path));
        });
      } else {
        handlers[consolePanel.id] = new Promise((resolve, reject) => {
          const session = consolePanel.sessionContext;

          // Create connector and init w script if it exists for kernel type.
          const connector = new KernelConnector({ session });
          const scripts: Promise<Languages.LanguageModel> = connector.ready.then(
            () => {
              return connector.kernelLanguage.then((lang) => {
                return Languages.getScript(lang);
              });
            }
          );

          scripts.then((result: Languages.LanguageModel) => {
            const initScript = result.initScript;
            const queryCommand = result.queryCommand;
            const matrixQueryCommand = result.matrixQueryCommand;
            const widgetQueryCommand = result.widgetQueryCommand;
            const deleteCommand = result.deleteCommand;

            const options: VariableInspectionHandler.IOptions = {
              queryCommand: queryCommand,
              matrixQueryCommand: matrixQueryCommand,
              widgetQueryCommand,
              deleteCommand: deleteCommand,
              connector: connector,
              initScript: initScript,
              id: session.path, //Using the sessions path as an identifier for now.
            };
            const handler = new VariableInspectionHandler(options);
            manager.addHandler(handler);
            consolePanel.disposed.connect(() => {
              delete handlers[consolePanel.id];
              handler.dispose();
            });

            handler.ready.then(() => {
              resolve(handler);
            });
          });

          //Otherwise log error message.
          scripts.catch((result: string) => {
            console.log(result);
            const handler = new DummyHandler(connector);
            consolePanel.disposed.connect(() => {
              delete handlers[consolePanel.id];
              handler.dispose();
            });

            resolve(handler);
          });
        });
      }
    });

    /**
     * If focus window changes, checks whether new focus widget is a console.
     * In that case, retrieves the handler associated to the console after it has been
     * initialized and updates the manager with it.
     */
    labShell.currentChanged.connect((sender, args) => {
      const widget = args.newValue;
      if (!widget || !consoles.has(widget)) {
        return;
      }
      const future = handlers[widget.id];
      future.then((source: IVariableInspector.IInspectable) => {
        if (source) {
          manager.source = source;
          manager.source.performInspection();
        }
      });
    });
  },
};

/**
 * An extension that registers notebooks for variable inspection.
 */
const notebooks: JupyterFrontEndPlugin<void> = {
  id: '@lckr/jupyterlab-variableinspector:notebooks',
  requires: [IVariableInspectorManager, INotebookTracker, ILabShell],
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    manager: IVariableInspectorManager,
    notebooks: INotebookTracker,
    labShell: ILabShell
  ): void => {
    const handlers: { [id: string]: Promise<VariableInspectionHandler> } = {};

    /**
     * Subscribes to the creation of new notebooks. If a new notebook is created, build a new handler for the notebook.
     * Adds a promise for a instanced handler to the 'handlers' collection.
     */
    notebooks.widgetAdded.connect((sender, nbPanel: NotebookPanel) => {
      //A promise that resolves after the initialization of the handler is done.
      handlers[nbPanel.id] = new Promise((resolve, reject) => {
        const session = nbPanel.sessionContext;
        const connector = new KernelConnector({ session });
        const rendermime = nbPanel.content.rendermime;

        const scripts: Promise<Languages.LanguageModel> = connector.ready.then(
          () => {
            return connector.kernelLanguage.then((lang) => {
              return Languages.getScript(lang);
            });
          }
        );

        scripts.then((result: Languages.LanguageModel) => {
          const initScript = result.initScript;
          const queryCommand = result.queryCommand;
          const matrixQueryCommand = result.matrixQueryCommand;
          const widgetQueryCommand = result.widgetQueryCommand;
          const deleteCommand = result.deleteCommand;

          const options: VariableInspectionHandler.IOptions = {
            queryCommand: queryCommand,
            matrixQueryCommand: matrixQueryCommand,
            widgetQueryCommand,
            deleteCommand: deleteCommand,
            connector: connector,
            rendermime,
            initScript: initScript,
            id: session.path, //Using the sessions path as an identifier for now.
          };
          const handler = new VariableInspectionHandler(options);
          manager.addHandler(handler);
          nbPanel.disposed.connect(() => {
            delete handlers[nbPanel.id];
            handler.dispose();
          });

          handler.ready.then(() => {
            resolve(handler);
          });
        });

        //Otherwise log error message.
        scripts.catch((result: string) => {
          reject(result);
        });
      });
    });

    /**
     * If focus window changes, checks whether new focus widget is a notebook.
     * In that case, retrieves the handler associated to the notebook after it has been
     * initialized and updates the manager with it.
     */
    labShell.currentChanged.connect((sender, args) => {
      const widget = args.newValue;
      if (!widget || !notebooks.has(widget)) {
        return;
      }
      const future = handlers[widget.id];
      future.then((source: VariableInspectionHandler) => {
        if (source) {
          manager.source = source;
          manager.source.performInspection();
        }
      });
    });
  },
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  variableinspector,
  consoles,
  notebooks,
];
export default plugins;
