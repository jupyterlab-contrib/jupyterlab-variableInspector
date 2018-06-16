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
   static scripts: { [index: string]: Languages.LanguageModel } = {
           "python3" : { initScript : `import json\n
from sys import getsizeof\n

from IPython import get_ipython\n
from IPython.core.magics.namespace import NamespaceMagics\n

_nms = NamespaceMagics()\n
_Jupyter = get_ipython()\n
_nms.shell = _Jupyter.kernel.shell\n

try:\n
    import numpy as np  # noqa: F401\n
except ImportError:\n
    pass\n


def _getsizeof(x):\n
    # return the size of variable x. Amended version of sys.getsizeof\n
    # which also supports ndarray, Series and DataFrame\n
    if type(x).__name__ in ['ndarray', 'Series']:\n
        return x.nbytes\n
    elif type(x).__name__ == 'DataFrame':\n
        return x.memory_usage().sum()\n
    else:\n
        return getsizeof(x)\n


def _getshapeof(x):\n
    # returns the shape of x if it has one\n
    # returns None otherwise - might want to return an empty string for an empty collum\n
    try:\n
        return x.shape\n
    except AttributeError:  # x does not have a shape\n
        return None\n


def _var_dic_list():\n
    types_to_exclude = ['module', 'function', 'builtin_function_or_method','instance', '_Feature', 'type', 'ufunc']\n
    values = _nms.who_ls()\n
    vardic = [{'varName': v, 'varType': type(eval(v)).__name__, 'varSize': str(_getsizeof(eval(v))), 'varShape': str(_getshapeof(eval(v))) if _getshapeof(eval(v)) else '', 'varContent': str(eval(v))[:200]}  # noqa\n
        for v in values if ((str(eval(v))[0] != "<") or (isinstance(eval(v), str)))] #Prevent showing classes, modules etc.\n
    return json.dumps(vardic)\n
                        `,
                        queryCommand : "_var_dic_list()"},
                };
   
    public static getScript(lang:string):Promise<Languages.LanguageModel>{
        return new Promise(function(resolve, reject) {
            if (lang in Languages.scripts){
                resolve(Languages.scripts[lang] );
            }else{
                reject("Language " + lang + " not supported yet!");
            } 
        });
       
    }
        
    
}



