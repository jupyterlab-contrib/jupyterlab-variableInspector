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

try:
    import pyspark
except ImportError:
    pyspark = None

try:
    import tensorflow as tf
    import keras.backend as K
except ImportError:
    tf = None


def _jupyterlab_variableinspector_getsizeof(x):
    if type(x).__name__ in ['ndarray', 'Series']:
        return x.nbytes
    elif pyspark and isinstance(x, pyspark.sql.DataFrame):
        return "?"
    elif tf and isinstance(x, tf.Variable):
        return "?"
    elif pd and type(x).__name__ == 'DataFrame':
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
    if pyspark and isinstance(x, pyspark.sql.DataFrame):
        return "Spark DataFrame [? rows x %d cols]" % len(x.columns)
    if tf and isinstance(x, tf.Variable):
        shape = " x ".join([str(int(i)) for i in x.shape])
        return "Tensorflow Variable [%s]" % shape
    if tf and isinstance(x, tf.Tensor):
        shape = " x ".join([str(int(i)) for i in x.shape])
        return "Tensorflow Tensor [%s]" % shape
    return None


def _jupyterlab_variableinspector_getcontentof(x):
    # returns content in a friendly way for python variables
    # pandas and numpy
    if pd and isinstance(x, pd.DataFrame):
        colnames = ', '.join(x.columns.map(str))
        content = "Column names: %s" % colnames
    elif pd and isinstance(x, pd.Series):
        content = "Series [%d rows]" % x.shape
    elif np and isinstance(x, np.ndarray):
        content = x.__repr__()
    else:
        content = str(x)
    if len(content) > 150:
        return content[:150] + " ..."
    else:
        return content


def _jupyterlab_variableinspector_is_matrix(x):
    # True if type(x).__name__ in ["DataFrame", "ndarray", "Series"] else False
    if pd and isinstance(x, pd.DataFrame):
        return True
    if pd and isinstance(x, pd.Series):
        return True
    if np and isinstance(x, np.ndarray) and len(x.shape) <= 2:
        return True
    if pyspark and isinstance(x, pyspark.sql.DataFrame):
        return True
    if tf and isinstance(x, tf.Variable) and len(x.shape) <= 2:
        return True
    if tf and isinstance(x, tf.Tensor) and len(x.shape) <= 2:
        return True
    return False


def _jupyterlab_variableinspector_dict_list():
    def keep_cond(v):
        try:
            obj = eval(v)
            if isinstance(obj, str):
                return True
            if tf and isinstance(obj, tf.Variable):
                return True
            if pd and pd is not None and (
                isinstance(obj, pd.core.frame.DataFrame)
                or isinstance(obj, pd.core.series.Series)):
                return True
            if str(obj)[0] == "<":
                return False
            if  v in ['np', 'pd', 'pyspark', 'tf']:
                return obj is not None
            if str(obj).startswith("_Feature"):
                # removes tf/keras objects
                return False
            return True
        except:
            return False
    values = _jupyterlab_variableinspector_nms.who_ls()
    vardic = [{'varName': _v, 
    'varType': type(eval(_v)).__name__, 
    'varSize': str(_jupyterlab_variableinspector_getsizeof(eval(_v))), 
    'varShape': str(_jupyterlab_variableinspector_getshapeof(eval(_v))) if _jupyterlab_variableinspector_getshapeof(eval(_v)) else '', 
    'varContent': str(_jupyterlab_variableinspector_getcontentof(eval(_v))), 
    'isMatrix': _jupyterlab_variableinspector_is_matrix(eval(_v))}
            for _v in values if keep_cond(_v)]
    return json.dumps(vardic, ensure_ascii=False)


def _jupyterlab_variableinspector_getmatrixcontent(x, max_rows=10000):
    
    # to do: add something to handle this in the future
    threshold = max_rows

    if pd and pyspark and isinstance(x, pyspark.sql.DataFrame):
        df = x.limit(threshold).toPandas()
        return _jupyterlab_variableinspector_getmatrixcontent(df.copy())
    elif np and pd and type(x).__name__ in ["Series", "DataFrame"]:
        if threshold is not None:
            x = x.head(threshold)
        x.columns = x.columns.map(str)
        return x.to_json(orient="table", default_handler=_jupyterlab_variableinspector_default, force_ascii=False)
    elif np and pd and type(x).__name__ in ["ndarray"]:
        df = pd.DataFrame(x)
        return _jupyterlab_variableinspector_getmatrixcontent(df)
    elif tf and (isinstance(x, tf.Variable) or isinstance(x, tf.Tensor)):
        df = K.get_value(x)
        return _jupyterlab_variableinspector_getmatrixcontent(df)

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
        out$varContent <- sapply(names, function(x) toString(get(x))[1])
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
        "python2": {
            initScript: Languages.py_script,
            queryCommand: "_jupyterlab_variableinspector_dict_list()",
            matrixQueryCommand: "_jupyterlab_variableinspector_getmatrixcontent"
        },
        "python": {
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



