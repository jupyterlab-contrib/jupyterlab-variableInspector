import {
    DataGrid, DataModel, TextRenderer
}"@phosphor/datagrid";

class MatrixDataModel extends DataModel{
    
    private _data: string[][] = [];
    private _index : string[] = [];
    private _columns : string[] = [];
    

    constructor(data: string[][], index : string[], columns : string[], isDataframe : bool) {
        super();
        this._data = data;
        this._index = index;
        this._columns = columns;
        if (!isDataframe){
           //Dont show a header (if possible)
           
        }
    }
    
    rowCount(region: DataModel.RowRegion): number {
        return region === "body" ? this._data.length : 1;
    }
    
    columnCount(region: DataModel.ColumnRegion): number {
        return region === "body" ? this._data[0].length : 1; 
    }
    
    
    data(region: DataModel.CellRegion, row: number, column: number): any{
        if( region === "row_header"){
            return this._columns[column];
        }
        if(region == "column-header"){
            return this._index[row];
        }
        if(region === "corner-header"){
            return "Index";
        }
        return this._data[row][column];
    }
    
    
    get style: DataGrid.IStyle = {
        ...DataGrid.defaultStyle,
        rowBackgroundColor: i => i % 2 === 0 ? 'rgba(138, 172, 200, 0.3)' : '',
        columnBackgroundColor: i => i % 2 === 0 ? 'rgba(100, 100, 100, 0.1)' : ''
    };
    
        
}

