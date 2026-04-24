#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
自定义异常类
提供项目中使用的所有自定义异常
"""


class GoogleIndexingException(Exception):
    """Google Indexing API 基础异常"""

    pass


class ConfigValidationError(GoogleIndexingException):
    """配置验证错误"""

    pass


class FileNotFoundError(GoogleIndexingException):
    """文件未找到错误"""

    pass


class CredentialsError(GoogleIndexingException):
    """凭证错误"""

    pass


class AuthenticationError(GoogleIndexingException):
    """认证错误"""

    pass


class APIRequestError(GoogleIndexingException):
    """API 请求错误"""

    def __init__(self, message: str, status_code: int = None, url: str = None):
        self.status_code = status_code
        self.url = url
        super().__init__(message)


class RateLimitError(APIRequestError):
    """速率限制错误 (429)"""

    def __init__(self, message: str = "API 请求过多,请增加延迟时间", url: str = None):
        super().__init__(message, status_code=429, url=url)


class PermissionDeniedError(APIRequestError):
    """权限拒绝错误 (403)"""

    def __init__(self, message: str = "权限被拒绝,请检查 Search Console 配置", url: str = None):
        super().__init__(message, status_code=403, url=url)


class NetworkError(GoogleIndexingException):
    """网络错误"""

    pass


class TimeoutError(GoogleIndexingException):
    """请求超时"""

    pass


class ValidationError(GoogleIndexingException):
    """数据验证错误"""

    pass


class DuplicateURLError(ValidationError):
    """重复 URL 错误"""

    pass


class InvalidURLError(ValidationError):
    """无效 URL 错误"""

    pass


class CSVReadError(GoogleIndexingException):
    """CSV 读取错误"""

    pass


class EmptyCSVError(CSVReadError):
    """空 CSV 错误"""

    pass


class ColumnNotFoundError(CSVReadError):
    """列未找到错误"""

    def __init__(self, column: str, available_columns: list[str]):
        self.column = column
        self.available_columns = available_columns
        super().__init__(f"列 '{column}' 不存在,可用列: {', '.join(available_columns)}")


class ResumeError(GoogleIndexingException):
    """恢复提交错误"""

    pass


class MaxRetriesExceededError(GoogleIndexingException):
    """超过最大重试次数"""

    pass


class SubmissionInterruptedError(GoogleIndexingException):
    """提交被中断"""

    pass
