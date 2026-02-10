"""
Helpers package - Utility functions
"""
# Auth helpers
from helpers.auth_helper import (
    hash_password,
    verify_password,
    create_access_token,
    verify_token,
    password_form_validation,
)

# Database helpers
from helpers.db_helper import (
    get_setting,
    get_user_by_email,
    update_last_login,
    roletype,
)

# Common helpers
from helpers.common_helper import (
    generate_rand_number,
    get_data,
    time_ago,
    pr,
    get_months,
    get_years,
    upr2lwr,
    date_format,
    date_format_with_time,
    ymd_date_format,
    get_table_data,
    change_date_format,
    get_between_dates,
    get_months_slab,
    number_of_days,
    check_special_name,
    sanitize_for_json,
    sanitize_string,
)

# Security helpers
from helpers.security_helper import (
    get_username_from_token,
)

# Permission helpers
from helpers.permission_helper import (
    load_user_permissions,
    check_permission,
    check_all_permission,
    check_role_permission,
    user_main_permission,
    get_user_clients,
)

__all__ = [
    # Auth
    "hash_password",
    "verify_password",
    "create_access_token",
    "verify_token",
    "password_form_validation",
    # DB
    "get_setting",
    "get_user_by_email",
    "update_last_login",
    "roletype",
    # Common
    "generate_rand_number",
    "get_data",
    "time_ago",
    "pr",
    "get_months",
    "get_years",
    "upr2lwr",
    "date_format",
    "date_format_with_time",
    "ymd_date_format",
    "get_table_data",
    "change_date_format",
    "get_between_dates",
    "get_months_slab",
    "number_of_days",
    "check_special_name",
    "sanitize_for_json",
    "sanitize_string",
    # Security
    "get_username_from_token",
    # Permission
    "load_user_permissions",
    "check_permission",
    "check_all_permission",
    "check_role_permission",
    "user_main_permission",
    "get_user_clients",
]
