# jupyterlab_variableinspector



Jupyterlab extension that shows currently used variables and their values. The goal is to provide a tool similar to the variable inspector in RStudio.

This project is inspired by the [variable inspector extension for jupyter notebooks](https://github.com/ipython-contrib/jupyter_contrib_nbextensions/tree/master/src/jupyter_contrib_nbextensions/nbextensions/varInspector) and by the [inspector extension included in juypterlab](https://github.com/jupyterlab/jupyterlab/tree/master/packages/inspector-extension).

For the time being, this project is still in its first steps. Contributions in any form are very welcome!

## Features
![Demogif](early_demo.gif)
- Allows inspection of variables for both python consoles and python notebooks
- Allows inspection of matrices in a datagrid-viewer. This might not work for large matrices.

## Prerequisites

* JupyterLab [0.35] 

## Installation
In this early stage you can install this extension by building it from source.  

First of all, you need an installation of a current version of JupyterLab. Please refer to the [installation guide](https://github.com/jupyterlab/jupyterlab#installation).


Next, clone this repository with `git clone https://github.com/lckr/jupyterlab-variableInspector`

Once you downloaded the repository use the following steps:
```
cd jupyterlab-variableInspector
npm install
npm run build 
jupyter labextension install . 
``` 

Afterwards confirm the installation of the extension with:
```
jupyter labextension list
```
which should print `enabled` and `OK`.



