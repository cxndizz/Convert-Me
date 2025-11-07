import os
import pandas as pd
import zipfile
import struct
import binascii

def is_valid_excel(file_path):
    """
    ตรวจสอบว่าไฟล์เป็นไฟล์ Excel ที่ถูกต้องหรือไม่
    
    Args:
        file_path: พาธของไฟล์ที่ต้องการตรวจสอบ
        
    Returns:
        (bool, str): คืนค่า (True, None) ถ้าไฟล์ถูกต้อง หรือ (False, error_message) ถ้าไฟล์มีปัญหา
    """
    try:
        file_extension = os.path.splitext(file_path)[1].lower()
        
        # ตรวจสอบขนาดไฟล์
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            return False, "Empty file"
        
        # ตรวจสอบ magic numbers และรูปแบบไฟล์
        with open(file_path, 'rb') as f:
            header = f.read(16)  # อ่าน 16 ไบต์แรก
            
            # ตรวจสอบว่าเป็นไฟล์เปล่าหรือมีแค่บรรทัดว่าง
            if all(b == 0 or b in [10, 13, 32] for b in header):  # \n, \r, space
                return False, "File contains only whitespace or is empty"
                
            # สำหรับ .xlsx (Office Open XML format - เป็นไฟล์ zip)
            if file_extension == '.xlsx':
                # ตรวจสอบ signature ของไฟล์ ZIP
                if header[:4] != b'PK\x03\x04':
                    return False, "Invalid XLSX file (not a valid ZIP file)"
                
                # ทดสอบเปิดเป็น zipfile
                try:
                    with zipfile.ZipFile(file_path) as z:
                        # ตรวจสอบว่ามีไฟล์ที่จำเป็นสำหรับ XLSX
                        required_files = ['[Content_Types].xml', '_rels/.rels']
                        missing = [f for f in required_files if f not in z.namelist()]
                        if missing:
                            return False, f"XLSX missing required files: {', '.join(missing)}"
                except zipfile.BadZipFile:
                    return False, "Not a valid XLSX file (corrupt ZIP container)"
                    
            # สำหรับ .xls (Binary format)
            elif file_extension == '.xls':
                # ตรวจสอบ magic number ของไฟล์ XLS (0xD0CF11E0A1B11AE1)
                if header[:8] != b'\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1':
                    # ในบางครั้ง Excel สามารถเปิดไฟล์ที่ไม่มี magic number ได้
                    # ลองเปิดด้วย xlrd โดยตรง
                    try:
                        import xlrd
                        wb = xlrd.open_workbook(file_path)
                        if len(wb.sheet_names()) == 0:
                            return False, "XLS file has no sheets"
                    except Exception as e:
                        return False, f"Invalid XLS file format: {str(e)}"
        
        # ถ้าไม่มีข้อผิดพลาดเกิดขึ้นจนถึงจุดนี้ ให้ลองเปิดด้วย pandas
        try:
            if file_extension == '.xlsx':
                df = pd.read_excel(file_path, nrows=1, engine='openpyxl')
            else:
                df = pd.read_excel(file_path, nrows=1, engine='xlrd')
                
            # ตรวจสอบว่าไฟล์มีข้อมูลหรือไม่
            if df.empty and len(df.columns) <= 1:
                return False, "Excel file has no valid data"
                
            return True, None
            
        except Exception as e:
            # หากไม่สามารถเปิดได้ด้วย pandas ให้ถือว่าไฟล์มีปัญหา
            return False, f"Failed to open with pandas: {str(e)}"
    
    except Exception as e:
        return False, f"Error validating Excel file: {str(e)}"

def repair_excel_file(input_file, output_file=None):
    """
    พยายามซ่อมแซมไฟล์ Excel ที่เสียหาย
    
    Args:
        input_file: พาธของไฟล์ต้นฉบับ
        output_file: พาธของไฟล์ที่จะบันทึกหลังซ่อมแซม (ถ้าไม่ระบุจะใช้ชื่อเดิมพร้อมเติม _repaired)
        
    Returns:
        (bool, str): คืนค่า (True, output_path) ถ้าซ่อมแซมสำเร็จ หรือ (False, error_message) ถ้าล้มเหลว
    """
    try:
        # ถ้าไม่ได้ระบุชื่อไฟล์เอาต์พุต ให้สร้างจากชื่อเดิม
        if output_file is None:
            base_name, ext = os.path.splitext(input_file)
            output_file = f"{base_name}_repaired{ext}"
        
        # ตรวจสอบนามสกุลไฟล์
        _, ext = os.path.splitext(input_file)
        ext = ext.lower()
        
        if ext not in ['.xls', '.xlsx']:
            return False, "Not an Excel file"
        
        # ลองอ่านไฟล์ด้วย pandas หรือ csv โดยขึ้นอยู่กับปัญหา
        try:
            # วิธีที่ 1: ลองอ่านเป็นไฟล์ CSV หรือข้อความแล้วแปลงเป็น Excel
            try:
                with open(input_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # ถ้าไฟล์เป็นข้อความล้วนๆ ให้แปลงเป็น CSV
                if '\t' in content:
                    delimiter = '\t'
                elif ',' in content:
                    delimiter = ','
                else:
                    delimiter = None
                
                if delimiter:
                    import csv
                    import io
                    
                    csv_data = []
                    csv_reader = csv.reader(io.StringIO(content), delimiter=delimiter)
                    for row in csv_reader:
                        csv_data.append(row)
                    
                    # แปลงเป็น DataFrame
                    df = pd.DataFrame(csv_data)
                    
                    # บันทึกเป็น Excel
                    if ext == '.xlsx':
                        df.to_excel(output_file, index=False, engine='openpyxl')
                    else:
                        df.to_excel(output_file, index=False, engine='xlwt')
                    
                    return True, output_file
            except Exception as e:
                print(f"CSV repair attempt failed: {str(e)}")
                pass
            
            # วิธีที่ 2: ลองอ่านด้วย pandas แล้วบันทึกใหม่
            try:
                if ext == '.xlsx':
                    df = pd.read_excel(input_file, engine='openpyxl')
                    df.to_excel(output_file, index=False, engine='openpyxl')
                else:
                    df = pd.read_excel(input_file, engine='xlrd')
                    df.to_excel(output_file, index=False, engine='xlwt')
                return True, output_file
            except Exception as e:
                print(f"Pandas repair attempt failed: {str(e)}")
                pass
                
            return False, "Could not repair file with available methods"
                
        except Exception as e:
            return False, f"Failed to repair Excel file: {str(e)}"
            
    except Exception as e:
        return False, f"Error in repair process: {str(e)}"