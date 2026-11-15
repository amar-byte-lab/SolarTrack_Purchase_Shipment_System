export interface ReportFilter {
  type: string;
  from: string;
  to: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  isNumeric?: boolean;
}

export interface ReportRow {
  [key: string]: any;
}
