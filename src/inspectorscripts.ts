export
namespace Languages{
    export
    type LanguageModel = {
            initScript : string;
            queryCommand : string;
    }
}


export
abstract class Languages{
    /**
     * Init and query script for supported languages.
     */
    static py_script: string = `import json
from sys import getsizeof

from IPython import get_ipython
from IPython.core.magics.namespace import NamespaceMagics

_nms = NamespaceMagics()
_Jupyter = get_ipython()
_nms.shell = _Jupyter.kernel.shell

try:
    import numpy as np  # noqa: F401
except ImportError:
    np = None

try:
    import pandas as pd
except ImportError:
    pd = None


def _getsizeof(x):
    # return the size of variable x. Amended version of sys.getsizeof
    # which also supports ndarray, Series and DataFrame
    if type(x).__name__ in ['ndarray', 'Series']:
        return x.nbytes
    elif type(x).__name__ == 'DataFrame':
        return x.memory_usage().sum()
    else:
        return getsizeof(x)


def _getshapeof(x):
    # returns content in a friendly way for python variables
    # pandas and numpy
    if pd and isinstance(x, pd.DataFrame):
        return "DataFrame [%d rows x %d cols]" % x.shape
    if pd and isinstance(x, pd.Series):
        return "Series [%d rows]" % x.shape
    if np and isinstance(x, np.ndarray):
        shape = " x ".join([str(i) for i in x.shape])
        return "Array [%s]" %  shape
    return None


def _getcontentof(x):
    # returns content in a friendly way for python variables
    # pandas and numpy
    if pd and isinstance(x, pd.DataFrame):
        colnames = ', '.join(list(x.columns))
        return "Column names: %s" % colnames
    if pd and isinstance(x, pd.Series):
        return "Series [%d rows]" % x.shape
    if np and isinstance(x, np.ndarray):
        return x.__repr__()
    return str(x)[:200]


def _var_dic_list():
    types_to_exclude = ['module', 'function', 'builtin_function_or_method','instance', '_Feature', 'type', 'ufunc']
    values = _nms.who_ls()
    vardic = [{'varName': v, 
               'varType': type(eval(v)).__name__, 
               'varSize': str(_getsizeof(eval(v))), 
               'varShape': str(_getshapeof(eval(v))) if _getshapeof(eval(v)) else '', 
               'varContent': str(_getcontentof(eval(v)))}  # noqa
        for v in values if ((str(eval(v))[0] != "<") or (isinstance(eval(v), str)))] #Prevent showing classes, modules etc.
    return json.dumps(vardic)
`;
    static scripts: { [index: string]: Languages.LanguageModel } = {
           "python3" : { initScript : Languages.py_script,
    queryCommand : "_var_dic_list()"},
"python2" : { initScript : Languages.py_script,
    queryCommand : "_var_dic_list()"},
"python" : { initScript : Languages.py_script,
    queryCommand : "_var_dic_list()"}
                };
   
    public static getScript(lang:string):Promise<Languages.LanguageModel>{
        return new Promise(function(resolve, reject) {
            if (lang.startsWith("python")){
                resolve(Languages.scripts["python"] );
            }
            else if (lang in Languages.scripts){
                resolve(Languages.scripts[lang] );
            }else{
                reject("Language " + lang + " not supported yet!");
            } 
        });
       
    }
        
    
}



