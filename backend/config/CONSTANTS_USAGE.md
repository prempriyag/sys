# Constants Usage Guide

## Overview

All table names and configuration constants from `CI3/app-constants.php` have been migrated to `backend/config/constants.py`.

## Location

**Constants File:** `backend/config/constants.py`

## Usage Examples

### Importing Constants

```python
# Import specific constants
from config.constants import TBL_ADMIN, TBL_ROLES, TBL_BUSINESS

# Or import all from config package
from config import TBL_ADMIN, TBL_ROLES, INS_NAME, SYSTEM_NAME

# Or use the TABLES dictionary
from config.constants import TABLES
table_name = TABLES['ADMIN']  # Returns 'PORTAL_ADMIN'
```

### Using in Models

```python
from config.constants import TBL_ADMIN, TBL_ROLES
from database.connection import Base

class User(Base):
    __tablename__ = TBL_ADMIN  # Uses 'PORTAL_ADMIN'
    
    role_id = Column(Integer, ForeignKey(f"{TBL_ROLES}.ID"))
```

### Using in Controllers

```python
from config.constants import TBL_ADMIN, TBL_ROLES
from sqlalchemy.orm import Session

def get_users(db: Session):
    return db.query(User).filter(User.status == 1).all()
```

### Using Configuration Constants

```python
from config.constants import INS_NAME, SYSTEM_NAME, VERSION, SUPPORT_PHONE

print(f"Institution: {INS_NAME}")  # OSUCSC
print(f"System: {SYSTEM_NAME}")     # DigiScript
print(f"Version: {VERSION}")        # V.202401.01
print(f"Support: {SUPPORT_PHONE}")  # +91 984 904 9259
```

## Available Constants

### Table Names (TBL_*)

All table names match the PHP constants exactly:

- `TBL_ADMIN` → 'PORTAL_ADMIN'
- `TBL_ROLES` → 'PORTAL_ROLES'
- `TBL_PERMISSIONS` → 'PORTAL_PERMISSIONS'
- `TBL_ROLE_PERMISSIONS` → 'PORTAL_ROLE_PERMISSIONS'
- `TBL_USER_CLIENTS` → 'PORTAL_USER_CLIENTS'
- `TBL_CONFIGURATION` → 'PORTAL_CONFIGURATION'
- `TBL_SMTP` → 'PORTAL_SMTP'
- `TBL_BUSINESS` → 'BUSINESS_SETTINGS'
- `TBL_CLIENT` → 'CLIENT_MAPPING'
- `TBL_PROJECT` → 'PROJECT_MAPPING'
- `TBL_BOTS` → 'BOTS_MAPPING'
- `TBL_INSTITUTION_MAPPING` → 'INSTITUTION_MAPPING'
- `TBL_TERM_MAPPING` → 'TERM_MAPPING'
- `TBL_TERM_NAMEMAPPING` → 'TERM_NAME_MAPPING'
- `TBL_DEGREE` → 'DEGREE_MAPPING'
- `TBL_GRADE` → 'GRADES_MAPPING'
- `TBL_ACCEPTED_GRADES_MAPPING` → 'ACCEPTED_GRADES_MAPPING'
- `TBL_TRANSFER_GRADES_MAPPING` → 'TRANSFER_GRADES_MAPPING'
- `TBL_YEAR_MAPPING` → 'YEAR_MAPPING'
- `TBL_OVERRRIDE` → 'OVERRIDE_EDIT_MAPPING'
- `TBL_ACCREDITED_INSTITUTION` → 'ACCREDITED_INSTITUTION'
- `TBL_PrefixName` → 'PrefixName'
- `TBL_SuffixName` → 'SuffixName'
- `TBL_CombinedName` → 'CombinedName'
- `TBL_STATUS` → 'ALL_STATUS_CODES'
- `TBL_COURSES` → 'SKIP_COURSES'
- `TBL_SKIP_KEYWORDS` → 'SKIP_KEYWORDS'
- `TBL_TRANSCRIPTHDROCR` → 'TRANSCRIPT_HDR_OCR'
- `TBL_TRANSCRIPT_LINE_OCR_LEFT` → 'TRANSCRIPT_LINE_OCR_LEFT'
- `TBL_TRANSCRIPT_LINE_OCR_RIGHT` → 'TRANSCRIPT_LINE_OCR_RIGHT'
- `TBL_TRANSCRIPT_LINE_OCR_MIDDLE` → 'TRANSCRIPT_LINE_OCR_MIDDLE'
- `TBL_TRANSCRIPTLINEOCR` → 'TRANSCRIPT_LINE_OCR'
- `TBL_TRANSCRIPTHDRDATA` → 'TRANSCRIPT_HDR_DATA'
- `TBL_TRANSCRIPTLINEDATA` → 'TRANSCRIPT_LINE_DATA'
- `TBL_TRANSCRIPT_TEST_SCORE_OCR` → 'TRANSCRIPT_TEST_SCORE_OCR'
- `TBL_DOWNLOAD` → 'TRANSCRIPT_DOWNLOAD'
- `TBL_KICKOUT` → 'DIGISCRIPT_LOG'
- `TBL_DIGISCRIPTBOTLOG` → 'DIGISCRIPT_BOT_LOG'
- `TBL_BOT_SCHEDULE` → 'BOT_SCHEDULE'
- `TBL_ARTICULATION` → 'ARTICULATION_LOG'
- `TBL_ARTICULATIONBOTLOG` → 'ARTICULATION_BOT_LOG'
- `TBL_ARTICULATIONINPUT` → 'ARTICULATION_INPUT'
- `TBL_ARTICULATIONSTG` → 'ARTICULATION_STG'
- `TBL_APCREDITSCHECK` → 'AP_CREDITS_CHECK'
- `TBL_BANNER_APPLICANT_DATA` → 'BANNER_APPLICANT_DATA'
- `TBL_CATEGORY` → 'PORTAL_CATEGORY'
- `TBL_ARTICLE` → 'PORTAL_ARTICLE'
- `TBL_BATCH_ASSIGN_STG` → 'PORTAL_ASSIGN_BATCHS'
- `TBL_Error_Log` → 'Error_Log'
- `TBL_GPA_PICK_MAPPING` → 'GPA_PICK_MAPPING'
- `TBL_GPA_SCALE_MAPPING` → 'GPA_SCALE_MAPPING_70_100'

