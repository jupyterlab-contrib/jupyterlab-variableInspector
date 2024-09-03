import { ICommandPalette, WidgetTracker } from '@jupyterlab/apputils';

import {
  ILabShell,
  ILayoutRestorer,
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IConsoleTracker } from '@jupyterlab/console';

import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { listIcon } from '@jupyterlab/ui-components';

import { DummyHandler, VariableInspectionHandler } from './handler';

import { Languages } from './inspectorscripts';

import { KernelConnector } from './kernelconnector';

import { VariableInspectorManager } from './manager';

import { VariableInspectorPanel } from './variableinspector';

import { IVariableInspector, IVariableInspectorManager } from './tokens';
import { addJupyterLabThemeChangeListener } from '@jupyter/web-components';
addJupyterLabThemeChangeListener();
namespace CommandIDs {
  export const open = 'variableinspector:open';
}

const SETTINGS_ID =
  '@lckr/jupyterlab_variableinspector:jupyterlab-variableInspector-settings';

/**
 * A service providing variable introspection.
 */
const variableinspector: JupyterFrontEndPlugin<IVariableInspectorManager> = {
  id: '@lckr/jupyterlab_variableinspector',
  requires: [ICommandPalette, ILayoutRestorer, ILabShell],
  provides: IVariableInspectorManager,
  autoStart: true,
  activate: (
    app: JupyterFrontEnd,
    palette: ICommandPalette,
    restorer: ILayoutRestorer,
    labShell: ILabShell
  ): IVariableInspectorManager => {
    const manager = new VariableInspectorManager();
    const category = 'Variable Inspector';
    const command = CommandIDs.open;
    const label = 'Open Variable Inspector';
    const namespace = 'variableinspector';
    const tracker = new WidgetTracker<VariableInspectorPanel>({ namespace });

    /**
     * Create and track a new inspector.
     */
    function newPanel(): VariableInspectorPanel {
      const panel = new VariableInspectorPanel();

      panel.id = 'jp-variableinspector';
      panel.title.label = 'Variable Inspector';
      panel.title.icon = listIcon;
      panel.title.closable = true;
      panel.disposed.connect(() => {
        if (manager.panel === panel) {
          manager.panel = null;
        }
      });

      //Track the inspector panel
      tracker.add(panel);

      return panel;
    }

    // Enable state restoration
    restorer.restore(tracker, {
      command,
      args: () => ({}),
      name: () => 'variableinspector'
    });

    // Add command to palette
    app.commands.addCommand(command, {
      label,
      execute: () => {
        if (!manager.panel || manager.panel.isDisposed) {
          manager.panel = newPanel();
        }
        if (!manager.panel.isAttached) {
          labShell.add(manager.panel, 'main');
        }
        if (manager.source) {
          manager.source.performInspection();
        }
        labShell.activateById(manager.panel.id);
      }
    });
    palette.addItem({ command, category });

    console.log(
      'JupyterLab extension @lckr/jupyterlab_variableinspector is activated!'
    );
    return manager;
  }
};

/**
 * An extension that registers consoles for variable inspection.
 */
const consoles: JupyterFrontEndPlugin<void> = {
  id: '@lckr/jupyterlab-variableinspector:consoles',
  requires: [
    IVariableInspectorManager,
    IConsoleTracker,
    ILabShell,
    ISettingRegistry
  ],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    manager: IVariableInspectorManager,
    consoles: IConsoleTracker,
    labShell: ILabShell,
    settings: ISettingRegistry
  ): Promise<void> => {
    const handlers: {
      [id: string]: Promise<IVariableInspector.IInspectable>;
    } = {};
    const setting = await settings.load(SETTINGS_ID);

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
          const scripts: Promise<Languages.LanguageModel> =
            connector.ready.then(() => {
              return connector.kernelLanguage.then(lang => {
                return Languages.getScript(lang);
              });
            });

          scripts.then((result: Languages.LanguageModel) => {
            const initScript = result.initScript;
            const queryCommand = result.queryCommand;
            const matrixQueryCommand = result.matrixQueryCommand;
            const widgetQueryCommand = result.widgetQueryCommand;
            const deleteCommand = result.deleteCommand;
            const changeSettingsCommand = result.changeSettingsCommand;

            const options: VariableInspectionHandler.IOptions = {
              queryCommand,
              matrixQueryCommand,
              widgetQueryCommand,
              deleteCommand,
              connector,
              initScript,
              changeSettingsCommand,
              id: session.path, //Using the sessions path as an identifier for now.
              setting
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

      setSource(labShell);
    });

    const setSource = (sender: ILabShell, args?: ILabShell.IChangedArgs) => {
      const widget = args?.newValue ?? sender.currentWidget;
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
    };
    /**
     * If focus window changes, checks whether new focus widget is a console.
     * In that case, retrieves the handler associated to the console after it has been
     * initialized and updates the manager with it.
     */
    setSource(labShell);
    labShell.currentChanged.connect(setSource);

    app.contextMenu.addItem({
      command: CommandIDs.open,
      selector: '.jp-CodeConsole'
    });
  }
};

/**
 * An extension that registers notebooks for variable inspection.
 */
const notebooks: JupyterFrontEndPlugin<void> = {
  id: '@lckr/jupyterlab-variableinspector:notebooks',
  requires: [
    IVariableInspectorManager,
    INotebookTracker,
    ILabShell,
    ISettingRegistry
  ],
  autoStart: true,
  activate: async (
    app: JupyterFrontEnd,
    manager: IVariableInspectorManager,
    notebooks: INotebookTracker,
    labShell: ILabShell,
    settings: ISettingRegistry
  ): Promise<void> => {
    const handlers: { [id: string]: Promise<VariableInspectionHandler> } = {};
    const setting = await settings.load(SETTINGS_ID);

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
          async () => {
            const lang = await connector.kernelLanguage;
            return Languages.getScript(lang);
          }
        );

        scripts.then((result: Languages.LanguageModel) => {
          const initScript = result.initScript;
          const queryCommand = result.queryCommand;
          const matrixQueryCommand = result.matrixQueryCommand;
          const widgetQueryCommand = result.widgetQueryCommand;
          const deleteCommand = result.deleteCommand;
          const changeSettingsCommand = result.changeSettingsCommand;

          const options: VariableInspectionHandler.IOptions = {
            queryCommand,
            matrixQueryCommand,
            widgetQueryCommand,
            deleteCommand,
            connector,
            rendermime,
            initScript,
            changeSettingsCommand,
            id: session.path, //Using the sessions path as an identifier for now.
            setting
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

      setSource(labShell);
    });

    const setSource = (sender: ILabShell, args?: ILabShell.IChangedArgs) => {
      const widget = args?.newValue ?? sender.currentWidget;
      if (!widget || !notebooks.has(widget) || widget.isDisposed) {
        return;
      }
      const future = handlers[widget.id];
      future?.then((source: VariableInspectionHandler) => {
        if (source) {
          manager.source = source;
          manager.source.performInspection();
        }
      });
    };
    /**
     * If focus window changes, checks whether new focus widget is a notebook.
     * In that case, retrieves the handler associated to the notebook after it has been
     * initialized and updates the manager with it.
     */
    setSource(labShell);
    labShell.currentChanged.connect(setSource);

    app.contextMenu.addItem({
      command: CommandIDs.open,
      selector: '.jp-Notebook'
    });
  }
};

/**
 * Export the plugins as default.
 */
const plugins: JupyterFrontEndPlugin<any>[] = [
  variableinspector,
  consoles,
  notebooks
];
export default plugins;
