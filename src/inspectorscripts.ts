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

    static py_script: string = `import json
from sys import getsizeof

from IPython import get_ipython
from IPython.core.magics.namespace import NamespaceMagics

_jupyterlab_variableinspector_nms = NamespaceMagics()
_jupyterlab_variableinspector_Jupyter = get_ipython()
_jupyterlab_variableinspector_nms.shell = _jupyterlab_variableinspector_Jupyter.kernel.shell

try:
    import numpy as np
except ImportError:
    np = None

try:
    import pandas as pd
except ImportError:
    pd = None

def _jupyterlab_variableinspector_getsizeof(x):
    if type(x).__name__ in ['ndarray', 'Series']:
        return x.nbytes
    elif type(x).__name__ == 'DataFrame':
        return x.memory_usage().sum()
    else:
        return getsizeof(x)

def _jupyterlab_variableinspector_getshapeof(x):
    if pd and isinstance(x, pd.DataFrame):
        return "DataFrame [%d rows x %d cols]" % x.shape
    if pd and isinstance(x, pd.Series):
        return "Series [%d rows]" % x.shape
    if np and isinstance(x, np.ndarray):
        shape = " x ".join([str(i) for i in x.shape])
        return "Array [%s]" %  shape
    return None

def _jupyterlab_variableinspector_getcontentof(x):
    # returns content in a friendly way for python variables
    # pandas and numpy
    if pd and isinstance(x, pd.DataFrame):
        colnames = ', '.join([str(c) for c  in x.columns])
        return "Column names: %s" % colnames
    if pd and isinstance(x, pd.Series):
        return "Series [%d rows]" % x.shape
    if np and isinstance(x, np.ndarray):
        return x.__repr__()
    return str(x)[:200]


def _jupyterlab_variableinspector_dict_list():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vardic = [{'varName': _v, 'varType': type(eval(_v)).__name__, 
    'varSize': str(_jupyterlab_variableinspector_getsizeof(eval(_v))), 
    'varShape': str(_jupyterlab_variableinspector_getshapeof(eval(_v))) if _jupyterlab_variableinspector_getshapeof(eval(_v)) else '', 
    'varContent': str(_jupyterlab_variableinspector_getcontentof(eval(_v))), 
    'isMatrix': True if type(eval(_v)).__name__ in ["DataFrame", "ndarray", "Series"] else False}
            for _v in values if ((str(eval(_v))[0] != "<") or (isinstance(eval(_v), str)))]
    return json.dumps(vardic)

def _jupyterlab_variableinspector_getmatrixcontent(x):
    if np and pd and type(x).__name__ in ["Series", "DataFrame"]:
        x.columns = x.columns.map(str)
        response = {"schema": pd.io.json.build_table_schema(x),"data": x.to_dict(orient="records")}
        return json.dumps(response,default=_jupyterlab_variableinspector_default)
    elif np and pd and type(x).__name__ in ["ndarray"]:
        df = pd.DataFrame(x)
        df.columns = df.columns.map(str)
        response = {"schema": pd.io.json.build_table_schema(df), "data": df.to_dict(orient="records")}
        return json.dumps(response,default=_jupyterlab_variableinspector_default)

def _jupyterlab_variableinspector_default(o):
    if isinstance(o, np.number): return int(o)  
    raise TypeError
`;

    static r_script: string = `
    # improved list of objects
    .ls.objects <- function (pos = 1, pattern, order.by,
                            decreasing=FALSE, head=FALSE, n=5) {
        napply <- function(names, fn) sapply(names, function(x)
                                            fn(get(x, pos = pos)))
        names <- ls(pos = pos, pattern = pattern)
        if (length(names) == 0){
            return(jsonlite::toJSON(data.frame()))
        }
        obj.class <- napply(names, function(x) as.character(class(x))[1])
        obj.mode <- napply(names, mode)
        obj.type <- ifelse(is.na(obj.class), obj.mode, obj.class)
        obj.size <- napply(names, object.size)
        obj.dim <- t(napply(names, function(x)
                            as.numeric(dim(x))[1:2]))
        vec <- is.na(obj.dim)[, 1] & (obj.type != "function")
        obj.dim[vec, 1] <- napply(names, length)[vec]
        out <- data.frame(obj.type, obj.size, obj.dim)
        names(out) <- c("varType", "varSize", "Rows", "Columns")
        out$varShape <- paste(out$Rows, " x ", out$Columns)
        out$varContent <- paste(out$Rows, " x ", out$Columns)
        out$isMatrix <- FALSE
        out$varName <- row.names(out)
                            
        # drop columns Rows and Columns
        out <- out[, !(names(out) %in% c("Rows", "Columns"))]
        rownames(out) <- NULL

        if (!missing(order.by))
            out <- out[order(out[[order.by]], decreasing=decreasing), ]
        if (head)
            out <- head(out, n)
        jsonlite::toJSON(out)
    }
    `;
    
    static scripts: { [index: string]: Languages.LanguageModel } = {
        "python3": {
            initScript: Languages.py_script,
            queryCommand: "_jupyterlab_variableinspector_dict_list()",
            matrixQueryCommand: "_jupyterlab_variableinspector_getmatrixcontent"
        },
        "R": {
            initScript: Languages.r_script,
            queryCommand: ".ls.objects()",
            matrixQueryCommand: ".ls.objects"
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



