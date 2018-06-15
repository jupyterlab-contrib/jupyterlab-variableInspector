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
           "python3" : { initScript : `import json\nimport numpy as np\nfrom sys import getsizeof\n\nfrom IPython import get_ipython\nfrom IPython.core.magics.namespace import NamespaceMagics\n\n_jupyterlab_variableinspector_nms = NamespaceMagics()\n_jupyterlab_variableinspector_Jupyter = get_ipython()\n_jupyterlab_variableinspector_nms.shell = _jupyterlab_variableinspector_Jupyter.kernel.shell\n\ntry:\n\timport numpy as np  # noqa: F401\nexcept ImportError:\n\tpass\n\n\ndef _jupyterlab_variableinspector_getsizeof(x):\n\t# return the size of variable x. Amended version of sys.getsizeof\n\t# which also supports ndarray, Series and DataFrame\n\tif type(x).__name__ in ['ndarray', 'Series']:\n\t\treturn x.nbytes\n\telif type(x).__name__ == 'DataFrame':\n\t\treturn x.memory_usage().sum()\n\telse:\n\t\treturn getsizeof(x)\n\n\ndef _jupyterlab_variableinspector_getshapeof(x):\n\t# returns the shape of x if it has one\n\t# returns None otherwise - might want to return an empty string for an empty collum\n\ttry:\n\t\treturn x.shape\n\texcept AttributeError:  # x does not have a shape\n\t\treturn None\n\n\ndef _jupyterlab_variableinspector_dic_list():\n\ttypes_to_exclude = ['module', 'function', 'builtin_function_or_method',\n\t\t\t\t\t\t'instance', '_Feature', 'type', 'ufunc']\n\tvalues = _jupyterlab_variableinspector_nms.who_ls()\n\tvardic = [{'varName': v, 'varType': type(eval(v)).__name__, 'varSize': str(_getsizeof(eval(v))), 'varShape': str(_getshapeof(eval(v))) if _getshapeof(eval(v)) else '', 'varContent': str(eval(v))[:200]}  # noqa\n\n\tfor v in values if (v not in ['_html', '_nms', 'NamespaceMagics', '_Jupyter']) & (type(eval(v)).__name__ not in types_to_exclude)] # noqa\n\treturn json.dumps(vardic)\n\ndef _jupyterlab_variableinspector_getmatrixcontent(x):\n\tif type(x).__name__ in ["Series", "DataFrame"]:\n\t\tresponse = {"schema": pd.io.json.build_table_schema(x),\n\t\t\t\t\t"data": pd.DataFrame(x).to_dict(orient="records")}\n\t\treturn response\n\t\t\ndef _jupyterlab_variableinspector_default(o):\n\tif isinstance(o, np.int64): return int(o)  \n\traise TypeError\n\n`,
                        queryCommand : "_jupyterlab_variableinspector_dic_list()"},
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



