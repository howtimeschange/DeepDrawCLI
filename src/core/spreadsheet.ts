import * as fs from "node:fs";
import XLSX from "xlsx";

// SheetJS CE's ESM build requires the Node filesystem adapter explicitly.
XLSX.set_fs(fs);

export default XLSX;
