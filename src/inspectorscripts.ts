export
namespace Languages {
    export
        type LanguageModel = {
            initScript: string;
            queryCommand: string;
            matrixQueryCommand: string;
        }
}

export
    abstract class Languages {
    /**
     * Init and query script for supported languages.
     */
    static scripts: { [index: string]: Languages.LanguageModel } = {
        "python3": {
            initScript:
            `import json\n
import numpy as np\n
import pandas as pd\n
from sys import getsizeof\n
from IPython import get_ipython\nfrom IPython.core.magics.namespace import NamespaceMagics\n_jupyterlab_variableinspector_nms = NamespaceMagics()\n
_jupyterlab_variableinspector_Jupyter = get_ipython()\n
_jupyterlab_variableinspector_nms.shell = _jupyterlab_variableinspector_Jupyter.kernel.shell\n
try:\n
\timport numpy as np  # noqa: F401\n
except ImportError:\n
\tpass\n
def _jupyterlab_variableinspector_getsizeof(x):\n
\tif type(x).__name__ in ['ndarray', 'Series']:\n
\t\treturn x.nbytes\n
\telif type(x).__name__ == 'DataFrame':\n
\t\treturn x.memory_usage().sum()\n
\telse:\n
\t\treturn getsizeof(x)\n
\t\n
def _jupyterlab_variableinspector_getshapeof(x):\n
\ttry:\n
\t\treturn x.shape\n
\texcept AttributeError:  # x does not have a shape\n
\t\treturn None\n
\t\n
def _jupyterlab_variableinspector_dict_list():\n
\tvalues = _jupyterlab_variableinspector_nms.who_ls()\n
\tvardic = [{'varName': v, 'varType': type(eval(v)).__name__, 'varSize': str(_jupyterlab_variableinspector_getsizeof(eval(v))), 'varShape': str(_jupyterlab_variableinspector_getshapeof(eval(v))) if _jupyterlab_variableinspector_getshapeof(eval(v)) else '', 'varContent': str(eval(v))[:200], 'isMatrix': True if type(eval(v)).__name__ in ["DataFrame", "ndarray", "Series"] else False}  # noqa\n\n
\t\t\tfor v in values if ((str(eval(v))[0] != "<") or (isinstance(eval(v), str)))]\n\n
\treturn json.dumps(vardic)\n
def _jupyterlab_variableinspector_getmatrixcontent(x):\n
\tif type(x).__name__ in ["Series", "DataFrame"]:\n
\t\tx.columns = x.columns.map(str)\n
\t\tresponse = {"schema": pd.io.json.build_table_schema(x),"data": x.to_dict(orient="records")}\n
\t\treturn json.dumps(response,default=_jupyterlab_variableinspector_default)\n
\telif type(x).__name__ in ["ndarray"]:\n
\t\tdf = pd.DataFrame(x)\n
\t\tdf.columns = df.columns.map(str)\n
\t\tresponse = {"schema": pd.io.json.build_table_schema(df), "data": df.to_dict(orient="records")}\n
\t\treturn json.dumps(response,default=_jupyterlab_variableinspector_default)\n
def _jupyterlab_variableinspector_default(o):\n
\tif isinstance(o, np.number): return int(o)  \n
\traise TypeError`,
            queryCommand: "_jupyterlab_variableinspector_dict_list()",
            matrixQueryCommand: "_jupyterlab_variableinspector_getmatrixcontent"
        }
    };

    public static getScript( lang: string ): Promise<Languages.LanguageModel> {
        return new Promise( function( resolve, reject ) {
            if ( lang in Languages.scripts ) {
                resolve( Languages.scripts[lang] );
            } else {
                reject( "Language " + lang + " not supported yet!" );
            }
        } );

    }

}



