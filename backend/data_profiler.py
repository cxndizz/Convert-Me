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
    
    def profile(self, max_sample_rows: int = 10000) -> Dict[str, Any]:
        """
        วิเคราะห์ไฟล์และสร้างโปรไฟล์ข้อมูล
        max_sample_rows: จำนวนแถวสูงสุดที่จะใช้เป็นตัวอย่าง
        """
        try:
            print(f"Processing file: {self.file_path} with extension: {self.file_extension}")
            
            # ตรวจสอบประเภทไฟล์และเลือกวิธีการโหลดข้อมูลที่เหมาะสม
            if self.file_extension in ['.csv', '.txt']:
                df = self._load_csv_data(max_sample_rows)
            elif self.file_extension in ['.xls', '.xlsx']:
                try:
                    df = self._load_excel_data(max_sample_rows)
                    # ตรวจสอบว่าได้ข้อมูลมาหรือไม่
                    if df is None or df.shape[0] == 0:
                        return {"error": "Excel file contains no data or could not be parsed properly"}
                except Exception as e:
                    print(f"Excel loading failed: {str(e)}")
                    return {"error": f"Failed to load Excel file: {str(e)}"}
            elif self.file_extension == '.sql':
                df = self._load_sql_data(max_sample_rows)
            else:
                raise ValueError(f"Unsupported file type: {self.file_extension}")
            
            if df is None or df.shape[0] == 0:
                return {"error": "Failed to load data or empty file"}
            
            # ทำ data profiling
            self._compute_basic_stats(df)
            self._compute_column_stats(df)
            
            return self.profile_results
            
        except Exception as e:
            # ถ้ามีข้อผิดพลาด คืนข้อความข้อผิดพลาด
            print(f"Error in profile method: {str(e)}")
            return {"error": str(e)}
    
    def _load_csv_data(self, max_rows: int) -> pl.DataFrame:
        """โหลดข้อมูล CSV/TXT โดยใช้ Polars"""
        # ตรวจสอบ/ปรับปรุงค่า delimiter ถ้าจำเป็น
        if not self.delimiter:
            # ถ้ายังไม่มี delimiter ลองตรวจจับอีกครั้ง
            self.delimiter = self._detect_delimiter()
        
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
                    raise ValueError(f"Failed to load CSV: {e3}")
    
    def _load_excel_data(self, max_rows: int) -> pl.DataFrame:
        """โหลดข้อมูล Excel โดยใช้ pandas แล้วแปลงเป็น Polars"""
        print(f"Attempting to load Excel file: {self.file_path}")
        
        # ลองหลายวิธีสำหรับการอ่านไฟล์ Excel
        try:
            # วิธีที่ 1: ใช้ pandas อย่างเดียวโดยไม่ระบุ engine
            print("Trying to load Excel without specifying engine")
            df_pd = pd.read_excel(
                self.file_path,
                nrows=max_rows,
                header=0 if self.header else None
            )
            print(f"Successfully loaded Excel file with default engine, shape: {df_pd.shape}")
            
        except Exception as e1:
            print(f"Default Excel loading method failed: {e1}")
            
            try:
                # วิธีที่ 2: ลองใช้ engine='openpyxl' สำหรับ .xlsx
                print("Trying openpyxl engine")
                df_pd = pd.read_excel(
                    self.file_path,
                    nrows=max_rows,
                    header=0 if self.header else None,
                    engine='openpyxl'
                )
                print(f"Successfully loaded Excel with openpyxl, shape: {df_pd.shape}")
                
            except Exception as e2:
                print(f"Excel loading with openpyxl failed: {e2}")
                
                try:
                    # วิธีที่ 3: ลองใช้ engine='xlrd' สำหรับ .xls
                    print("Trying xlrd engine")
                    df_pd = pd.read_excel(
                        self.file_path,
                        nrows=max_rows,
                        header=0 if self.header else None,
                        engine='xlrd'
                    )
                    print(f"Successfully loaded Excel with xlrd, shape: {df_pd.shape}")
                    
                except Exception as e3:
                    print(f"Excel loading with xlrd failed: {e3}")
                    
                    # วิธีที่ 4: สำหรับ .xlsx ใช้ engine='odf' (สำหรับบางไฟล์ที่เป็น corrupted xlsx)
                    if self.file_extension == '.xlsx':
                        try:
                            print("Trying odf engine")
                            df_pd = pd.read_excel(
                                self.file_path,
                                nrows=max_rows,
                                header=0 if self.header else None,
                                engine='odf'
                            )
                            print(f"Successfully loaded Excel with odf, shape: {df_pd.shape}")
                        except Exception as e4:
                            print(f"All Excel loading methods failed: {e1}, {e2}, {e3}, {e4}")
                            raise ValueError(f"Failed to load Excel file after trying multiple engines: {e4}")
                    else:
                        print(f"All Excel loading methods failed: {e1}, {e2}, {e3}")
                        raise ValueError(f"Failed to load Excel file after trying multiple engines: {e3}")
        
        try:
            # แปลงเป็น Polars DataFrame
            print("Converting pandas DataFrame to Polars")
            df = pl.from_pandas(df_pd)
            print(f"Successfully converted to Polars, shape: {df.shape}")
            return df
        except Exception as e:
            print(f"Error converting pandas DataFrame to Polars: {e}")
            # ถ้าไม่สามารถแปลงเป็น Polars ได้ ให้สร้าง DataFrame ขึ้นมาใหม่
            print("Creating basic Polars DataFrame from pandas")
            try:
                # สร้างคอลัมน์และข้อมูลใหม่
                columns = df_pd.columns.tolist()
                data = {}
                
                for col in columns:
                    # แปลง Series เป็น list โดยจัดการ NaN และ complex objects
                    values = []
                    for val in df_pd[col]:
                        if pd.isna(val):
                            values.append(None)
                        elif isinstance(val, (int, float, str, bool)):
                            values.append(val)
                        else:
                            values.append(str(val))
                    data[col] = values
                
                # สร้าง Polars DataFrame
                df = pl.DataFrame(data)
                print(f"Created Polars DataFrame manually, shape: {df.shape}")
                return df
            except Exception as e2:
                print(f"Failed to create Polars DataFrame manually: {e2}")
                # สร้าง DataFrame ว่างๆ พร้อมข้อความข้อผิดพลาด
                df = pl.DataFrame({
                    "Column1": ["Excel file could not be processed"],
                    "Status": ["Error: Please check file format"]
                })
                return df
    
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
                # ถ้าไม่พบ CREATE TABLE ให้คืนค่า DataFrame ว่างๆ
                return pl.DataFrame()
                
        except Exception as e:
            print(f"Error processing SQL file: {e}")
            # สร้าง DataFrame ว่างๆ
            return pl.DataFrame()
    
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
            "header_detected": self.header
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
                unique_values = col_series.drop_nulls().unique()
                distinct_count = len(unique_values)
                distinct_pct = (distinct_count / (len(df) - null_count)) * 100 if (len(df) - null_count) > 0 else 0
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
                sample = series.drop_nulls().sample(n=min(100, series.len() - series.null_count()))
                if len(sample) == 0:
                    return "STRING"
            except Exception as e:
                print(f"Error sampling column data: {e}")
                return "STRING"
            
            # ตรวจสอบว่าอาจเป็น Boolean หรือไม่
            bool_values = {'true', 'false', 'yes', 'no', 'y', 'n', '1', '0', 't', 'f'}
            try:
                if all(str(v).lower() in bool_values for v in sample if v is not None and str(v).strip()):
                    return "BOOLEAN"
            except Exception as e:
                print(f"Error checking boolean values: {e}")
            
            # ตรวจสอบว่าอาจเป็นตัวเลขหรือไม่
            try:
                # ทดลองแปลงเป็น float ทุกค่าในตัวอย่าง
                all_numeric = all(
                    (isinstance(v, (int, float)) or (isinstance(v, str) and v.strip() and float(v.strip())))
                    for v in sample if v is not None and str(v).strip()
                )
                if all_numeric:
                    # ตรวจสอบว่าเป็น integer ทั้งหมดหรือไม่
                    all_integer = all(
                        (isinstance(v, int) or (isinstance(v, str) and v.strip() and float(v.strip()).is_integer()))
                        for v in sample if v is not None and str(v).strip()
                    )
                    return "INTEGER" if all_integer else "FLOAT"
            except:
                pass
            
            # ตรวจสอบว่าอาจเป็นวันที่หรือไม่
            date_patterns = [
                r'^\d{4}-\d{2}-\d{2}$',  # YYYY-MM-DD
                r'^\d{2}/\d{2}/\d{4}$',  # DD/MM/YYYY or MM/DD/YYYY
                r'^\d{2}-\d{2}-\d{4}$',  # DD-MM-YYYY or MM-DD-YYYY
                r'^\d{1,2}\s+[a-zA-Z]{3,9}\s+\d{4}$',  # DD Month YYYY
            ]
            
            # ตรวจสอบว่ามีรูปแบบวันที่หรือไม่
            has_date_pattern = False
            for pattern in date_patterns:
                if any(re.match(pattern, str(v).strip()) for v in sample if v is not None and str(v).strip()):
                    has_date_pattern = True
                    break
            
            if has_date_pattern:
                # ตรวจสอบว่ามีเวลาหรือไม่
                time_pattern = r'\d{1,2}:\d{2}(:\d{2})?(\s*[ap]m)?'
                try:
                    has_time = any(
                        re.search(time_pattern, str(v).strip(), re.IGNORECASE)
                        for v in sample if v is not None and str(v).strip()
                    )
                    
                    return "TIMESTAMP" if has_time else "DATE"
                except Exception as e:
                    print(f"Error checking time pattern: {e}")
        
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
                            numeric_series = numeric_series.cast(pl.Float64, strict=False)
                        
                        stats["min"] = float(numeric_series.min())
                        stats["max"] = float(numeric_series.max())
                        stats["mean"] = float(numeric_series.mean())
                        stats["median"] = float(numeric_series.median())
                        stats["std_dev"] = float(numeric_series.std())
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
            
            # สถิติสำหรับข้อความ
            elif inferred_type == "STRING":
                text_series = series.drop_nulls()
                if len(text_series) > 0:
                    # คำนวณความยาวเฉลี่ย
                    try:
                        lengths = text_series.map_elements(lambda x: len(str(x)) if x is not None else 0)
                        stats["avg_length"] = float(lengths.mean())
                        stats["max_length"] = int(lengths.max())
                    except Exception as e:
                        print(f"Error computing string stats: {e}")
        except Exception as e:
            print(f"Error in _compute_type_specific_stats: {e}")
        
        return stats
    
    def _get_sample_values(self, series: pl.Series, max_samples: int = 5) -> List[Any]:
        """ดึงตัวอย่างข้อมูลจากคอลัมน์"""
        try:
            # ดึงค่าที่ไม่ซ้ำกันไม่เกิน max_samples ค่า
            unique_values = series.drop_nulls().unique()
            
            if len(unique_values) > max_samples:
                # สุ่มตัวอย่างถ้ามีค่ามากเกินไป
                samples = unique_values.sample(n=max_samples)
            else:
                samples = unique_values
            
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
            return []
    
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
                    if series.dtype == pl.String:
                        numeric_series = numeric_series.cast(pl.Float64, strict=False)
                    
                    # ตรวจสอบการกระจายตัวที่ผิดปกติ
                    std = numeric_series.std()
                    mean = numeric_series.mean()
                    
                    if not pd.isna(std) and not pd.isna(mean) and mean != 0 and std > mean * 10:
                        issues.append("high_variance")
                    
                    # ตรวจสอบ outliers
                    q1 = numeric_series.quantile(0.25)
                    q3 = numeric_series.quantile(0.75)
                    iqr = q3 - q1
                    
                    if iqr > 0:  # ป้องกัน division by zero
                        lower_bound = q1 - 1.5 * iqr
                        upper_bound = q3 + 1.5 * iqr
                        
                        outliers = numeric_series.filter((numeric_series < lower_bound) | (numeric_series > upper_bound))
                        
                        if len(outliers) > len(numeric_series) * 0.05:
                            issues.append("possible_outliers")
            except Exception as e:
                print(f"Error checking numeric column issues: {e}")
                # ถ้าไม่สามารถแปลงเป็น numeric ได้ ให้เพิ่มปัญหา
                if inferred_type in ["INTEGER", "FLOAT"]:
                    issues.append("mixed_numeric_formats")
        
        # ตรวจสอบรูปแบบ timestamp ที่หลากหลาย
        if inferred_type in ["DATE", "TIMESTAMP"] and series.dtype == pl.String:
            issues.append("mixed_date_formats")
        
        return issues