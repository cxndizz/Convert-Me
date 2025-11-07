import os
import duckdb
import polars as pl
import pyarrow as pa
import pyarrow.csv as csv
import pyarrow.parquet as pq
import json
import pandas as pd
from typing import Dict, List, Optional, Any, Tuple
import re
import chardet
from datetime import datetime
import traceback

class DataProfiler:
    def __init__(self, file_path: str, file_info: Dict[str, Any]):
        """
        เริ่มต้นวิเคราะห์ไฟล์
        file_path: พาธไฟล์ที่จะวิเคราะห์
        file_info: ข้อมูลเบื้องต้นของไฟล์ (encoding, detected_delimiter, header_detected)
        """
        self.file_path = file_path
        self.file_info = file_info
        self.file_extension = os.path.splitext(file_path)[1].lower()
        
        # กำหนดค่าเริ่มต้นจากข้อมูลไฟล์
        self.encoding = file_info.get('encoding', 'utf-8')
        self.delimiter = file_info.get('detected_delimiter', ',')
        self.header = file_info.get('header_detected', True)
        
        # ข้อมูลผลการวิเคราะห์
        self.profile_results = {}
        
        # พารามิเตอร์เพิ่มเติม
        self.multi_header_rows = 2  # จำนวนแถว header (ค่าเริ่มต้น)
    
    def profile(self, max_sample_rows: int = 10000) -> Dict[str, Any]:
        """
        วิเคราะห์ไฟล์และสร้างโปรไฟล์ข้อมูล
        max_sample_rows: จำนวนแถวสูงสุดที่จะใช้เป็นตัวอย่าง
        """
        try:
            print(f"Processing file: {self.file_path} with extension: {self.file_extension}")
            
            # ตรวจสอบประเภทไฟล์และเลือกวิธีการโหลดข้อมูลที่เหมาะสม
            if self.file_extension in ['.csv', '.txt']:
                # ถ้าเป็นไฟล์ .csv หรือ .txt ให้ใช้ฟังก์ชัน load_csv_data
                df = self._load_csv_data(max_sample_rows)
            elif self.file_extension in ['.xls', '.xlsx']:
                # ถ้าเป็นไฟล์ Excel ให้เรียกใช้ฟังก์ชันที่รองรับ multi-row header
                df = self._load_excel_data_multi_header(max_sample_rows)
            elif self.file_extension == '.sql':
                df = self._load_sql_data(max_sample_rows)
            else:
                raise ValueError(f"Unsupported file type: {self.file_extension}")
            
            if df is None or df.shape[0] == 0:
                if df is None:
                    return {"error": "Failed to load data (DataFrame is None)"}
                else:
                    return {"error": "Failed to load data or empty file"}
            
            # ทำ data profiling
            self._compute_basic_stats(df)
            self._compute_column_stats(df)
            
            return self.profile_results
            
        except Exception as e:
            # ถ้ามีข้อผิดพลาด คืนข้อความข้อผิดพลาด
            print(f"Error in profile method: {str(e)}")
            print(traceback.format_exc())  # พิมพ์ stacktrace เต็ม
            return {"error": f"Error processing file: {str(e)}"}
    
    def _load_excel_data_multi_header(self, max_rows: int) -> pl.DataFrame:
        """โหลดข้อมูล Excel โดยรองรับ header หลายแถว"""
        print(f"Loading Excel file with multi-row header support: {self.file_path}")
        
        try:
            # ก่อนอื่นลองอ่านไฟล์ด้วย pandas เพื่อตรวจสอบโครงสร้าง
            # อ่านหลายแถวแรกเพื่อตรวจสอบ header
            header_sample = pd.read_excel(
                self.file_path, 
                nrows=5,  # อ่านเพียง 5 แถวแรกเพื่อตรวจสอบ header
                header=None  # ไม่กำหนด header เพื่อให้อ่านทุกแถว
            )
            
            # ตรวจสอบแถวว่าง
            empty_rows = []
            for i in range(min(5, len(header_sample))):
                if header_sample.iloc[i].isna().all() or header_sample.iloc[i].astype(str).str.strip().eq('').all():
                    empty_rows.append(i)
            
            # ตรวจสอบว่ามีหลาย header หรือไม่ (พิจารณาจากแถวแรกๆ ที่ไม่ว่าง)
            non_empty_rows = [i for i in range(min(5, len(header_sample))) if i not in empty_rows]
            
            # กำหนดจำนวนแถว header
            if len(non_empty_rows) >= 2:
                # ถ้ามีมากกว่า 1 แถวที่ไม่ว่าง ให้ถือว่ามีหลาย header
                self.multi_header_rows = len(non_empty_rows)
                print(f"Detected {self.multi_header_rows} header rows")
                
                # สร้าง column names จากการรวมแถว header
                column_names = []
                for col_idx in range(len(header_sample.columns)):
                    col_name_parts = []
                    for row_idx in non_empty_rows:
                        value = header_sample.iloc[row_idx, col_idx]
                        if pd.notna(value) and str(value).strip():
                            col_name_parts.append(str(value).strip())
                    
                    if col_name_parts:
                        column_names.append('_'.join(col_name_parts))
                    else:
                        column_names.append(f"Column_{col_idx + 1}")
                
                # หาแถวเริ่มต้นของข้อมูลจริง (หลัง header)
                data_start_row = max(non_empty_rows) + 1
                
                # อ่านข้อมูลอีกครั้งโดยข้ามแถว header และตั้งชื่อคอลัมน์
                df_pd = pd.read_excel(
                    self.file_path,
                    skiprows=data_start_row,
                    nrows=max_rows,
                    header=None,
                    names=column_names
                )
            else:
                # ถ้ามีเพียงแถวเดียว ให้ใช้การอ่านแบบปกติ
                df_pd = pd.read_excel(
                    self.file_path,
                    nrows=max_rows,
                    header=0 if self.header else None
                )
                
                # ตรวจสอบว่ามีคอลัมน์ที่ไม่มีชื่อหรือไม่ แล้วแทนที่
                unnamed_cols = [col for col in df_pd.columns if 'Unnamed:' in str(col)]
                rename_dict = {col: f"Column_{i+1}" for i, col in enumerate(unnamed_cols)}
                if rename_dict:
                    df_pd = df_pd.rename(columns=rename_dict)
            
            # แปลงเป็น Polars DataFrame
            try:
                df = pl.from_pandas(df_pd)
                print(f"Successfully converted to Polars DataFrame, shape: {df.shape}")
                return df
            except Exception as e:
                print(f"Error converting pandas DataFrame to Polars: {e}")
                # สร้างคอลัมน์และข้อมูลใหม่
                data = {}
                for col in df_pd.columns:
                    values = []
                    for val in df_pd[col]:
                        if pd.isna(val):
                            values.append(None)
                        elif isinstance(val, (int, float, str, bool)):
                            values.append(val)
                        else:
                            values.append(str(val))
                    data[str(col)] = values
                
                # สร้าง Polars DataFrame
                df = pl.DataFrame(data)
                print(f"Created Polars DataFrame manually, shape: {df.shape}")
                return df
                
        except Exception as e:
            print(f"Error in _load_excel_data_multi_header: {e}")
            print(traceback.format_exc())
            
            # ลองใช้วิธีอื่น
            try:
                print("Trying alternate Excel loading method")
                # วิธีที่ 2: ใช้ pandas อย่างเดียวโดยข้ามการตรวจสอบ header
                df_pd = pd.read_excel(
                    self.file_path,
                    nrows=max_rows,
                    header=None  # ไม่ระบุ header เพื่อให้อ่านทุกแถว
                )
                
                # แปลงเป็น Polars DataFrame
                df = pl.from_pandas(df_pd)
                
                # สร้างชื่อคอลัมน์แบบพื้นฐาน
                df = df.rename({str(col): f"Column_{i+1}" for i, col in enumerate(df.columns)})
                
                return df
            except Exception as e2:
                print(f"Alternate Excel loading method failed: {e2}")
                # สร้าง DataFrame ว่างๆ พร้อมข้อความข้อผิดพลาด
                return pl.DataFrame({
                    "Error": ["Failed to load Excel file"],
                    "Details": [f"Error: {str(e)}, {str(e2)}"]
                })
    
    def _load_csv_data(self, max_rows: int) -> pl.DataFrame:
        """โหลดข้อมูล CSV/TXT โดยใช้ Polars"""
        # ตรวจสอบ/ปรับปรุงค่า delimiter ถ้าจำเป็น
        if not self.delimiter:
            # ถ้ายังไม่มี delimiter ลองตรวจจับอีกครั้ง
            self.delimiter = self._detect_delimiter()
        
        # ตรวจสอบว่าไฟล์มีข้อมูลหรือไม่
        try:
            file_size = os.path.getsize(self.file_path)
            if file_size == 0:
                print("File is empty")
                return pl.DataFrame({"Empty_File": ["This file contains no data"]})
        except Exception as e:
            print(f"Error checking file size: {e}")
        
        try:
            # ใช้ Polars อ่านข้อมูลแบบ streaming
            df = pl.read_csv(
                self.file_path,
                separator=self.delimiter,
                encoding=self.encoding,
                infer_schema_length=max_rows,
                n_rows=max_rows,
                has_header=self.header,
                ignore_errors=True,
                low_memory=True
            )
            return df
        except Exception as e:
            print(f"Error loading CSV with Polars: {e}")
            # Fallback ใช้ PyArrow
            try:
                parse_options = csv.ParseOptions(
                    delimiter=self.delimiter,
                    ignore_empty_lines=True,
                    escape_char="\\",
                    quote_char='"'
                )
                
                read_options = csv.ReadOptions(
                    skip_rows=1 if self.header else 0,
                    encoding=self.encoding,
                    use_threads=True,
                    block_size=10 * 1024 * 1024  # 10 MB block size
                )
                
                table = csv.read_csv(
                    self.file_path,
                    parse_options=parse_options,
                    read_options=read_options
                )
                
                # แปลงเป็น Polars DataFrame
                df = pl.from_arrow(table)
                
                # จำกัดจำนวนแถว
                if len(df) > max_rows:
                    df = df.head(max_rows)
                    
                return df
            except Exception as e2:
                print(f"Error loading CSV with PyArrow: {e2}")
                # Fallback ใช้ DuckDB
                try:
                    conn = duckdb.connect(database=':memory:')
                    query = f"""
                    SELECT * FROM read_csv(
                        '{self.file_path}',
                        delim='{self.delimiter}',
                        header={str(self.header).lower()},
                        sample_size={max_rows},
                        AUTO_DETECT=TRUE
                    ) LIMIT {max_rows}
                    """
                    df_duck = conn.execute(query).fetchdf()
                    # แปลงเป็น Polars DataFrame
                    df = pl.from_pandas(df_duck)
                    return df
                except Exception as e3:
                    print(f"All CSV loading methods failed: {e3}")
                    
                    # ลองอ่านไฟล์ด้วย Python พื้นฐาน
                    try:
                        lines = []
                        with open(self.file_path, 'r', encoding=self.encoding, errors='replace') as f:
                            for i, line in enumerate(f):
                                if i >= max_rows:
                                    break
                                lines.append(line.strip().split(self.delimiter))
                        
                        # สร้าง DataFrame จาก lines
                        if lines:
                            if self.header and len(lines) > 0:
                                columns = lines[0]
                                data = lines[1:]
                            else:
                                columns = [f"Column_{i+1}" for i in range(len(lines[0]))] if lines else ["Data"]
                                data = lines
                            
                            # สร้าง dict สำหรับแต่ละคอลัมน์
                            column_data = {}
                            for i, col in enumerate(columns):
                                column_data[col] = [row[i] if i < len(row) else None for row in data]
                            
                            return pl.DataFrame(column_data)
                        else:
                            # ถ้าไม่มีข้อมูล ให้สร้าง DataFrame ว่างๆ
                            return pl.DataFrame({"Empty_File": ["This file contains no readable data"]})
                    except Exception as e4:
                        print(f"Basic file reading failed: {e4}")
                        raise ValueError(f"Failed to load file with any method: {e3}, {e4}")
    
    def _load_sql_data(self, max_rows: int) -> pl.DataFrame:
        """
        อ่านไฟล์ SQL และพยายามดึงข้อมูลจากคำสั่ง CREATE TABLE
        หรือ INSERT INTO ถ้ามี
        """
        try:
            # อ่านไฟล์ SQL
            with open(self.file_path, 'r', encoding=self.encoding) as f:
                sql_content = f.read()
            
            # ดึงข้อมูลโครงสร้างตาราง (CREATE TABLE)
            create_table_match = re.search(r'CREATE\s+TABLE\s+([^\s(]+)\s*\(([^;]+)\)', sql_content, re.IGNORECASE | re.DOTALL)
            
            if create_table_match:
                table_name = create_table_match.group(1).strip('`"[]')
                columns_def = create_table_match.group(2)
                
                # แยกคอลัมน์และชนิดข้อมูล
                columns = []
                column_types = {}
                
                for col_def in re.finditer(r'([^\s,]+)\s+([^,]+)', columns_def):
                    col_name = col_def.group(1).strip('`"[]')
                    col_type = col_def.group(2).split()[0].upper()
                    columns.append(col_name)
                    column_types[col_name] = col_type
                
                # ดึงข้อมูลจาก INSERT INTO ถ้ามี
                insert_match = re.search(r'INSERT\s+INTO\s+[^\s(]+\s*(?:\([^)]+\))?\s*VALUES\s*([^;]+)', sql_content, re.IGNORECASE | re.DOTALL)
                
                data = []
                if insert_match:
                    values_text = insert_match.group(1)
                    
                    # แยกชุดข้อมูลแต่ละแถว
                    for value_match in re.finditer(r'\(([^)]+)\)', values_text):
                        row_values = value_match.group(1).split(',')
                        data.append([v.strip("'\" ") for v in row_values])
                        
                        if len(data) >= max_rows:
                            break
                
                # สร้าง DataFrame จากข้อมูลที่ดึงได้
                if data:
                    df = pl.DataFrame(data, columns=columns)
                else:
                    # ถ้าไม่มีข้อมูล ให้สร้าง DataFrame ว่างๆ ที่มีเฉพาะโครงสร้าง
                    df = pl.DataFrame({col: [] for col in columns})
                
                return df
            else:
                # ถ้าไม่พบ CREATE TABLE ให้สร้าง DataFrame ว่างๆ
                return pl.DataFrame({"Result": ["SQL file does not contain CREATE TABLE statement"]})
                
        except Exception as e:
            print(f"Error processing SQL file: {e}")
            # สร้าง DataFrame ว่างๆ พร้อมข้อความข้อผิดพลาด
            return pl.DataFrame({"Error": [f"Failed to parse SQL file: {str(e)}"]})
    
    def _detect_delimiter(self) -> str:
        """ตรวจสอบตัวคั่นในไฟล์ CSV/TXT"""
        # อ่านตัวอย่างข้อมูลจากไฟล์
        with open(self.file_path, 'rb') as f:
            sample = f.read(4096)  # อ่าน 4KB แรกเป็นตัวอย่าง
        
        # ถ้าไฟล์ใหญ่มาก ให้อ่านตัวอย่างบรรทัดจากต้นไฟล์
        sample_text = sample.decode(self.encoding, errors='replace')
        
        # ตรวจสอบตัวคั่นที่พบบ่อย
        delimiters = [',', ';', '\t', '|']
        counts = {d: sample_text.count(d) for d in delimiters}
        
        # เลือกตัวคั่นที่พบมากที่สุด
        if max(counts.values()) > 0:
            return max(counts, key=counts.get)
        else:
            # ถ้าไม่พบตัวคั่นใดๆ ให้ใช้ comma เป็นค่าเริ่มต้น
            return ','
    
    def _compute_basic_stats(self, df: pl.DataFrame) -> None:
        """คำนวณสถิติพื้นฐานของข้อมูลทั้งหมด"""
        # จำนวนแถวและคอลัมน์
        row_count = len(df)
        column_count = len(df.columns)
        
        # เก็บผลลัพธ์
        self.profile_results.update({
            "row_count": row_count,
            "column_count": column_count,
            "file_name": os.path.basename(self.file_path),
            "file_extension": self.file_extension,
            "encoding": self.encoding,
            "delimiter": self.delimiter if self.file_extension in ['.csv', '.txt'] else None,
            "header_detected": self.header,
            "multi_header_rows": self.multi_header_rows if self.file_extension in ['.xls', '.xlsx'] else None
        })
    
    def _compute_column_stats(self, df: pl.DataFrame) -> None:
        """คำนวณสถิติต่อคอลัมน์"""
        columns_profile = []
        
        # ตรวจสอบว่า DataFrame ไม่ว่างเปล่า
        if df.shape[0] == 0:
            self.profile_results["columns_profile"] = []
            return
        
        for col_name in df.columns:
            col_series = df[col_name]
            
            # นับค่า null
            try:
                null_count = col_series.null_count()
                null_pct = (null_count / len(df)) * 100 if len(df) > 0 else 0
            except Exception as e:
                print(f"Error calculating null stats for column {col_name}: {e}")
                null_count = 0
                null_pct = 0
            
            # นับค่าที่ไม่ซ้ำกัน
            try:
                if len(col_series.drop_nulls()) > 0:
                    unique_values = col_series.drop_nulls().unique()
                    distinct_count = len(unique_values)
                    distinct_pct = (distinct_count / (len(df) - null_count)) * 100 if (len(df) - null_count) > 0 else 0
                else:
                    distinct_count = 0
                    distinct_pct = 0
            except Exception as e:
                print(f"Error calculating distinct stats for column {col_name}: {e}")
                distinct_count = 0
                distinct_pct = 0
            
            # เดาชนิดข้อมูล
            try:
                inferred_type = self._infer_column_type(col_series)
            except Exception as e:
                print(f"Error inferring type for column {col_name}: {e}")
                inferred_type = "STRING"
            
            # คำนวณค่าสถิติตามชนิดข้อมูล
            try:
                stats = self._compute_type_specific_stats(col_series, inferred_type)
            except Exception as e:
                print(f"Error computing type-specific stats for column {col_name}: {e}")
                stats = {}
            
            # รวมข้อมูลโปรไฟล์คอลัมน์
            col_profile = {
                "name": col_name,
                "inferred_type": inferred_type,
                "null_count": null_count,
                "null_pct": null_pct,
                "distinct_count": distinct_count,
                "distinct_pct": distinct_pct,
                **stats
            }
            
            # เพิ่มตัวอย่างข้อมูล
            try:
                col_profile["sample_values"] = self._get_sample_values(col_series)
            except Exception as e:
                print(f"Error getting sample values for column {col_name}: {e}")
                col_profile["sample_values"] = []
            
            # ตรวจสอบปัญหา
            try:
                col_profile["issues"] = self._check_column_issues(col_series, inferred_type, null_pct, distinct_pct)
            except Exception as e:
                print(f"Error checking column issues for {col_name}: {e}")
                col_profile["issues"] = []
            
            columns_profile.append(col_profile)
        
        # เก็บผลลัพธ์
        self.profile_results["columns_profile"] = columns_profile
    
    def _infer_column_type(self, series: pl.Series) -> str:
        """
        เดาชนิดข้อมูลของคอลัมน์
        คืนค่าเป็น: "INTEGER", "FLOAT", "BOOLEAN", "DATE", "TIMESTAMP", "STRING"
        """
        # ตรวจสอบชนิดข้อมูลจาก Polars
        dtype = str(series.dtype)
        
        # ถ้าเป็น Float หรือ Integer ก็คืนค่าตามนั้น
        if 'float' in dtype.lower():
            return "FLOAT"
        elif 'int' in dtype.lower():
            return "INTEGER"
        elif 'bool' in dtype.lower():
            return "BOOLEAN"
        elif 'date' in dtype.lower():
            return "DATE"
        elif 'datetime' in dtype.lower() or 'timestamp' in dtype.lower():
            return "TIMESTAMP"
        
        # ถ้าเป็น String ให้ตรวจสอบเพิ่มเติม
        if 'str' in dtype.lower() or 'object' in dtype.lower():
            # สุ่มตัวอย่างข้อมูล (ไม่เกิน 100 แถว)
            try:
                non_null_count = series.len() - series.null_count()
                if non_null_count == 0:
                    return "STRING"
                
                sample = series.drop_nulls().sample(n=min(100, non_null_count))
                if len(sample) == 0:
                    return "STRING"
            except Exception as e:
                print(f"Error sampling column data: {e}")
                return "STRING"
            
            # ตรวจสอบว่าอาจเป็น Boolean หรือไม่
            bool_values = {'true', 'false', 'yes', 'no', 'y', 'n', '1', '0', 't', 'f'}
            try:
                all_bool = True
                for v in sample:
                    if v is None or not str(v).strip():
                        continue
                    if str(v).lower() not in bool_values:
                        all_bool = False
                        break
                
                if all_bool and len(sample) > 0:
                    return "BOOLEAN"
            except Exception as e:
                print(f"Error checking boolean values: {e}")
            
            # ตรวจสอบว่าอาจเป็นตัวเลขหรือไม่
            try:
                all_numeric = True
                all_integer = True
                
                for v in sample:
                    if v is None or not str(v).strip():
                        continue
                    
                    if isinstance(v, (int, float)):
                        if not (isinstance(v, int) or float(v).is_integer()):
                            all_integer = False
                    else:
                        try:
                            # ลองแปลงเป็นตัวเลข
                            num = float(str(v).strip())
                            if not num.is_integer():
                                all_integer = False
                        except:
                            all_numeric = False
                            break
                
                if all_numeric and len(sample) > 0:
                    return "INTEGER" if all_integer else "FLOAT"
            except Exception as e:
                print(f"Error checking numeric values: {e}")
                pass
            
            # ตรวจสอบว่าอาจเป็นวันที่หรือไม่
            date_patterns = [
                r'^\d{4}-\d{2}-\d{2}$',  # YYYY-MM-DD
                r'^\d{1,2}/\d{1,2}/\d{4}$',  # D/M/YYYY or M/D/YYYY (รวมถึงวันที่ไทย วัน/เดือน/พ.ศ.)
                r'^\d{1,2}-\d{1,2}-\d{4}$',  # D-M-YYYY or M-D-YYYY
                r'^\d{1,2}\s+[a-zA-Z]{3,9}\s+\d{4}$',  # DD Month YYYY
                r'^\d{1,2}/\d{1,2}/\d{2}$',  # DD/MM/YY
            ]
            
            # ตรวจสอบว่ามีรูปแบบวันที่หรือไม่
            try:
                has_date_pattern = False
                for pattern in date_patterns:
                    for v in sample:
                        if v is None:
                            continue
                        if re.match(pattern, str(v).strip()):
                            has_date_pattern = True
                            break
                    if has_date_pattern:
                        break
                
                if has_date_pattern:
                    # ตรวจสอบว่ามีเวลาหรือไม่
                    time_pattern = r'\d{1,2}:\d{2}(:\d{2})?(\s*[ap]m)?'
                    has_time = False
                    
                    for v in sample:
                        if v is None:
                            continue
                        if re.search(time_pattern, str(v).strip(), re.IGNORECASE):
                            has_time = True
                            break
                    
                    return "TIMESTAMP" if has_time else "DATE"
            except Exception as e:
                print(f"Error checking date patterns: {e}")
        
        # ค่าเริ่มต้นเป็น STRING
        return "STRING"
    
    def _compute_type_specific_stats(self, series: pl.Series, inferred_type: str) -> Dict[str, Any]:
        """คำนวณสถิติตามชนิดข้อมูล"""
        stats = {}
        
        try:
            # สถิติสำหรับตัวเลข
            if inferred_type in ["INTEGER", "FLOAT"]:
                numeric_series = series.drop_nulls()
                if len(numeric_series) > 0:
                    try:
                        # ใช้ cast เพื่อแปลงเป็น float
                        if series.dtype == pl.String:
                            try:
                                numeric_series = numeric_series.cast(pl.Float64, strict=False)
                            except:
                                # ถ้าแปลงไม่ได้ ให้ใช้วิธี manual conversion
                                values = []
                                for v in numeric_series:
                                    try:
                                        values.append(float(str(v).strip()))
                                    except:
                                        values.append(None)
                                numeric_series = pl.Series(values)
                        
                        # ตรวจสอบว่ามีค่าที่ไม่ใช่ None ก่อนคำนวณสถิติ
                        if numeric_series.len() > 0 and numeric_series.null_count() < numeric_series.len():
                            stats["min"] = float(numeric_series.drop_nulls().min())
                            stats["max"] = float(numeric_series.drop_nulls().max())
                            stats["mean"] = float(numeric_series.drop_nulls().mean())
                            stats["median"] = float(numeric_series.drop_nulls().median())
                            stats["std_dev"] = float(numeric_series.drop_nulls().std())
                    except Exception as e:
                        print(f"Error computing numeric stats: {e}")
            
            # สถิติสำหรับวันที่
            elif inferred_type in ["DATE", "TIMESTAMP"]:
                if series.dtype in [pl.Date, pl.Datetime]:
                    date_series = series.drop_nulls()
                    if len(date_series) > 0:
                        try:
                            stats["min"] = date_series.min().strftime('%Y-%m-%d')
                            stats["max"] = date_series.max().strftime('%Y-%m-%d')
                        except Exception as e:
                            print(f"Error computing date stats: {e}")
                # ถ้าเป็น String ที่มีรูปแบบวันที่ ลองแปลงเป็นวันที่ก่อน
                elif series.dtype == pl.String:
                    try:
                        # ตรวจสอบรูปแบบวันที่ไทย (D/M/BBBB หรือ วัน/เดือน/พ.ศ.)
                        thai_dates = []
                        for v in series.drop_nulls():
                            try:
                                if isinstance(v, str) and re.match(r'^\d{1,2}/\d{1,2}/\d{4}$', v):
                                    parts = v.split('/')
                                    if len(parts) == 3:
                                        day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                                        if year > 2500:  # พ.ศ.
                                            year -= 543  # แปลงเป็น ค.ศ.
                                        thai_dates.append(f"{year:04d}-{month:02d}-{day:02d}")
                            except Exception as e:
                                print(f"Error parsing Thai date: {v}, {e}")
                        
                        if thai_dates:
                            stats["min_date"] = min(thai_dates) if thai_dates else None
                            stats["max_date"] = max(thai_dates) if thai_dates else None
                            stats["date_format"] = "Thai format (D/M/YYYY)"
                    except Exception as e:
                        print(f"Error processing date strings: {e}")
            
            # สถิติสำหรับข้อความ
            elif inferred_type == "STRING":
                text_series = series.drop_nulls()
                if len(text_series) > 0:
                    # คำนวณความยาวเฉลี่ย
                    try:
                        lengths = []
                        for v in text_series:
                            if v is not None:
                                lengths.append(len(str(v)))
                            else:
                                lengths.append(0)
                        
                        if lengths:
                            stats["avg_length"] = sum(lengths) / len(lengths)
                            stats["max_length"] = max(lengths)
                    except Exception as e:
                        print(f"Error computing string stats: {e}")
        except Exception as e:
            print(f"Error in _compute_type_specific_stats: {e}")
        
        return stats
    
    def _get_sample_values(self, series: pl.Series, max_samples: int = 5) -> List[Any]:
        """ดึงตัวอย่างข้อมูลจากคอลัมน์"""
        try:
            # ตรวจสอบว่ามีข้อมูลไม่เป็น null หรือไม่
            non_null_count = series.len() - series.null_count()
            if non_null_count == 0:
                return ["<no data>"]
            
            # ดึงค่าที่ไม่ซ้ำกันไม่เกิน max_samples ค่า
            try:
                unique_values = series.drop_nulls().unique()
                
                if len(unique_values) > max_samples:
                    # สุ่มตัวอย่างถ้ามีค่ามากเกินไป
                    samples = unique_values.sample(n=max_samples)
                else:
                    samples = unique_values
            except Exception as e:
                print(f"Error getting unique values: {e}")
                # ถ้าไม่สามารถหาค่า unique ได้ ให้ใช้ค่าทั่วไป
                non_null_series = series.drop_nulls()
                if len(non_null_series) > max_samples:
                    samples = non_null_series.sample(n=max_samples)
                else:
                    samples = non_null_series
            
            # แปลงเป็น Python list
            result = samples.to_list()
            
            # แปลงวัตถุที่ซับซ้อนให้เป็น string
            for i, val in enumerate(result):
                if isinstance(val, (datetime, pd.Timestamp)):
                    result[i] = val.strftime('%Y-%m-%d %H:%M:%S')
                elif not isinstance(val, (str, int, float, bool, type(None))):
                    result[i] = str(val)
            
            return result
        except Exception as e:
            print(f"Error in _get_sample_values: {e}")
            return ["<error getting samples>"]
    
    def _check_column_issues(self, series: pl.Series, inferred_type: str, null_pct: float, distinct_pct: float) -> List[str]:
        """ตรวจสอบปัญหาที่อาจมีในคอลัมน์"""
        issues = []
        
        # ตรวจสอบค่า null สูง
        if null_pct > 20:
            issues.append("high_null_percentage")
        
        # ตรวจสอบค่าที่ไม่ซ้ำกันสูง (อาจเป็น primary key หรือ unique identifier)
        if distinct_pct > 95 and series.len() > 10:
            issues.append("high_cardinality")
        
        # ตรวจสอบค่าที่ไม่ซ้ำกันต่ำ (อาจเป็น categorical หรือ enum)
        if distinct_pct < 1 and series.len() > 100:
            issues.append("low_cardinality")
        
        # ตรวจสอบปัญหาตามประเภทข้อมูล
        if inferred_type in ["INTEGER", "FLOAT"]:
            try:
                numeric_series = series.drop_nulls()
                if len(numeric_series) > 0:
                    try:
                        if series.dtype == pl.String:
                            # ลองแปลงเป็นตัวเลข
                            values = []
                            conversion_failures = 0
                            for v in numeric_series:
                                try:
                                    values.append(float(str(v).strip()))
                                except:
                                    conversion_failures += 1
                                    values.append(None)
                            
                            if conversion_failures > 0:
                                issues.append("mixed_numeric_formats")
                            
                            numeric_series = pl.Series(values).drop_nulls()
                        
                        # ตรวจสอบการกระจายตัวที่ผิดปกติ
                        if len(numeric_series) > 0:
                            std = numeric_series.std()
                            mean = numeric_series.mean()
                            
                            if not pd.isna(std) and not pd.isna(mean) and abs(mean) > 1e-10 and std / abs(mean) > 10:
                                issues.append("high_variance")
                            
                            # ตรวจสอบ outliers
                            if len(numeric_series) >= 4:  # ต้องมีข้อมูลพอที่จะคำนวณ IQR
                                q1 = numeric_series.quantile(0.25)
                                q3 = numeric_series.quantile(0.75)
                                iqr = q3 - q1
                                
                                if iqr > 0:  # ป้องกัน division by zero
                                    lower_bound = q1 - 1.5 * iqr
                                    upper_bound = q3 + 1.5 * iqr
                                    
                                    outliers_count = 0
                                    for v in numeric_series:
                                        if v < lower_bound or v > upper_bound:
                                            outliers_count += 1
                                    
                                    if outliers_count > len(numeric_series) * 0.05:
                                        issues.append("possible_outliers")
                    except Exception as e:
                        print(f"Error checking numeric column issues: {e}")
                        if inferred_type in ["INTEGER", "FLOAT"]:
                            issues.append("numeric_analysis_error")
            except Exception as e:
                print(f"Error in outlier detection: {e}")
                # ถ้าไม่สามารถแปลงเป็น numeric ได้ ให้เพิ่มปัญหา
                if inferred_type in ["INTEGER", "FLOAT"]:
                    issues.append("mixed_numeric_formats")
        
        # ตรวจสอบรูปแบบ timestamp ที่หลากหลาย
        if inferred_type in ["DATE", "TIMESTAMP"] and series.dtype == pl.String:
            issues.append("mixed_date_formats")
            
            # ตรวจสอบรูปแบบวันที่ไทย
            try:
                thai_date_pattern = r'^\d{1,2}/\d{1,2}/25\d{2}$'  # วัน/เดือน/25XX
                thai_date_found = False
                
                for v in series.drop_nulls():
                    if isinstance(v, str) and re.match(thai_date_pattern, v):
                        thai_date_found = True
                        break
                
                if thai_date_found:
                    issues.append("thai_date_format")
            except Exception as e:
                print(f"Error checking Thai date format: {e}")
        
        return issues