### Configuration Constants

- `SUPPORT_PHONE` → '+91 984 904 9259'
- `PORTAL_ENV` → Environment (DEV/UAT/PROD)
- `INS_NAME` → 'OSUCSC'
- `STUDENT_LABEL` → 'OSUCSC'
- `HOT_FOLDER` → 'osucsc_dev'
- `HOT_PATH` → 'OSUCSC'
- `SHARE_PATH` → Network share path
- `SHARE_PATH_REPLACE` → Network share path (forward slashes)
- `IS_UBUNTU` → Boolean
- `STATUS_SUCC` → 'blue'
- `STATUS_FAIL` → 'red'
- `STATUS_PROCESSED` → 'green'
- `STATUS_RERUN` → 'black'
- `SCHOOL_PROJECT_ID` → 1
- `COLLEGE_PROJECT_ID` → 2
- `SYSTEM_NAME` → 'DigiScript'
- `VERSION` → 'V.202401.01'
- `PASSWORD_FORMAT` → HTML tooltip string
- `COPY_RIGHTS` → Copyright HTML string

### Path Constants

- `TRANSCRIPTS_HIGH_SCHOOL` → High school transcripts path
- `TRANSCRIPTS_COLLEGE` → College transcripts path
- `TRANSCRIPTS_HIGH_SCHOOL_TOBEPROCESSED` → To be processed path
- `TRANSCRIPTS_COLLEGE_TOBEPROCESSED` → To be processed path
- `TRANSCRIPTS_HIGH_SCHOOL_PROCESSED` → Processed path
- `TRANSCRIPTS_COLLEGE_PROCESSED` → Processed path

### SQL Query Constants

- `HDR_FILE_PATH_UPDATE` → SQL update query string

### TABLES Dictionary

For easy lookup, all table names are also available in a dictionary:

```python
from config.constants import TABLES

table_name = TABLES['ADMIN']  # Returns 'PORTAL_ADMIN'
table_name = TABLES['ROLES']  # Returns 'PORTAL_ROLES'
```

## Environment Variables

Some constants can be overridden via environment variables (in `.env`):

- `HOT_FOLDER` - defaults to 'osucsc_dev'
- `HOT_PATH` - defaults to 'OSUCSC'
- `INS_NAME` - defaults to 'OSUCSC'
- `STUDENT_LABEL` - defaults to 'OSUCSC'
- `SHARE_PATH` - defaults based on HOT_FOLDER
- `SHARE_PATH_REPLACE` - defaults based on HOT_FOLDER

## Benefits

1. **Single Source of Truth** - All table names in one place
2. **Easy Maintenance** - Change once, affects everywhere
3. **Type Safety** - Python will catch typos at import time
4. **Consistency** - Same names as CodeIgniter application
5. **Documentation** - All constants clearly documented

## Migration Notes

- All table names match exactly with CodeIgniter constants
- Configuration constants match PHP behavior
- Path constants are computed from environment variables
- Constants are available at module import time

